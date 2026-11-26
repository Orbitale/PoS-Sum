import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { version } from '../../../package.json';
import type {
	Category,
	ConfigurationEntry,
	CreateOrderItemPayload,
	DashboardSummary,
	OrderWithItems,
	PaymentMethod,
	Product
} from '#lib/types.ts';
import { STORE_NAMES, closeDatabase, databaseNames, promisify, withTransaction } from './db.ts';
import { invoke } from './invoke.ts';

beforeEach(async () => {
	await closeDatabase();
	vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

async function makeProduct(
	name: string,
	price: number,
	categoryId: string,
	fixedPrice = true
): Promise<Product> {
	const categories = await invoke<Category[]>('list_categories');
	if (!categories.some((category) => category.id === categoryId)) {
		await invoke('create_category', {
			payload: { id: categoryId, label: categoryId, color: '#888888' }
		});
	}
	return invoke<Product>('create_product', {
		payload: { name, price, category_id: categoryId, fixed_price: fixedPrice }
	});
}

function line(
	product: Product,
	quantity: number,
	changes: Partial<CreateOrderItemPayload> = {}
): CreateOrderItemPayload {
	return {
		product_id: product.id,
		product_name: product.name,
		unit_price: product.price,
		quantity,
		comment: '',
		...changes
	};
}

function createOrder(
	items: CreateOrderItemPayload[],
	paymentMethod: PaymentMethod = 'cash',
	weight: number | null = null,
	customerDetails = ''
): Promise<OrderWithItems> {
	return invoke<OrderWithItems>('create_order', {
		payload: {
			items,
			payment_method: paymentMethod,
			weight,
			customer_details: customerDetails
		}
	});
}

describe('configuration', () => {
	it('provides the default entries, sorted by id', async () => {
		const entries = await invoke<ConfigurationEntry[]>('list_configuration');
		expect(entries.map((entry) => entry.id)).toEqual([
			'company_details',
			'custom_product_enabled',
			'order_weight_enabled',
			'shop_language',
			'shop_name',
			'theme',
			'vat_enabled'
		]);
		expect(entries.find((entry) => entry.id === 'shop_language')?.value).toBe('fr');
	});

	it('restores default entries that were deleted', async () => {
		await invoke('list_configuration');
		await withTransaction(['configuration'], 'readwrite', (tx) => {
			tx.objectStore('configuration').delete('shop_name');
		});
		const entries = await invoke<ConfigurationEntry[]>('list_configuration');
		expect(entries.some((entry) => entry.id === 'shop_name')).toBe(true);
	});

	it('updates a value', async () => {
		await expect(
			invoke('update_configuration', { payload: { id: 'shop_name', value: 'My Shop' } })
		).resolves.toEqual({ id: 'shop_name', name: 'Shop name', value: 'My Shop' });
		const entries = await invoke<ConfigurationEntry[]>('list_configuration');
		expect(entries.find((entry) => entry.id === 'shop_name')?.value).toBe('My Shop');
	});

	it('rejects unknown entries', async () => {
		await expect(
			invoke('update_configuration', { payload: { id: 'unknown', value: 'x' } })
		).rejects.toThrow('Configuration not found: unknown');
	});
});

describe('catalog', () => {
	it('starts empty', async () => {
		await expect(invoke('list_products')).resolves.toEqual([]);
		await expect(invoke('list_categories')).resolves.toEqual([]);
	});

	it('creates available products with a fixed price by default', async () => {
		await invoke('create_category', {
			payload: { id: 'drinks', label: 'Drinks', color: '#3b82f6' }
		});
		const created = await invoke<Product>('create_product', {
			payload: { name: 'Cola', price: 150, category_id: 'drinks' }
		});
		expect(created).toEqual({
			id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/),
			name: 'Cola',
			price: 150,
			category_id: 'drinks',
			available: true,
			fixed_price: true,
			vat: 0
		});
		await expect(invoke('list_products')).resolves.toEqual([created]);
	});

	it('creates products with an open price', async () => {
		const created = await makeProduct('Custom', 1000, 'services', false);
		expect(created.fixed_price).toBe(false);
	});

	it('stores fractional VAT rates', async () => {
		await invoke('create_category', {
			payload: { id: 'food', label: 'Food', color: '#3b82f6' }
		});
		const created = await invoke<Product>('create_product', {
			payload: { name: 'Meal', price: 1000, category_id: 'food', vat: 5.5 }
		});
		expect(created.vat).toBe(5.5);
	});

	it('rejects overly precise VAT rates', async () => {
		await invoke('create_category', {
			payload: { id: 'food', label: 'Food', color: '#3b82f6' }
		});
		await expect(
			invoke('create_product', {
				payload: { name: 'Meal', price: 1000, category_id: 'food', vat: 5.555 }
			})
		).rejects.toThrow('VAT must');
	});

	it('sorts products by category, then by name', async () => {
		const water = await makeProduct('Water', 100, 'drinks');
		const chips = await makeProduct('Chips', 200, 'snacks');
		const cola = await makeProduct('Cola', 150, 'drinks');
		const products = await invoke<Product[]>('list_products');
		expect(products.map((product) => product.id)).toEqual([cola.id, water.id, chips.id]);
	});

	it('rejects products of unknown categories', async () => {
		await expect(
			invoke('create_product', { payload: { name: 'Ghost', price: 100, category_id: 'nope' } })
		).rejects.toThrow('Insert error: FOREIGN KEY constraint failed');
		await expect(invoke('list_products')).resolves.toEqual([]);
	});

	it('updates products', async () => {
		const product = await makeProduct('Chips', 200, 'snack');
		const payload = {
			id: product.id,
			name: 'Crisps',
			price: 250,
			category_id: 'snack',
			available: false,
			fixed_price: false
		};
		const expected = { ...payload, vat: 0 };
		await expect(invoke('update_product', { payload })).resolves.toEqual(expected);
		await expect(invoke('list_products')).resolves.toEqual([expected]);
	});

	it('rejects updates of unknown products and towards unknown categories', async () => {
		const product = await makeProduct('Chips', 200, 'snack');
		await expect(
			invoke('update_product', { payload: { ...product, id: 'nonexistent' } })
		).rejects.toThrow('Product not found: nonexistent');
		await expect(
			invoke('update_product', { payload: { ...product, category_id: 'nope' } })
		).rejects.toThrow('Update error: FOREIGN KEY constraint failed');
		await expect(invoke('list_products')).resolves.toEqual([product]);
	});

	it('toggles the availability', async () => {
		const product = await makeProduct('Water', 100, 'drinks');
		const toggle = () => invoke('toggle_product_availability', { productId: product.id });
		await expect(toggle()).resolves.toBe(false);
		await expect(toggle()).resolves.toBe(true);
		await expect(toggle()).resolves.toBe(false);
		const [stored] = await invoke<Product[]>('list_products');
		expect(stored.available).toBe(false);
		await expect(invoke('toggle_product_availability', { productId: 'nope' })).rejects.toThrow(
			'Product not found (nope): Query returned no rows'
		);
	});

	it('deletes products, even when they were ordered', async () => {
		const product = await makeProduct('Ordered Item', 200, 'snack');
		await createOrder([line(product, 1)]);
		await invoke('delete_product', { productId: product.id });
		await expect(invoke('list_products')).resolves.toEqual([]);
		await expect(invoke('list_orders')).resolves.toHaveLength(1);
		await expect(invoke('delete_product', { productId: product.id })).rejects.toThrow(
			`Product not found: ${product.id}`
		);
	});

	it('creates, sorts and updates categories', async () => {
		await invoke('create_category', { payload: { id: 'b', label: 'Snacks', color: '#000000' } });
		await invoke('create_category', { payload: { id: 'a', label: 'Drinks', color: '#000000' } });
		await expect(
			invoke('update_category', { payload: { id: 'b', label: 'Bites', color: '#ff0000' } })
		).resolves.toEqual({ id: 'b', label: 'Bites', color: '#ff0000' });
		await expect(invoke('list_categories')).resolves.toEqual([
			{ id: 'b', label: 'Bites', color: '#ff0000' },
			{ id: 'a', label: 'Drinks', color: '#000000' }
		]);
	});

	it('rejects duplicate and unknown categories', async () => {
		const payload = { id: 'drinks', label: 'Drinks', color: '#3b82f6' };
		await invoke('create_category', { payload });
		await expect(invoke('create_category', { payload })).rejects.toThrow(
			'Insert error: UNIQUE constraint failed: categories.id'
		);
		await expect(
			invoke('update_category', { payload: { ...payload, id: 'nope' } })
		).rejects.toThrow('Category not found: nope');
		await expect(invoke('delete_category', { categoryId: 'nope' })).rejects.toThrow(
			'Category not found: nope'
		);
	});

	it('only deletes categories without products', async () => {
		await makeProduct('Item', 100, 'snack');
		await invoke('create_category', { payload: { id: 'empty', label: 'Empty', color: '#ff0000' } });
		await expect(invoke('delete_category', { categoryId: 'snack' })).rejects.toThrow(
			"Cannot delete category 'snack': it is referenced by 1 product(s)"
		);
		await invoke('delete_category', { categoryId: 'empty' });
		const categories = await invoke<Category[]>('list_categories');
		expect(categories.map((category) => category.id)).toEqual(['snack']);
	});
});

describe('orders', () => {
	it('stores order vat_total at checkout', async () => {
		const beer = await makeProduct('Beer', 300, 'drinks');
		const order = await createOrder([line(beer, 1, { vat: 5.5 })]);
		expect(order.vat_total).toBe(17);
		const [stored] = await invoke<OrderWithItems[]>('list_orders');
		expect(stored.vat_total).toBe(17);
	});

	it('creates and lists orders', async () => {
		const product = await makeProduct('Candy', 50, 'sucreries');
		const order = await createOrder([line(product, 3)]);
		expect(order).toEqual({
			id: expect.any(String),
			created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
			total: 150,
			vat_total: 0,
			payment_method: 'cash',
			weight: null,
			customer_details: '',
			items: [
				{
					id: expect.any(String),
					order_id: order.id,
					product_id: product.id,
					product_name: 'Candy',
					unit_price: 50,
					quantity: 3,
					total: 150,
					comment: '',
					vat: 0
				}
			]
		});
		await expect(invoke('list_orders')).resolves.toEqual([order]);
	});

	it('updates order details', async () => {
		const product = await makeProduct('Tea', 200, 'boissons');
		const order = await createOrder([line(product, 1)], 'cash', null, 'Alice');

		const updated = await invoke<OrderWithItems>('update_order', {
			payload: {
				id: order.id,
				weight: 2,
				customer_details: 'Bob Martin'
			}
		});
		expect(updated.payment_method).toBe('cash');
		expect(updated.weight).toBe(2);
		expect(updated.customer_details).toBe('Bob Martin');

		const [stored] = await invoke<OrderWithItems[]>('list_orders');
		expect(stored).toMatchObject({
			id: order.id,
			payment_method: 'cash',
			weight: 2,
			customer_details: 'Bob Martin'
		});
	});

	it('stores customer details on the order', async () => {
		const product = await makeProduct('Tea', 200, 'boissons');
		const order = await createOrder([line(product, 1)], 'card', null, 'Alice Martin\nLyon');
		expect(order.customer_details).toBe('Alice Martin\nLyon');

		const [stored] = await invoke<OrderWithItems[]>('list_orders');
		expect(stored.customer_details).toBe('Alice Martin\nLyon');
	});

	it('keeps custom prices, comments, the weight and the order of items', async () => {
		const scarf = await makeProduct('Scarf', 1000, 'accessoires');
		const jacket = await makeProduct('Jacket', 5000, 'hauts', false);
		const order = await createOrder(
			[line(scarf, 2), line(jacket, 1, { unit_price: 4200, comment: 'Slight stain' })],
			'card',
			1.25
		);
		expect(order.total).toBe(6200);

		const [stored] = await invoke<OrderWithItems[]>('list_orders');
		expect(stored.weight).toBe(1.25);
		expect(stored.items.map((item) => [item.product_name, item.unit_price, item.comment])).toEqual([
			['Scarf', 1000, ''],
			['Jacket', 4200, 'Slight stain']
		]);
	});

	it('accepts products that are not in the catalog', async () => {
		const order = await createOrder([
			{ product_id: 'custom', product_name: 'Extra', unit_price: 350, quantity: 1 }
		]);
		expect(order.items[0]).toMatchObject({ product_id: 'custom', total: 350, comment: '' });
	});

	it('rejects invalid orders', async () => {
		const product = await makeProduct('Candy', 50, 'sucreries');
		await expect(createOrder([])).rejects.toThrow('Cannot create an order with no items');
		await expect(createOrder([line(product, 1)], 'cash', -0.5)).rejects.toThrow(
			'Weight must be a non-negative finite number'
		);
		await expect(createOrder([line(product, 1)], 'cash', Infinity)).rejects.toThrow(
			'Weight must be a non-negative finite number'
		);
		await expect(createOrder([line(product, 0)])).rejects.toThrow(
			`Invalid quantity 0 for product ${product.id}`
		);
		await expect(createOrder([line(product, 1)], 'bitcoin' as PaymentMethod)).rejects.toThrow(
			'Invalid argument `payload.payment_method`: expected one of cash, card, check'
		);
		await expect(invoke('list_orders')).resolves.toEqual([]);
	});

	it('lists the newest orders first', async () => {
		const product = await makeProduct('Candy', 50, 'sucreries');
		vi.setSystemTime(new Date('2026-06-01T10:00:00.250Z'));
		const first = await createOrder([line(product, 1)]);
		vi.setSystemTime(new Date('2026-06-01T09:00:00.000Z'));
		const earlier = await createOrder([line(product, 1)]);
		vi.setSystemTime(new Date('2026-06-01T10:00:00.750Z'));
		const sameSecond = await createOrder([line(product, 1)]);

		expect(first.created_at).toBe('2026-06-01T10:00:00Z');
		const orders = await invoke<OrderWithItems[]>('list_orders');
		expect(orders.map((order) => order.id)).toEqual([sameSecond.id, first.id, earlier.id]);
	});
});

describe('dashboard', () => {
	it('is empty without sales', async () => {
		await expect(invoke('get_dashboard_summary')).resolves.toEqual({
			total_revenue: 0,
			total_transactions: 0,
			per_product: [],
			per_payment_method: []
		});
	});

	it('summarizes the sales per product and per payment method', async () => {
		const soda = await makeProduct('Soda', 200, 'boisson-sans-alcool');
		const bar = await makeProduct('Bar', 100, 'snack');
		await createOrder([line(soda, 2)], 'cash');
		await createOrder([line(soda, 1), line(bar, 3)], 'card', 2.5);
		await createOrder([line(bar, 1)], 'check');

		await expect(invoke('get_dashboard_summary')).resolves.toEqual({
			total_revenue: 1000,
			total_transactions: 3,
			per_product: [
				{ product_id: soda.id, product_name: 'Soda', total_quantity: 3, total_revenue: 600 },
				{ product_id: bar.id, product_name: 'Bar', total_quantity: 4, total_revenue: 400 }
			],
			per_payment_method: [
				{ payment_method: 'card', total_revenue: 500, transaction_count: 1 },
				{ payment_method: 'cash', total_revenue: 400, transaction_count: 1 },
				{ payment_method: 'check', total_revenue: 100, transaction_count: 1 }
			]
		});
	});

	it('names products after their latest sale', async () => {
		const soda = await makeProduct('Soda', 200, 'drinks');
		await createOrder([line(soda, 1)]);
		await createOrder([line(soda, 1, { product_name: 'Soda Zero' })]);
		const summary = await invoke<DashboardSummary>('get_dashboard_summary');
		expect(summary.per_product).toEqual([
			{ product_id: soda.id, product_name: 'Soda Zero', total_quantity: 2, total_revenue: 400 }
		]);
	});
});

describe('datasets and resets', () => {
	it('replaces the catalog with the snackbar dataset', async () => {
		await makeProduct('Old', 100, 'old');
		await invoke('load_default_dataset', { dataset: 'snackbar' });
		const products = await invoke<Product[]>('list_products');
		const categories = await invoke<Category[]>('list_categories');
		expect(products).toHaveLength(31);
		expect(categories).toHaveLength(7);
		expect(products.every((product) => product.available && product.fixed_price)).toBe(true);
		expect(categories.some((category) => category.id === 'old')).toBe(false);
		expect(products.find((product) => product.id === 'the')?.vat).toBe(5.5);
		expect(products.find((product) => product.id === 'biere-25cl')?.vat).toBe(20);
		expect(products.find((product) => product.id === 'consigne-verre')?.vat).toBe(0);
		const entries = await invoke<ConfigurationEntry[]>('list_configuration');
		expect(entries.find((entry) => entry.id === 'vat_enabled')?.value).toBe('1');
		const orders = await invoke<OrderWithItems[]>('list_orders');
		expect(orders).toHaveLength(3);
		const evening = orders.find((order) => order.id === 'snackbar-order-evening');
		expect(evening?.vat_total).toBe(120);
		expect(evening?.total).toBe(700);
	});

	it('loads the clothing dataset with open prices', async () => {
		await invoke('load_default_dataset', { dataset: 'clothing' });
		const products = await invoke<Product[]>('list_products');
		expect(products.some((product) => !product.fixed_price)).toBe(true);
		expect(products.some((product) => product.fixed_price)).toBe(true);
		const orders = await invoke<OrderWithItems[]>('list_orders');
		expect(orders).toHaveLength(3);
		const openPrice = orders.find((order) => order.id === 'clothing-order-open-price');
		expect(openPrice?.items[0].unit_price).toBe(4500);
	});

	it('rejects unknown datasets without touching the catalog', async () => {
		const product = await makeProduct('Kept', 100, 'kept');
		await expect(invoke('load_default_dataset', { dataset: 'unknown' })).rejects.toThrow(
			'Unknown default dataset: unknown'
		);
		await expect(invoke('load_default_dataset', { dataset: 'toString' })).rejects.toThrow(
			'Unknown default dataset: toString'
		);
		await expect(invoke('list_products')).resolves.toEqual([product]);
	});

	it('resets the sales only', async () => {
		const product = await makeProduct('Candy', 50, 'sucreries');
		await createOrder([line(product, 1)]);
		await invoke('reset_sales');
		await expect(invoke('list_orders')).resolves.toEqual([]);
		await expect(invoke('list_products')).resolves.toEqual([product]);
	});

	it('resets the whole database to the default configuration', async () => {
		await invoke('load_default_dataset', { dataset: 'snackbar' });
		const [product] = await invoke<Product[]>('list_products');
		await createOrder([line(product, 1)]);
		await invoke('update_configuration', { payload: { id: 'shop_name', value: 'Temp' } });

		await invoke('reset_database');

		await expect(invoke('list_products')).resolves.toEqual([]);
		await expect(invoke('list_categories')).resolves.toEqual([]);
		await expect(invoke('list_orders')).resolves.toEqual([]);
		const entries = await invoke<ConfigurationEntry[]>('list_configuration');
   expect(entries).toHaveLength(7);
		expect(entries.find((entry) => entry.id === 'shop_name')?.value).toBe('');
	});
});

describe('database saves', () => {
	async function productNames(): Promise<string[]> {
		const products = await invoke<Product[]>('list_products');
		return products.map((product) => product.name);
	}

	async function savedProductNames(fileName: string): Promise<string[]> {
		const db = await promisify(indexedDB.open(fileName));
		const products: Product[] = await promisify(
			db.transaction('products').objectStore('products').getAll()
		);
		db.close();
		return products.map((product) => product.name);
	}

	function saveAt(date: Date, label = ''): Promise<string> {
		vi.setSystemTime(date);
		return invoke<string>('create_database_save', { label });
	}

	async function createForeignDatabase(
		name: string,
		version: number,
		upgrade: (tx: IDBTransaction) => void = () => {}
	): Promise<void> {
		const request = indexedDB.open(name, version);
		request.onupgradeneeded = () => upgrade(request.transaction as IDBTransaction);
		(await promisify(request)).close();
	}

	function createStores(tx: IDBTransaction): void {
		for (const storeName of STORE_NAMES) {
			tx.db.createObjectStore(storeName);
		}
	}

	it('names the saves after the local date and the label', async () => {
		await expect(saveAt(new Date(2026, 10, 24, 9, 5, 3))).resolves.toBe(
			'pos_sum_2026-11-24_09_05_03.db'
		);
		await expect(saveAt(new Date(2026, 10, 24, 9, 5, 3), 'end-of-day-2')).resolves.toBe(
			'pos_sum_2026-11-24_09_05_03_end-of-day-2.db'
		);
	});

	it('rejects labels that are not urlized', async () => {
		for (const label of ['../escape', 'a/b', 'a\\b', 'End', 'a b', 'a--b', '-a', 'a-', 'journée']) {
			await expect(invoke('create_database_save', { label })).rejects.toThrow(
				`Invalid save name: ${label}`
			);
		}
		await expect(invoke('list_database_saves')).resolves.toEqual([]);
	});

	it('lists the saves alphabetically, ignoring the other databases', async () => {
		await saveAt(new Date(2026, 10, 24, 14, 0, 0), 'z-last');
		await saveAt(new Date(2026, 10, 23, 18, 30, 0));
		await saveAt(new Date(2026, 10, 24, 14, 0, 0), 'a-first');
		await createForeignDatabase('other.db', 1);
		await createForeignDatabase('pos_sum_notes', 1);

		await expect(invoke('list_database_saves')).resolves.toEqual([
			'pos_sum_2026-11-23_18_30_00.db',
			'pos_sum_2026-11-24_14_00_00_a-first.db',
			'pos_sum_2026-11-24_14_00_00_z-last.db'
		]);
	});

	it('copies the current database', async () => {
		await makeProduct('Cola', 150, 'drinks');
		const fileName = await invoke<string>('create_database_save', { label: 'cola' });
		await makeProduct('Water', 100, 'drinks');

		expect(await savedProductNames(fileName)).toEqual(['Cola']);
	});

	it('never overwrites a save', async () => {
		await makeProduct('Cola', 150, 'drinks');
		const fileName = await saveAt(new Date(2026, 10, 24, 14, 29, 3));
		await makeProduct('Water', 100, 'drinks');

		await expect(saveAt(new Date(2026, 10, 24, 14, 29, 3))).rejects.toThrow(
			'Failed to save database: output file already exists'
		);
		expect(await savedProductNames(fileName)).toEqual(['Cola']);
	});

	it('replaces the current database with a save, which stays untouched', async () => {
		await invoke('update_configuration', { payload: { id: 'shop_name', value: 'Saved shop' } });
		const cola = await makeProduct('Cola', 150, 'drinks');
		vi.setSystemTime(new Date('2026-06-01T10:00:00Z'));
		await createOrder([line(cola, 1)]);
		await createOrder([line(cola, 2)]);
		const orders = await invoke<OrderWithItems[]>('list_orders');
		const fileName = await invoke<string>('create_database_save', { label: '' });
		await invoke('reset_database');
		await makeProduct('Water', 100, 'drinks');

		await invoke('restore_database_save', { fileName });

		expect(await productNames()).toEqual(['Cola']);
		await expect(invoke('list_orders')).resolves.toEqual(orders);
		const entries = await invoke<ConfigurationEntry[]>('list_configuration');
		expect(entries.find((entry) => entry.id === 'shop_name')?.value).toBe('Saved shop');
		expect(await savedProductNames(fileName)).toEqual(['Cola']);
	});

	it('only restores saves', async () => {
		await makeProduct('Cola', 150, 'drinks');
		await createForeignDatabase('other.db', 1, createStores);

		for (const fileName of ['pos_sum', 'pos_sum_missing.db', 'other.db']) {
			await expect(invoke('restore_database_save', { fileName })).rejects.toThrow(
				`Save not found: ${fileName}`
			);
		}
		expect(await productNames()).toEqual(['Cola']);
		expect(await databaseNames()).not.toContain('pos_sum_missing.db');
	});

	it('rejects databases that are not PoS-Sum saves', async () => {
		await makeProduct('Cola', 150, 'drinks');
		await createForeignDatabase('pos_sum_empty.db', 1);
		await createForeignDatabase('pos_sum_newer.db', 1000, createStores);

		for (const fileName of ['pos_sum_empty.db', 'pos_sum_newer.db']) {
			await expect(invoke('restore_database_save', { fileName })).rejects.toThrow(
				'Invalid save: the file is corrupted or is not a PoS-Sum database'
			);
		}
		expect(await productNames()).toEqual(['Cola']);
	});

	it('keeps the current database when a save fails to be restored', async () => {
		await makeProduct('Cola', 150, 'drinks');
		await createForeignDatabase('pos_sum_broken.db', 1, (tx) => {
			createStores(tx);
			tx.objectStore('products').add({ name: 'Without id' }, 'p1');
		});

		await expect(
			invoke('restore_database_save', { fileName: 'pos_sum_broken.db' })
		).rejects.toMatchObject({ name: 'DataError' });
		expect(await productNames()).toEqual(['Cola']);
		await expect(invoke('list_categories')).resolves.toHaveLength(1);
	});
});

describe('commands', () => {
	it('keeps the data when the database is reopened', async () => {
		const product = await makeProduct('Water', 100, 'drinks');
		await closeDatabase();
		await expect(invoke('list_products')).resolves.toEqual([product]);
	});

	it('rejects unknown commands', async () => {
		await expect(invoke('drop_tables')).rejects.toThrow('Command drop_tables not found');
		await expect(invoke('constructor')).rejects.toThrow('Command constructor not found');
	});

	it('rejects invalid arguments', async () => {
		await expect(invoke('update_configuration')).rejects.toThrow(
			'Invalid argument `payload`: expected an object'
		);
		await expect(invoke('delete_product', { product_id: 'p1' })).rejects.toThrow(
			'Invalid argument `productId`: expected a string'
		);
		await expect(
			invoke('create_product', { payload: { name: 'Cola', price: 1.5, category_id: 'drinks' } })
		).rejects.toThrow('Invalid argument `payload.price`: expected an integer');
		await expect(
			createOrder([
				{ product_id: 'p1', product_name: 'P', unit_price: 100, quantity: '2' as never }
			])
		).rejects.toThrow('Invalid argument `payload.items[0].quantity`: expected an integer');
	});

	it('stores plain copies of proxied arguments', async () => {
		const payload = new Proxy({ id: 'drinks', label: 'Drinks', color: '#3b82f6' }, {});
		await invoke('create_category', { payload });
		await expect(invoke('list_categories')).resolves.toEqual([
			{ id: 'drinks', label: 'Drinks', color: '#3b82f6' }
		]);
	});

	it('renders errors as their bare message', async () => {
		const error = await invoke('delete_product', { productId: 'nope' }).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(Error);
		expect(String(error)).toBe('Product not found: nope');
	});

	it('describes the database and the application', async () => {
		await expect(invoke('get_db_path')).resolves.toBe('indexeddb://pos_sum');
		await expect(invoke('get_app_version')).resolves.toEqual({
			version: `v${version}`,
			os: 'browser',
			arch: 'static'
		});
	});
});
