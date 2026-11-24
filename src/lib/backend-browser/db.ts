import { BackendError } from './errors.ts';

export const DB_NAME = 'pos_sum';

export const STORE_NAMES = ['configuration', 'categories', 'products', 'orders'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

/** Each migration upgrades the schema by one version: append new ones, never edit existing ones. */
const migrations: ((db: IDBDatabase) => void)[] = [
	(db) => {
		db.createObjectStore('configuration', { keyPath: 'id' });
		db.createObjectStore('categories', { keyPath: 'id' });
		db.createObjectStore('products', { keyPath: 'id' }).createIndex('category_id', 'category_id');
		// Orders embed their items. Auto-incremented keys keep them in insertion order.
		db.createObjectStore('orders', { autoIncrement: true }).createIndex('id', 'id', {
			unique: true
		});
	}
];

let connection: Promise<IDBDatabase> | undefined;

function connect(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, migrations.length);
		request.onupgradeneeded = (event) => {
			for (const migrate of migrations.slice(event.oldVersion)) {
				migrate(request.result);
			}
		};
		request.onsuccess = () => {
			const db = request.result;
			// Another tab upgrades or deletes the database: let it proceed, the next call reconnects.
			db.onversionchange = () => {
				db.close();
				connection = undefined;
			};
			// Closed by the browser, e.g. when the site data is cleared.
			db.onclose = () => {
				connection = undefined;
			};
			resolve(db);
		};
		request.onerror = () => reject(request.error);
	});
}

function openDatabase(): Promise<IDBDatabase> {
	connection ??= connect().catch((error: unknown) => {
		connection = undefined;
		throw error;
	});
	return connection;
}

export async function closeDatabase(): Promise<void> {
	const current = connection;
	connection = undefined;
	const db = await current?.catch(() => undefined);
	db?.close();
}

export function promisify<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/**
 * Resolves once the transaction has committed, so writes don't need to be awaited one by one.
 * Throwing from `run` aborts the transaction. `run` must only await requests of this transaction:
 * awaiting anything else lets the transaction commit early.
 */
export async function withTransaction<T>(
	storeNames: StoreName[],
	mode: IDBTransactionMode,
	run: (tx: IDBTransaction) => T | Promise<T>
): Promise<T> {
	const db = await openDatabase();
	const tx = db.transaction(storeNames, mode);
	const committed = new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onabort = () => reject(tx.error ?? new BackendError('Transaction aborted'));
	});

	try {
		const [result] = await Promise.all([run(tx), committed]);
		return result;
	} catch (error) {
		try {
			tx.abort();
		} catch {
			// Already committed or aborted.
		}
		await committed.catch(() => undefined);
		throw error;
	}
}

export function getAll<T>(storeName: StoreName): Promise<T[]> {
	return withTransaction([storeName], 'readonly', (tx) =>
		promisify(tx.objectStore(storeName).getAll())
	);
}

export async function exists(store: IDBObjectStore, key: IDBValidKey): Promise<boolean> {
	return (await promisify(store.count(key))) > 0;
}

/** The records of every store, with their keys: the ones of the orders keep them in insertion order. */
type Snapshot = { storeName: StoreName; keys: IDBValidKey[]; values: unknown[] }[];

function readSnapshot(tx: IDBTransaction): Promise<Snapshot> {
	return Promise.all(
		STORE_NAMES.map(async (storeName) => {
			const store = tx.objectStore(storeName);
			const [keys, values] = await Promise.all([
				promisify(store.getAllKeys()),
				promisify(store.getAll())
			]);
			return { storeName, keys, values };
		})
	);
}

function writeSnapshot(tx: IDBTransaction, snapshot: Snapshot): void {
	for (const { storeName, keys, values } of snapshot) {
		const store = tx.objectStore(storeName);
		store.clear();
		values.forEach((value, index) => {
			if (store.keyPath === null) {
				store.put(value, keys[index]);
			} else {
				store.put(value);
			}
		});
	}
}

export async function databaseNames(): Promise<string[]> {
	const databases = await indexedDB.databases();
	return databases.flatMap((database) => database.name ?? []);
}

/**
 * Creates the database `name` with the schema and the records of the main database, written by the
 * transaction that creates it so that a failure leaves nothing behind. Returns `false` without
 * touching anything when the name is already taken.
 */
export async function copyDatabase(name: string): Promise<boolean> {
	if ((await databaseNames()).includes(name)) {
		return false;
	}
	const snapshot = await withTransaction([...STORE_NAMES], 'readonly', readSnapshot);
	const request = indexedDB.open(name, migrations.length);
	request.onupgradeneeded = () => {
		for (const migrate of migrations) {
			migrate(request.result);
		}
		writeSnapshot(request.transaction as IDBTransaction, snapshot);
	};
	(await promisify(request)).close();
	return true;
}

/**
 * Replaces the records of the main database with the ones of the database `name`, which is only
 * read. Returns `false` when it doesn't have the schema of the main database.
 */
export async function restoreDatabase(name: string): Promise<boolean> {
	const snapshot = await readDatabase(name);
	if (!snapshot) {
		return false;
	}
	await withTransaction([...STORE_NAMES], 'readwrite', (tx) => writeSnapshot(tx, snapshot));
	return true;
}

async function readDatabase(name: string): Promise<Snapshot | null> {
	// Without a version, an existing database opens as is, while a missing one would be created.
	const request = indexedDB.open(name);
	request.onupgradeneeded = () => request.transaction?.abort();
	const db = await promisify(request);
	try {
		const hasSchema =
			db.version <= migrations.length &&
			STORE_NAMES.every((storeName) => db.objectStoreNames.contains(storeName));
		return hasSchema ? await readSnapshot(db.transaction([...STORE_NAMES], 'readonly')) : null;
	} finally {
		db.close();
	}
}
