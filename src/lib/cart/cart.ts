import type { CartItem, CreateOrderPayload, PaymentMethod, Product } from '#lib/types.ts';
import { createCustomProduct, isOpenPriceForTotal } from '#lib/catalog/index.ts';
import { parseOptionalFloat } from '#lib/money/index.ts';

export function lineTotal(item: CartItem): number {
	return item.unitPrice * item.quantity;
}

export function cartTotal(items: CartItem[]): number {
	return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

/** Lowest total the order can be edited down to: open-price lines count as 0. */
export function cartMinimumTotal(items: CartItem[]): number {
	return items.reduce(
		(sum, item) => (isOpenPriceForTotal(item.product) ? sum : sum + lineTotal(item)),
		0
	);
}

export function hasOpenPriceItems(items: CartItem[]): boolean {
	return items.some((item) => isOpenPriceForTotal(item.product));
}

export function addProductToCart(items: CartItem[], product: Product): CartItem[] {
	const existing = items.find((i) => i.product.id === product.id);
	if (existing) {
		return items.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
	}
	return [...items, { product, quantity: 1, unitPrice: product.price, comment: '' }];
}

export function addCustomProductToCart(
	items: CartItem[],
	name: string,
	priceCents: number
): CartItem[] {
	const product = createCustomProduct(name, priceCents);
	return [...items, { product, quantity: 1, unitPrice: priceCents, comment: '' }];
}

export function increaseCartQuantity(items: CartItem[], productId: string): CartItem[] {
	return items.map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity + 1 } : i));
}

export function decreaseCartQuantity(items: CartItem[], productId: string): CartItem[] {
	return items
		.map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i))
		.filter((i) => i.quantity > 0);
}

export function setCartUnitPrice(
	items: CartItem[],
	productId: string,
	unitPrice: number
): CartItem[] {
	return items.map((i) => (i.product.id === productId ? { ...i, unitPrice } : i));
}

export function setCartComment(items: CartItem[], productId: string, comment: string): CartItem[] {
	return items.map((i) => (i.product.id === productId ? { ...i, comment } : i));
}

/**
 * Spreads the difference between the current and the desired total evenly over the open-price
 * lines, without letting any price go below 0.
 */
export function redistributeOpenPricesToTotal(
	items: CartItem[],
	desiredTotalCents: number
): CartItem[] {
	const openIndices = items.flatMap((item, i) => (isOpenPriceForTotal(item.product) ? [i] : []));
	if (openIndices.length === 0) {
		return items;
	}

	const minimumTotal = cartMinimumTotal(items);
	const openTarget = Math.max(desiredTotalCents, minimumTotal) - minimumTotal;
	const quantities = openIndices.map((index) => items[index].quantity);
	const lines = openIndices.map((index) => lineTotal(items[index]));
	const delta = openTarget - lines.reduce((sum, line) => sum + line, 0);

	// Same change on every line, the remainder going to the first ones.
	const share = Math.trunc(delta / lines.length);
	let remainder = delta - share * lines.length;
	const newLines = lines.map((line) => {
		const extra = Math.sign(remainder);
		remainder -= extra;
		return Math.max(0, line + share + extra);
	});

	// Lines stopped at 0 couldn't take their whole part of a cut: the others take the rest.
	let excess = newLines.reduce((sum, line) => sum + line, 0) - openTarget;
	while (excess > 0) {
		const active = newLines.flatMap((line, i) => (line > 0 ? [i] : []));
		const cut = Math.max(1, Math.trunc(excess / active.length));
		for (const i of active) {
			const amount = Math.min(newLines[i], cut, excess);
			newLines[i] -= amount;
			excess -= amount;
		}
	}

	// Round unit prices down to whole cents, then add cents back while the target allows it.
	const unitPrices = newLines.map((line, i) => Math.floor(line / quantities[i]));
	let missing = openTarget - unitPrices.reduce((sum, price, i) => sum + price * quantities[i], 0);
	let progressed = true;
	while (missing > 0 && progressed) {
		progressed = false;
		quantities.forEach((quantity, i) => {
			if (quantity <= missing) {
				unitPrices[i] += 1;
				missing -= quantity;
				progressed = true;
			}
		});
	}

	return items.map((item, index) => {
		const i = openIndices.indexOf(index);
		return i < 0 ? item : { ...item, unitPrice: unitPrices[i] };
	});
}

export function buildCreateOrderPayload(
	items: CartItem[],
	paymentMethod: PaymentMethod,
	weightInput: string
): CreateOrderPayload {
	return {
		items: items.map((i) => ({
			product_id: i.product.id,
			product_name: i.product.name,
			unit_price: i.unitPrice,
			quantity: i.quantity,
			comment: i.comment
		})),
		payment_method: paymentMethod,
		weight: parseOptionalFloat(weightInput)
	};
}
