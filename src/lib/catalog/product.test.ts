import { describe, expect, it } from 'vitest';
import {
	CUSTOM_PRODUCT_CATEGORY_ID,
	canEditCartUnitPrice,
	createCustomProduct,
	isCustomProduct,
	isOpenPriceForTotal
} from './product.ts';

describe('catalog product helpers', () => {
	it('detects custom products', () => {
		expect(isCustomProduct({ category_id: CUSTOM_PRODUCT_CATEGORY_ID })).toBe(true);
		expect(isCustomProduct({ category_id: 'drinks' })).toBe(false);
	});

	it('treats only non-custom open-price catalog items as total-cut targets', () => {
		expect(isOpenPriceForTotal({ fixed_price: false, category_id: 'drinks' })).toBe(true);
		expect(isOpenPriceForTotal({ fixed_price: true, category_id: 'drinks' })).toBe(false);
		expect(
			isOpenPriceForTotal({ fixed_price: true, category_id: CUSTOM_PRODUCT_CATEGORY_ID })
		).toBe(false);
		expect(
			isOpenPriceForTotal({ fixed_price: false, category_id: CUSTOM_PRODUCT_CATEGORY_ID })
		).toBe(false);
	});

	it('allows editing open-price and custom lines', () => {
		expect(canEditCartUnitPrice({ fixed_price: false, category_id: 'drinks' })).toBe(true);
		expect(canEditCartUnitPrice({ fixed_price: true, category_id: 'drinks' })).toBe(false);
		expect(
			canEditCartUnitPrice({ fixed_price: true, category_id: CUSTOM_PRODUCT_CATEGORY_ID })
		).toBe(true);
	});

	it('creates a custom product with editable fixed_price semantics', () => {
		const product = createCustomProduct('Extra', 350);
		expect(product.name).toBe('Extra');
		expect(product.price).toBe(350);
		expect(product.category_id).toBe(CUSTOM_PRODUCT_CATEGORY_ID);
		expect(product.available).toBe(true);
		expect(product.fixed_price).toBe(true);
		expect(isCustomProduct(product)).toBe(true);
		expect(isOpenPriceForTotal(product)).toBe(false);
		expect(canEditCartUnitPrice(product)).toBe(true);
		expect(product.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		);
	});
});
