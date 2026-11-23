import type { Product } from '#lib/types.ts';

/** Sentinel category used for on-the-fly custom order lines (not in the catalog). */
export const CUSTOM_PRODUCT_CATEGORY_ID = '__custom__';

export function isCustomProduct(product: Pick<Product, 'category_id'>): boolean {
	return product.category_id === CUSTOM_PRODUCT_CATEGORY_ID;
}

/** Catalog open-price items that participate in order-total cuts / minimum. */
export function isOpenPriceForTotal(
	product: Pick<Product, 'fixed_price' | 'category_id'>
): boolean {
	return !product.fixed_price && !isCustomProduct(product);
}

/** Lines whose unit price can be edited in the current order. */
export function canEditCartUnitPrice(
	product: Pick<Product, 'fixed_price' | 'category_id'>
): boolean {
	return !product.fixed_price || isCustomProduct(product);
}

export function createCustomProduct(name: string, priceCents: number): Product {
	return {
		id: crypto.randomUUID(),
		name,
		price: priceCents,
		category_id: CUSTOM_PRODUCT_CATEGORY_ID,
		available: true,
		// Editable in the cart via canEditCartUnitPrice; excluded from total cuts.
		fixed_price: true
	};
}
