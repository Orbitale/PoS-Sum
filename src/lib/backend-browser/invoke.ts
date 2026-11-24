import type { Category, PaymentMethod } from '#lib/types.ts';
import { Args } from './args.ts';
import {
	createCategory,
	createOrder,
	createProduct,
	deleteCategory,
	deleteProduct,
	getAppVersion,
	getDashboardSummary,
	getDbPath,
	listCategories,
	listConfiguration,
	listOrders,
	listProducts,
	loadDefaultDataset,
	resetDatabase,
	resetSales,
	toggleProductAvailability,
	updateCategory,
	updateConfiguration,
	updateProduct
} from './commands.ts';
import { BackendError } from './errors.ts';

const PAYMENT_METHODS: readonly PaymentMethod[] = ['cash', 'card', 'check'];

function readCategory(args: Args): Category {
	const payload = args.object('payload');
	return {
		id: payload.string('id'),
		label: payload.string('label'),
		color: payload.string('color')
	};
}

/**
 * Tauri passes the parameters of the Rust commands under camelCase keys (`product_id` becomes
 * `productId`), while payload fields keep their snake_case names.
 */
const commands: Record<string, (args: Args) => Promise<unknown>> = {
	list_configuration: listConfiguration,
	update_configuration: (args) => {
		const payload = args.object('payload');
		return updateConfiguration({ id: payload.string('id'), value: payload.string('value') });
	},
	list_categories: listCategories,
	create_category: (args) => createCategory(readCategory(args)),
	update_category: (args) => updateCategory(readCategory(args)),
	list_products: listProducts,
	create_product: (args) => {
		const payload = args.object('payload');
		return createProduct({
			name: payload.string('name'),
			price: payload.integer('price'),
			category_id: payload.string('category_id'),
			fixed_price: payload.boolean('fixed_price', true)
		});
	},
	update_product: (args) => {
		const payload = args.object('payload');
		return updateProduct({
			id: payload.string('id'),
			name: payload.string('name'),
			price: payload.integer('price'),
			category_id: payload.string('category_id'),
			available: payload.boolean('available'),
			fixed_price: payload.boolean('fixed_price')
		});
	},
	toggle_product_availability: (args) => toggleProductAvailability(args.string('productId')),
	delete_product: (args) => deleteProduct(args.string('productId')),
	delete_category: (args) => deleteCategory(args.string('categoryId')),
	create_order: (args) => {
		const payload = args.object('payload');
		return createOrder({
			items: payload.list('items').map((item) => ({
				product_id: item.string('product_id'),
				product_name: item.string('product_name'),
				unit_price: item.integer('unit_price'),
				quantity: item.integer('quantity'),
				comment: item.string('comment', '')
			})),
			payment_method: payload.oneOf('payment_method', PAYMENT_METHODS),
			weight: payload.optionalNumber('weight')
		});
	},
	list_orders: listOrders,
	get_dashboard_summary: getDashboardSummary,
	load_default_dataset: (args) => loadDefaultDataset(args.string('dataset')),
	reset_database: resetDatabase,
	reset_sales: resetSales,
	get_db_path: getDbPath,
	get_app_version: getAppVersion
};

/** Same contract as Tauri's `invoke`, with the data stored in the browser's IndexedDB. */
export async function invoke<T>(command: string, params: Record<string, unknown> = {}): Promise<T> {
	if (!Object.hasOwn(commands, command)) {
		throw new BackendError(`Command ${command} not found`);
	}
	return (await commands[command](new Args(params))) as T;
}
