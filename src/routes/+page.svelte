<script lang="ts">
	import { onMount } from 'svelte';
	import { api_call } from '#lib/api.ts';
	import type {
		Product,
		Category,
		CartItem,
		OrderWithItems,
		CreateOrderPayload
	} from '#lib/types.ts';
	import ProductGrid from '#lib/components/ProductGrid.svelte';
	import OrderPanel from '#lib/components/OrderPanel.svelte';
	import CheckoutModal from '#lib/components/CheckoutModal.svelte';
	import { t } from '#lib/i18n/index.ts';

	let products = $state<Product[]>([]);
	let categories = $state<Category[]>([]);
	let cart = $state<CartItem[]>([]);
	let weight = $state('');
	let isCheckoutOpen = $state(false);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let cartTotal = $derived(cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0));

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
			cart = [...cart, { product, quantity: 1 }];
		}
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

	function parseWeight(value: string): number | null {
		const trimmed = value.trim();
		if (trimmed === '') {
			return null;
		}
		const parsed = parseFloat(trimmed.replace(',', '.'));
		return Number.isNaN(parsed) ? null : parsed;
	}

	async function submitOrder(paymentMethod: 'cash' | 'card') {
		const payload: CreateOrderPayload = {
			items: cart.map((i) => ({
				product_id: i.product.id,
				product_name: i.product.name,
				unit_price: i.product.price,
				quantity: i.quantity
			})),
			payment_method: paymentMethod,
			weight: parseWeight(weight),
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
		<div class="d-flex align-items-center justify-content-center text-muted fs-5 flex-grow-1">{$t('sales.loading')}</div>
	{:else if error}
		<div class="d-flex align-items-center justify-content-center text-danger fs-5 flex-grow-1">{error}</div>
	{:else}
		<main class="flex-grow-1 overflow-auto">
			<ProductGrid {products} {categories} onProductClick={addToCart} />
		</main>
		<OrderPanel
			items={cart}
			{weight}
			onWeightChange={(value) => (weight = value)}
			onIncrease={increaseQuantity}
			onDecrease={decreaseQuantity}
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
