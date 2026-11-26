import { version } from '../../../package.json';
import type {
	AppVersion,
	Category,
	ConfigurationEntry,
	CreateCategoryPayload,
	CreateOrderPayload,
	CreateProductPayload,
	UpdateOrderPayload,
	DashboardSummary,
	OrderItem,
	OrderWithItems,
	PaymentMethod,
	PaymentMethodBreakdown,
	Product,
	ProductSalesSummary,
	UpdateCategoryPayload,
	UpdateProductPayload
} from '#lib/types.ts';
import {
	DB_NAME,
	STORE_NAMES,
	copyDatabase,
	databaseNames,
	exists,
	getAll,
	promisify,
	restoreDatabase,
	withTransaction
} from './db.ts';
import { BackendError } from './errors.ts';
import { CONFIGURATION_DEFAULTS, DATASETS } from './seed.ts';

/** Same order as SQLite's default collation, which compares strings byte by byte. */
function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

async function ensureConfigurationDefaults(store: IDBObjectStore): Promise<void> {
	const ids = new Set(await promisify(store.getAllKeys()));
	for (const entry of CONFIGURATION_DEFAULTS) {
		if (!ids.has(entry.id)) {
			store.add(entry);
		}
	}
}

async function assertCategoryExists(
	tx: IDBTransaction,
	categoryId: string,
	errorPrefix: string
): Promise<void> {
	if (!(await exists(tx.objectStore('categories'), categoryId))) {
		throw new BackendError(`${errorPrefix}: FOREIGN KEY constraint failed`);
	}
}

export async function listConfiguration(): Promise<ConfigurationEntry[]> {
	return withTransaction(['configuration'], 'readwrite', async (tx) => {
		const store = tx.objectStore('configuration');
		await ensureConfigurationDefaults(store);
		return promisify(store.getAll());
	});
}

export async function updateConfiguration(
	payload: Pick<ConfigurationEntry, 'id' | 'value'>
): Promise<ConfigurationEntry> {
	return withTransaction(['configuration'], 'readwrite', async (tx) => {
		const store = tx.objectStore('configuration');
		await ensureConfigurationDefaults(store);
		const entry: ConfigurationEntry | undefined = await promisify(store.get(payload.id));
		if (!entry) {
			throw new BackendError(`Configuration not found: ${payload.id}`);
		}
		entry.value = payload.value;
		store.put(entry);
		return entry;
	});
}

export async function listCategories(): Promise<Category[]> {
	const categories = await getAll<Category>('categories');
	return categories.sort((a, b) => compare(a.label, b.label));
}

export async function createCategory(payload: CreateCategoryPayload): Promise<Category> {
	const category: Category = { id: payload.id, label: payload.label, color: payload.color };
	return withTransaction(['categories'], 'readwrite', async (tx) => {
		const store = tx.objectStore('categories');
		if (await exists(store, category.id)) {
			throw new BackendError('Insert error: UNIQUE constraint failed: categories.id');
		}
		store.add(category);
		return category;
	});
}

export async function updateCategory(payload: UpdateCategoryPayload): Promise<Category> {
	const category: Category = { id: payload.id, label: payload.label, color: payload.color };
	return withTransaction(['categories'], 'readwrite', async (tx) => {
		const store = tx.objectStore('categories');
		if (!(await exists(store, category.id))) {
			throw new BackendError(`Category not found: ${category.id}`);
		}
		store.put(category);
		return category;
	});
}

export async function listProducts(): Promise<Product[]> {
	const products = await getAll<Product>('products');
	return products.sort((a, b) => compare(a.category_id, b.category_id) || compare(a.name, b.name));
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
	const product: Product = {
		id: crypto.randomUUID(),
		name: payload.name,
		price: payload.price,
		category_id: payload.category_id,
		available: true,
		fixed_price: payload.fixed_price ?? true
	};
	return withTransaction(['categories', 'products'], 'readwrite', async (tx) => {
		await assertCategoryExists(tx, product.category_id, 'Insert error');
		tx.objectStore('products').add(product);
		return product;
	});
}

export async function updateProduct(payload: UpdateProductPayload): Promise<Product> {
	const product: Product = {
		id: payload.id,
		name: payload.name,
		price: payload.price,
		category_id: payload.category_id,
		available: payload.available,
		fixed_price: payload.fixed_price
	};
	return withTransaction(['categories', 'products'], 'readwrite', async (tx) => {
		const store = tx.objectStore('products');
		if (!(await exists(store, product.id))) {
			throw new BackendError(`Product not found: ${product.id}`);
		}
		await assertCategoryExists(tx, product.category_id, 'Update error');
		store.put(product);
		return product;
	});
}

export async function toggleProductAvailability(productId: string): Promise<boolean> {
	return withTransaction(['products'], 'readwrite', async (tx) => {
		const store = tx.objectStore('products');
		const product: Product | undefined = await promisify(store.get(productId));
		if (!product) {
			throw new BackendError(`Product not found (${productId}): Query returned no rows`);
		}
		product.available = !product.available;
		store.put(product);
		return product.available;
	});
}

export async function deleteProduct(productId: string): Promise<void> {
	return withTransaction(['products'], 'readwrite', async (tx) => {
		const store = tx.objectStore('products');
		if (!(await exists(store, productId))) {
			throw new BackendError(`Product not found: ${productId}`);
		}
		store.delete(productId);
	});
}

export async function deleteCategory(categoryId: string): Promise<void> {
	return withTransaction(['categories', 'products'], 'readwrite', async (tx) => {
		const products = tx.objectStore('products').index('category_id');
		const productCount = await promisify(products.count(categoryId));
		if (productCount > 0) {
			throw new BackendError(
				`Cannot delete category '${categoryId}': it is referenced by ${productCount} product(s)`
			);
		}
		const store = tx.objectStore('categories');
		if (!(await exists(store, categoryId))) {
			throw new BackendError(`Category not found: ${categoryId}`);
		}
		store.delete(categoryId);
	});
}

export async function createOrder(payload: CreateOrderPayload): Promise<OrderWithItems> {
	if (payload.items.length === 0) {
		throw new BackendError('Cannot create an order with no items');
	}
	const weight = payload.weight ?? null;
	if (weight !== null && (!Number.isFinite(weight) || weight < 0)) {
		throw new BackendError('Weight must be a non-negative finite number');
	}

	const orderId = crypto.randomUUID();
	const items = payload.items.map((item): OrderItem => {
		if (item.quantity <= 0) {
			throw new BackendError(`Invalid quantity ${item.quantity} for product ${item.product_id}`);
		}
		return {
			id: crypto.randomUUID(),
			order_id: orderId,
			product_id: item.product_id,
			product_name: item.product_name,
			unit_price: item.unit_price,
			quantity: item.quantity,
			total: item.unit_price * item.quantity,
			comment: item.comment ?? ''
		};
	});
	const order: OrderWithItems = {
		id: orderId,
		// Without milliseconds, like the dates of the Tauri app: CSV exports show them verbatim.
		created_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
		total: items.reduce((sum, item) => sum + item.total, 0),
		payment_method: payload.payment_method,
		weight,
		customer_details: payload.customer_details?.trim() ?? '',
		items
	};

	await withTransaction(['orders'], 'readwrite', (tx) => {
		tx.objectStore('orders').add(order);
	});
	return order;
}

export async function updateOrder(payload: UpdateOrderPayload): Promise<OrderWithItems> {
	const weight = payload.weight ?? null;
	if (weight !== null && (!Number.isFinite(weight) || weight < 0)) {
		throw new BackendError('Weight must be a non-negative finite number');
	}

	return withTransaction(['orders'], 'readwrite', async (tx) => {
		const store = tx.objectStore('orders');
		const index = store.index('id');
		const key = await promisify(index.getKey(payload.id));
		if (key === undefined) {
			throw new BackendError(`Order not found: ${payload.id}`);
		}
		const order = (await promisify(store.get(key))) as OrderWithItems;
		const updated: OrderWithItems = {
			...order,
			weight,
			customer_details: payload.customer_details.trim()
		};
		store.put(updated, key);
		return updated;
	});
}

export async function listOrders(): Promise<OrderWithItems[]> {
	const orders = await getAll<OrderWithItems>('orders');
	// Orders come in insertion order: reversing them first puts the latest of a same second first.
	return orders
		.reverse()
		.sort((a, b) => compare(b.created_at, a.created_at))
		.map((order) => ({ ...order, customer_details: order.customer_details ?? '' }));
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
	const orders = await getAll<OrderWithItems>('orders');
	const perProduct = new Map<string, ProductSalesSummary>();
	const perPaymentMethod = new Map<PaymentMethod, PaymentMethodBreakdown>();

	for (const order of orders) {
		const payment = perPaymentMethod.get(order.payment_method) ?? {
			payment_method: order.payment_method,
			total_revenue: 0,
			transaction_count: 0
		};
		payment.total_revenue += order.total;
		payment.transaction_count += 1;
		perPaymentMethod.set(order.payment_method, payment);

		for (const item of order.items) {
			const sales = perProduct.get(item.product_id) ?? {
				product_id: item.product_id,
				product_name: item.product_name,
				total_quantity: 0,
				total_revenue: 0
			};
			// Orders come in insertion order: products are named after their latest sale.
			sales.product_name = item.product_name;
			sales.total_quantity += item.quantity;
			sales.total_revenue += item.total;
			perProduct.set(item.product_id, sales);
		}
	}

	return {
		total_revenue: orders.reduce((sum, order) => sum + order.total, 0),
		total_transactions: orders.length,
		per_product: [...perProduct.values()].sort((a, b) => b.total_revenue - a.total_revenue),
		per_payment_method: [...perPaymentMethod.values()].sort((a, b) =>
			compare(a.payment_method, b.payment_method)
		)
	};
}

export async function loadDefaultDataset(dataset: string): Promise<void> {
	if (!Object.hasOwn(DATASETS, dataset)) {
		throw new BackendError(`Unknown default dataset: ${dataset}`);
	}
	const { categories, products } = DATASETS[dataset];

	await withTransaction(['categories', 'products'], 'readwrite', (tx) => {
		const categoryStore = tx.objectStore('categories');
		const productStore = tx.objectStore('products');
		categoryStore.clear();
		productStore.clear();
		for (const category of categories) {
			categoryStore.put(category);
		}
		for (const product of products) {
			productStore.put(product);
		}
	});
}

export async function resetDatabase(): Promise<void> {
	await withTransaction([...STORE_NAMES], 'readwrite', async (tx) => {
		for (const storeName of STORE_NAMES) {
			tx.objectStore(storeName).clear();
		}
		await ensureConfigurationDefaults(tx.objectStore('configuration'));
	});
}

export async function resetSales(): Promise<void> {
	await withTransaction(['orders'], 'readwrite', (tx) => {
		tx.objectStore('orders').clear();
	});
}

export async function getDbPath(): Promise<string> {
	return `indexeddb://${DB_NAME}`;
}

/** Same names as the saves of the Tauri app: the saves modal previews them. */
function saveFileName(date: Date, label: string): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map(pad).join('_');
	if (label === '') {
		return `pos_sum_${day}_${time}.db`;
	}
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(label)) {
		throw new BackendError(`Invalid save name: ${label}`);
	}
	return `pos_sum_${day}_${time}_${label}.db`;
}

export async function listDatabaseSaves(): Promise<string[]> {
	const names = await databaseNames();
	return names.filter((name) => name.startsWith('pos_sum') && name.endsWith('.db')).sort(compare);
}

export async function createDatabaseSave(label: string): Promise<string> {
	const fileName = saveFileName(new Date(), label);
	if (!(await copyDatabase(fileName))) {
		throw new BackendError('Failed to save database: output file already exists');
	}
	return fileName;
}

export async function restoreDatabaseSave(fileName: string): Promise<void> {
	if (!(await listDatabaseSaves()).includes(fileName)) {
		throw new BackendError(`Save not found: ${fileName}`);
	}
	if (!(await restoreDatabase(fileName))) {
		throw new BackendError('Invalid save: the file is corrupted or is not a PoS-Sum database');
	}
}

export async function getAppVersion(): Promise<AppVersion> {
	return { version: `v${version}`, os: 'browser', arch: 'static' };
}
