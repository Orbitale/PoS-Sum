import { IDBFactory, forceCloseDatabase } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, closeDatabase, getAll, promisify, withTransaction } from './db.ts';

beforeEach(async () => {
	await closeDatabase();
	vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const category = { id: 'drinks', label: 'Drinks', color: '#3b82f6' };

function addCategory(): Promise<void> {
	return withTransaction(['categories'], 'readwrite', (tx) => {
		tx.objectStore('categories').add(category);
	});
}

describe('withTransaction', () => {
	it('resolves once the writes are committed', async () => {
		await addCategory();
		await expect(getAll('categories')).resolves.toEqual([category]);
	});

	it('rolls back the writes when the callback throws', async () => {
		await expect(
			withTransaction(['categories'], 'readwrite', async (tx) => {
				const store = tx.objectStore('categories');
				store.add(category);
				await promisify(store.count());
				throw new Error('validation failed');
			})
		).rejects.toThrow('validation failed');
		await expect(getAll('categories')).resolves.toEqual([]);
	});

	it('rejects when a write fails', async () => {
		await addCategory();
		await expect(addCategory()).rejects.toMatchObject({ name: 'ConstraintError' });
	});
});

describe('connection', () => {
	it('reconnects after the browser closed the database', async () => {
		await addCategory();
		const db = await withTransaction(['categories'], 'readonly', (tx) => tx.db);
		forceCloseDatabase(db as unknown as typeof IDBDatabase);
		await expect(getAll('categories')).resolves.toEqual([category]);
	});

	it('lets other tabs delete the database', async () => {
		await addCategory();
		await new Promise((resolve, reject) => {
			const request = indexedDB.deleteDatabase(DB_NAME);
			request.onsuccess = resolve;
			request.onerror = () => reject(request.error);
			request.onblocked = () => reject(new Error('Deletion blocked by an open connection'));
		});
		await expect(getAll('categories')).resolves.toEqual([]);
	});
});
