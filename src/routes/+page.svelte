<script lang="ts">
	import { onMount } from 'svelte';
	import { api_call } from '#lib/api.ts';
	import type {
		Product,
		Category,
		CartItem,
		OrderWithItems,
		CreateOrderPayload,
		PaymentMethod
	} from '#lib/types.ts';
	import ProductGrid from '#lib/components/ProductGrid.svelte';
	import OrderPanel from '#lib/components/OrderPanel.svelte';
	import CheckoutModal from '#lib/components/CheckoutModal.svelte';
	import CustomProductModal from '#lib/components/CustomProductModal.svelte';
	import { t } from '#lib/i18n/index.ts';
	import { CUSTOM_PRODUCT_CATEGORY_ID, isOpenPriceForTotal } from '#lib/utils/product.ts';

	let products = $state<Product[]>([]);
	let categories = $state<Category[]>([]);
	let cart = $state<CartItem[]>([]);
	let weight = $state('');
	let isCheckoutOpen = $state(false);
	let isCustomProductOpen = $state(false);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let cartTotal = $derived(cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));

	onMount(async () => {
		try {
			[products, categories] = await Promise.all([
				api_call<Product[]>('list_products'),
				api_call<Category[]>('list_categories')
			]);
		} catch (e) {
			error = $t('sales.loadError', { error: String(e) });
		} finally {
			isLoading = false;
		}
	});

	function addToCart(product: Product) {
		const existing = cart.find((i) => i.product.id === product.id);
		if (existing) {
			cart = cart.map((i) =>
				i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
			);
		} else {
			cart = [...cart, { product, quantity: 1, unitPrice: product.price, comment: '' }];
		}
	}

	function addCustomProduct(data: { name: string; priceCents: number }) {
		const product: Product = {
			id: crypto.randomUUID(),
			name: data.name,
			price: data.priceCents,
			category_id: CUSTOM_PRODUCT_CATEGORY_ID,
			available: true,
			// Editable in the cart, but excluded from open-price total cuts via category.
			fixed_price: true
		};
		cart = [...cart, { product, quantity: 1, unitPrice: data.priceCents, comment: '' }];
		isCustomProductOpen = false;
	}

	function increaseQuantity(productId: string) {
		cart = cart.map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity + 1 } : i));
	}

	function decreaseQuantity(productId: string) {
		cart = cart
			.map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i))
			.filter((i) => i.quantity > 0);
		if (cart.length === 0) {
			weight = '';
		}
	}

	function clearCart() {
		cart = [];
		weight = '';
	}

	function setUnitPrice(productId: string, unitPrice: number) {
		cart = cart.map((i) => (i.product.id === productId ? { ...i, unitPrice } : i));
	}

	function setComment(productId: string, comment: string) {
		cart = cart.map((i) => (i.product.id === productId ? { ...i, comment } : i));
	}

	/**
	 * Adjust open-price lines so the cart total matches `desiredTotalCents`.
	 * The price cut/increase is shared equally across open-priced line totals.
	 * Unit prices never go below 0.
	 */
	function setOrderTotal(desiredTotalCents: number) {
		const openIndices: number[] = [];
		for (let i = 0; i < cart.length; i++) {
			if (isOpenPriceForTotal(cart[i].product)) {
				openIndices.push(i);
			}
		}
		if (openIndices.length === 0) {
			return;
		}

		const fixedSum = cart.reduce(
			(sum, item) =>
				isOpenPriceForTotal(item.product) ? sum : sum + item.unitPrice * item.quantity,
			0
		);
		const currentLines = openIndices.map((idx) => cart[idx].unitPrice * cart[idx].quantity);
		const currentOpenSum = currentLines.reduce((sum, value) => sum + value, 0);
		const targetOpenSum = Math.max(desiredTotalCents, fixedSum) - fixedSum;
		const delta = targetOpenSum - currentOpenSum; // negative = price cut

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

		// Re-balance if some lines hit 0 and the equal cut could not be fully applied.
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

		// Convert to unit prices. Snap each line down to a multiple of qty, then
		// distribute any remaining cents by bumping unit prices round-robin.
		const newUnitPrices = openIndices.map((idx, i) => {
			const qty = cart[idx].quantity;
			return Math.max(0, Math.floor(newLines[i] / qty));
		});

		let actualOpenSum = openIndices.reduce(
			(sum, idx, i) => sum + newUnitPrices[i] * cart[idx].quantity,
			0
		);
		let drift = targetOpenSum - actualOpenSum;
		let guard = 0;
		while (drift !== 0 && guard < 10000) {
			guard += 1;
			if (drift > 0) {
				// Prefer items whose qty fits in the remaining drift.
				let progressed = false;
				for (let i = 0; i < n; i++) {
					const qty = cart[openIndices[i]].quantity;
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
					const qty = cart[openIndices[i]].quantity;
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

		cart = cart.map((item, idx) => {
			const openPos = openIndices.indexOf(idx);
			if (openPos < 0) {
				return item;
			}
			return { ...item, unitPrice: newUnitPrices[openPos] };
		});
	}

	function parseWeight(value: string): number | null {
		const trimmed = value.trim();
		if (trimmed === '') {
			return null;
		}
		const parsed = parseFloat(trimmed.replace(',', '.'));
		return Number.isFinite(parsed) ? parsed : null;
	}

	async function submitOrder(paymentMethod: PaymentMethod) {
		const payload: CreateOrderPayload = {
			items: cart.map((i) => ({
				product_id: i.product.id,
				product_name: i.product.name,
				unit_price: i.unitPrice,
				quantity: i.quantity,
				comment: i.comment
			})),
			payment_method: paymentMethod,
			weight: parseWeight(weight)
		};

		try {
			await api_call<OrderWithItems>('create_order', { payload });
			cart = [];
			weight = '';
			isCheckoutOpen = false;
		} catch (e) {
			error = $t('sales.orderError', { error: String(e) });
			isCheckoutOpen = false;
		}
	}
</script>

<div class="d-flex flex-column flex-md-row h-100">
	{#if isLoading}
		<div class="d-flex align-items-center justify-content-center text-muted fs-5 flex-grow-1">
			{$t('sales.loading')}
		</div>
	{:else if error}
		<div class="d-flex align-items-center justify-content-center text-danger fs-5 flex-grow-1">
			{error}
		</div>
	{:else}
		<main class="flex-grow-1 overflow-auto">
			<ProductGrid
				{products}
				{categories}
				onProductClick={addToCart}
				onCreateCustomProduct={() => (isCustomProductOpen = true)}
			/>
		</main>
		<OrderPanel
			items={cart}
			{weight}
			onWeightChange={(value) => (weight = value)}
			onIncrease={increaseQuantity}
			onDecrease={decreaseQuantity}
			onUnitPriceChange={setUnitPrice}
			onCommentChange={setComment}
			onTotalChange={setOrderTotal}
			onCheckout={() => (isCheckoutOpen = true)}
			onClear={clearCart}
		/>
	{/if}
</div>

{#if isCheckoutOpen}
	<CheckoutModal
		items={cart}
		total={cartTotal}
		onConfirm={submitOrder}
		onCancel={() => (isCheckoutOpen = false)}
	/>
{/if}

{#if isCustomProductOpen}
	<CustomProductModal onConfirm={addCustomProduct} onCancel={() => (isCustomProductOpen = false)} />
{/if}
