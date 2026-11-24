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
