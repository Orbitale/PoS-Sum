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

describe('lineTotal / cartTotal', () => {
	it('sums line totals', () => {
		const items = [
			item(product({ id: 'a', name: 'A', price: 100 }), 2, 100),
			item(product({ id: 'b', name: 'B', price: 50 }), 1, 50)
		];
		expect(lineTotal(items[0])).toBe(200);
		expect(cartTotal(items)).toBe(250);
	});
});

describe('open-price minimum / detection', () => {
	it('treats open-price catalog lines as 0 in the floor', () => {
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
	it('adds and increments products', () => {
		const p = product({ id: 'a', name: 'A', price: 100 });
		let cart = addProductToCart([], p);
		expect(cart).toHaveLength(1);
		expect(cart[0].quantity).toBe(1);
		cart = addProductToCart(cart, p);
		expect(cart[0].quantity).toBe(2);
	});

	it('adds custom products as distinct lines', () => {
		let cart = addCustomProductToCart([], 'Extra', 250);
		expect(cart).toHaveLength(1);
		expect(cart[0].product.category_id).toBe(CUSTOM_PRODUCT_CATEGORY_ID);
		expect(cart[0].unitPrice).toBe(250);
		cart = addCustomProductToCart(cart, 'Other', 100);
		expect(cart).toHaveLength(2);
	});

	it('increases, decreases, updates price and comment', () => {
		const p = product({ id: 'a', name: 'A', price: 100 });
		let cart = addProductToCart([], p);
		cart = increaseCartQuantity(cart, 'a');
		expect(cart[0].quantity).toBe(2);
		cart = setCartUnitPrice(cart, 'a', 175);
		cart = setCartComment(cart, 'a', 'note');
		expect(cart[0].unitPrice).toBe(175);
		expect(cart[0].comment).toBe('note');
		cart = decreaseCartQuantity(cart, 'a');
		expect(cart[0].quantity).toBe(1);
		cart = decreaseCartQuantity(cart, 'a');
		expect(cart).toHaveLength(0);
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
		expect(next[0].unitPrice).toBe(200);
		expect(next[1].unitPrice).toBe(200);
		expect(next[2].unitPrice).toBe(200);
	});

	it('never goes below the fixed+custom floor', () => {
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

	it('leaves cart unchanged when there are no open-price items', () => {
		const items = [item(product({ id: 'f', name: 'Fixed', price: 100, fixed_price: true }))];
		expect(redistributeOpenPricesToTotal(items, 50)).toEqual(items);
	});
});

describe('buildCreateOrderPayload', () => {
	it('maps cart lines and optional weight', () => {
		const p = product({ id: 'a', name: 'A', price: 100 });
		const cart = setCartComment(addProductToCart([], p), 'a', 'hello');
		const payload = buildCreateOrderPayload(cart, 'cash', '1,5');
		expect(payload.payment_method).toBe('cash');
		expect(payload.weight).toBe(1.5);
		expect(payload.items).toEqual([
			{
				product_id: 'a',
				product_name: 'A',
				unit_price: 100,
				quantity: 1,
				comment: 'hello'
			}
		]);
		expect(buildCreateOrderPayload(cart, 'card', '').weight).toBeNull();
	});
});
