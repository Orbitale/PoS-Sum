import type { Category, OrderWithItems, Product } from '#lib/types.ts';

/** Default shop data: configuration holds only overrides of built-in defaults. */
export interface DefaultDataset {
	categories: Category[];
	products: Product[];
	orders: OrderWithItems[];
	configuration: Record<string, string>;
}