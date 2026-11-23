import type { CartItem, CreateOrderPayload, PaymentMethod, Product } from '#lib/types.ts';
import { createCustomProduct, isOpenPriceForTotal } from '#lib/catalog/index.ts';
import { parseOptionalFloat } from '#lib/money/index.ts';

export function lineTotal(item: CartItem): number {
	return item.unitPrice * item.quantity;
}

export function cartTotal(items: CartItem[]): number {
	return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

/**
 * Floor for editable order totals: open-price catalog lines treated as 0;
 * fixed and custom lines keep their current amounts.
 */
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
		return items.map((i) =>
			i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
		);
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
	return items.map((i) =>
		i.product.id === productId ? { ...i, quantity: i.quantity + 1 } : i
	);
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

export function setCartComment(
	items: CartItem[],
	productId: string,
	comment: string
): CartItem[] {
	return items.map((i) => (i.product.id === productId ? { ...i, comment } : i));
}

/**
 * Adjust open-price lines so the cart total matches `desiredTotalCents`.
 * The price cut/increase is shared equally across open-priced line totals.
 * Unit prices never go below 0. Custom and fixed lines are unchanged.
 */
export function redistributeOpenPricesToTotal(
	items: CartItem[],
	desiredTotalCents: number
): CartItem[] {
	const openIndices: number[] = [];
	for (let i = 0; i < items.length; i++) {
		if (isOpenPriceForTotal(items[i].product)) {
			openIndices.push(i);
		}
	}
	if (openIndices.length === 0) {
		return items;
	}

	const fixedSum = cartMinimumTotal(items);
	const currentLines = openIndices.map((idx) => lineTotal(items[idx]));
	const currentOpenSum = currentLines.reduce((sum, value) => sum + value, 0);
	const targetOpenSum = Math.max(desiredTotalCents, fixedSum) - fixedSum;
	const delta = targetOpenSum - currentOpenSum;

	const n = openIndices.length;
	const baseShare = Math.trunc(delta / n);
	let remainder = delta - baseShare * n;

	const newLines = currentLines.map((currentLine) => {
		let share = baseShare;
		if (remainder > 0) {
			share += 1;
			remainder -= 1;
		} else if (remainder < 0) {
			share -= 1;
			remainder += 1;
		}
		return Math.max(0, currentLine + share);
	});

	let assigned = newLines.reduce((sum, value) => sum + value, 0);
	let leftover = assigned - targetOpenSum;
	while (leftover > 0) {
		const active = newLines.map((value, i) => (value > 0 ? i : -1)).filter((i) => i >= 0);
		if (active.length === 0) {
			break;
		}
		const cutEach = Math.max(1, Math.trunc(leftover / active.length));
		for (const i of active) {
			if (leftover <= 0) {
				break;
			}
			const cut = Math.min(newLines[i], cutEach, leftover);
			newLines[i] -= cut;
			leftover -= cut;
		}
	}
	leftover = targetOpenSum - newLines.reduce((sum, value) => sum + value, 0);
	for (let i = 0; leftover > 0; i++) {
		newLines[i % n] += 1;
		leftover -= 1;
	}

	const newUnitPrices = openIndices.map((idx, i) => {
		const qty = items[idx].quantity;
		return Math.max(0, Math.floor(newLines[i] / qty));
	});

	let actualOpenSum = openIndices.reduce(
		(sum, idx, i) => sum + newUnitPrices[i] * items[idx].quantity,
		0
	);
	let drift = targetOpenSum - actualOpenSum;
	let guard = 0;
	while (drift !== 0 && guard < 10000) {
		guard += 1;
		if (drift > 0) {
			let progressed = false;
			for (let i = 0; i < n; i++) {
				const qty = items[openIndices[i]].quantity;
				if (qty <= drift) {
					newUnitPrices[i] += 1;
					drift -= qty;
					progressed = true;
					if (drift === 0) {
						break;
					}
				}
			}
			if (!progressed) {
				break;
			}
		} else {
			let progressed = false;
			for (let i = 0; i < n; i++) {
				if (newUnitPrices[i] <= 0) {
					continue;
				}
				const qty = items[openIndices[i]].quantity;
				newUnitPrices[i] -= 1;
				drift += qty;
				progressed = true;
				if (drift >= 0) {
					break;
				}
			}
			if (!progressed) {
				break;
			}
		}
	}

	return items.map((item, idx) => {
		const openPos = openIndices.indexOf(idx);
		if (openPos < 0) {
			return item;
		}
		return { ...item, unitPrice: newUnitPrices[openPos] };
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
