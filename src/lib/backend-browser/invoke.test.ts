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
import { closeDatabase, withTransaction } from './db.ts';
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
	weight: number | null = null
): Promise<OrderWithItems> {
	return invoke<OrderWithItems>('create_order', {
		payload: { items, payment_method: paymentMethod, weight }
	});
}

describe('configuration', () => {
	it('provides the default entries, sorted by id', async () => {
		const entries = await invoke<ConfigurationEntry[]>('list_configuration');
		expect(entries.map((entry) => entry.id)).toEqual([
			'custom_product_enabled',
			'order_weight_enabled',
			'shop_language',
			'shop_name',
			'theme'
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
			fixed_price: true
		});
		await expect(invoke('list_products')).resolves.toEqual([created]);
	});

	it('creates products with an open price', async () => {
		const created = await makeProduct('Custom', 1000, 'services', false);
		expect(created.fixed_price).toBe(false);
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
		await expect(invoke('update_product', { payload })).resolves.toEqual(payload);
		await expect(invoke('list_products')).resolves.toEqual([payload]);
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
	it('creates and lists orders', async () => {
		const product = await makeProduct('Candy', 50, 'sucreries');
		const order = await createOrder([line(product, 3)]);
		expect(order).toEqual({
			id: expect.any(String),
			created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
			total: 150,
			payment_method: 'cash',
			weight: null,
			items: [
				{
					id: expect.any(String),
					order_id: order.id,
					product_id: product.id,
					product_name: 'Candy',
					unit_price: 50,
					quantity: 3,
					total: 150,
					comment: ''
				}
			]
		});
		await expect(invoke('list_orders')).resolves.toEqual([order]);
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
	});

	it('loads the clothing dataset with open prices', async () => {
		await invoke('load_default_dataset', { dataset: 'clothing' });
		const products = await invoke<Product[]>('list_products');
		expect(products.some((product) => !product.fixed_price)).toBe(true);
		expect(products.some((product) => product.fixed_price)).toBe(true);
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
		expect(entries).toHaveLength(5);
		expect(entries.find((entry) => entry.id === 'shop_name')?.value).toBe('');
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
