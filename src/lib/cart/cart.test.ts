import { describe, expect, it } from 'vitest';
import type { CartItem, Product } from '#lib/types.ts';
import { CUSTOM_PRODUCT_CATEGORY_ID } from '#lib/catalog/index.ts';
import {
	addCustomProductToCart,
	addProductToCart,
	buildCreateOrderPayload,
	cartMinimumTotal,
	cartTotal,
	decreaseCartQuantity,
	hasOpenPriceItems,
	increaseCartQuantity,
	lineTotal,
	redistributeOpenPricesToTotal,
	setCartComment,
	setCartUnitPrice
} from './cart.ts';

function product(partial: Partial<Product> & Pick<Product, 'id' | 'name' | 'price'>): Product {
	return {
		category_id: 'drinks',
		available: true,
		fixed_price: true,
		...partial
	};
}

function item(p: Product, quantity = 1, unitPrice = p.price, comment = ''): CartItem {
	return { product: p, quantity, unitPrice, comment };
}

describe('full sale', () => {
	it('takes a mixed cart from first item to order payload', () => {
		const tea = product({ id: 'tea', name: 'Thé', price: 150, fixed_price: true });
		const soup = product({ id: 'soup', name: 'Soupe', price: 400, fixed_price: false });

		let cart = addProductToCart([], tea);
		cart = addProductToCart(cart, tea);
		cart = addProductToCart(cart, soup);
		cart = addCustomProductToCart(cart, 'Service', 200);
		cart = setCartComment(cart, 'soup', 'sans gluten');

		expect(cartTotal(cart)).toBe(150 * 2 + 400 + 200);
		expect(cartMinimumTotal(cart)).toBe(150 * 2 + 200);
		expect(hasOpenPriceItems(cart)).toBe(true);

		// Only the soup has an open price, so it takes the whole cut.
		cart = redistributeOpenPricesToTotal(cart, 700);
		expect(cartTotal(cart)).toBe(700);
		expect(cart.find((i) => i.product.id === 'tea')?.unitPrice).toBe(150);
		expect(cart.find((i) => i.product.category_id === CUSTOM_PRODUCT_CATEGORY_ID)?.unitPrice).toBe(
			200
		);
		expect(cart.find((i) => i.product.id === 'soup')?.unitPrice).toBe(200);

		const payload = buildCreateOrderPayload(cart, 'cash', '1,25');
		expect(payload.payment_method).toBe('cash');
		expect(payload.weight).toBe(1.25);
		expect(payload.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					product_id: 'tea',
					quantity: 2,
					unit_price: 150
				}),
				expect.objectContaining({
					product_id: 'soup',
					unit_price: 200,
					comment: 'sans gluten'
				}),
				expect.objectContaining({
					product_name: 'Service',
					unit_price: 200
				})
			])
		);
	});
});

describe('totals', () => {
	it('sums line totals', () => {
		const items = [
			item(product({ id: 'a', name: 'A', price: 100 }), 2, 100),
			item(product({ id: 'b', name: 'B', price: 50 }), 1, 50)
		];
		expect(lineTotal(items[0])).toBe(200);
		expect(cartTotal(items)).toBe(250);
	});
});

describe('open prices', () => {
	it('counts open-price lines as 0 in the minimum total', () => {
		const fixed = item(product({ id: 'f', name: 'Fixed', price: 300, fixed_price: true }));
		const open = item(
			product({ id: 'o', name: 'Open', price: 500, fixed_price: false }),
			1,
			500
		);
		const custom = item(
			product({
				id: 'c',
				name: 'Custom',
				price: 200,
				fixed_price: true,
				category_id: CUSTOM_PRODUCT_CATEGORY_ID
			})
		);
		expect(cartMinimumTotal([fixed, open, custom])).toBe(500);
		expect(hasOpenPriceItems([fixed, open])).toBe(true);
		expect(hasOpenPriceItems([fixed, custom])).toBe(false);
	});
});

describe('cart mutations', () => {
	it('adds and increments products by id', () => {
		const p = product({ id: 'a', name: 'A', price: 100 });
		let cart = addProductToCart([], p);
		expect(cart).toHaveLength(1);
		cart = addProductToCart(cart, p);
		expect(cart[0].quantity).toBe(2);
	});

	it('keeps each custom product as its own line', () => {
		let cart = addCustomProductToCart([], 'Extra', 250);
		cart = addCustomProductToCart(cart, 'Other', 100);
		expect(cart).toHaveLength(2);
		expect(cart.every((i) => i.product.category_id === CUSTOM_PRODUCT_CATEGORY_ID)).toBe(true);
	});

	it('removes a line when quantity reaches zero', () => {
		let cart = addProductToCart([], product({ id: 'a', name: 'A', price: 100 }));
		cart = increaseCartQuantity(cart, 'a');
		cart = setCartUnitPrice(cart, 'a', 175);
		cart = setCartComment(cart, 'a', 'note');
		expect(cart[0]).toMatchObject({ unitPrice: 175, comment: 'note', quantity: 2 });
		cart = decreaseCartQuantity(cart, 'a');
		cart = decreaseCartQuantity(cart, 'a');
		expect(cart).toHaveLength(0);
	});

	it('ignores unknown product ids', () => {
		const cart = [item(product({ id: 'a', name: 'A', price: 100 }))];
		expect(increaseCartQuantity(cart, 'missing')).toEqual(cart);
		expect(decreaseCartQuantity(cart, 'missing')).toEqual(cart);
		expect(setCartUnitPrice(cart, 'missing', 9)).toEqual(cart);
		expect(setCartComment(cart, 'missing', 'x')).toEqual(cart);
	});
});

describe('redistributeOpenPricesToTotal', () => {
	it('shares a cut equally across open-price lines', () => {
		const fixed = item(product({ id: 'f', name: 'Fixed', price: 200, fixed_price: true }));
		const openA = item(
			product({ id: 'a', name: 'A', price: 400, fixed_price: false }),
			1,
			400
		);
		const openB = item(
			product({ id: 'b', name: 'B', price: 400, fixed_price: false }),
			1,
			400
		);
		const next = redistributeOpenPricesToTotal([fixed, openA, openB], 600);
		expect(cartTotal(next)).toBe(600);
		expect(next.map((i) => i.unitPrice)).toEqual([200, 200, 200]);
	});

	it('never goes below the minimum total', () => {
		const fixed = item(product({ id: 'f', name: 'Fixed', price: 300, fixed_price: true }));
		const open = item(
			product({ id: 'o', name: 'Open', price: 500, fixed_price: false }),
			1,
			500
		);
		const next = redistributeOpenPricesToTotal([fixed, open], 100);
		expect(cartTotal(next)).toBe(300);
		expect(next[1].unitPrice).toBe(0);
	});

	it('is a no-op when the cart has no open-price items', () => {
		const items = [item(product({ id: 'f', name: 'Fixed', price: 100, fixed_price: true }))];
		expect(redistributeOpenPricesToTotal(items, 50)).toEqual(items);
	});

	it('reaches the exact total with multi-quantity lines', () => {
		const openA = item(
			product({ id: 'a', name: 'A', price: 100, fixed_price: false }),
			3,
			100
		);
		const openB = item(
			product({ id: 'b', name: 'B', price: 100, fixed_price: false }),
			2,
			100
		);
		const next = redistributeOpenPricesToTotal([openA, openB], 497);
		expect(cartTotal(next)).toBe(497);
		expect(next.every((i) => i.unitPrice >= 0)).toBe(true);
	});

	it('raises open prices when the desired total is above current', () => {
		const open = item(
			product({ id: 'a', name: 'A', price: 100, fixed_price: false }),
			2,
			100
		);
		const next = redistributeOpenPricesToTotal([open], 250);
		expect(cartTotal(next)).toBe(250);
		expect(next[0].unitPrice).toBe(125);
	});
});

describe('buildCreateOrderPayload', () => {
	it('maps lines and treats blank/invalid weight as null', () => {
		const cart = setCartComment(
			addProductToCart([], product({ id: 'a', name: 'A', price: 100 })),
			'a',
			'hello'
		);
		expect(buildCreateOrderPayload(cart, 'cash', '1,5').weight).toBe(1.5);
		expect(buildCreateOrderPayload(cart, 'card', '').weight).toBeNull();
		expect(buildCreateOrderPayload(cart, 'check', 'nope').weight).toBeNull();
	});
});
