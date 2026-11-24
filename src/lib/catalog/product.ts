import type { Product } from '#lib/types.ts';

export const CUSTOM_PRODUCT_CATEGORY_ID = '__custom__';

export function isCustomProduct(product: Pick<Product, 'category_id'>): boolean {
	return product.category_id === CUSTOM_PRODUCT_CATEGORY_ID;
}

export function isOpenPriceForTotal(
	product: Pick<Product, 'fixed_price' | 'category_id'>
): boolean {
	return !product.fixed_price && !isCustomProduct(product);
}

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
		// Keeps custom lines out of total edits; their own price stays editable.
		fixed_price: true
	};
}
