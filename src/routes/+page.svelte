<script lang="ts">
	import { onMount } from 'svelte';
	import { api_call } from '#lib/api.ts';
	import type { Product, Category, CartItem, OrderWithItems, PaymentMethod } from '#lib/types.ts';
	import {
		addCustomProductToCart,
		addProductToCart,
		buildCreateOrderPayload,
		cartTotal,
		decreaseCartQuantity,
		increaseCartQuantity,
		redistributeOpenPricesToTotal,
		setCartComment,
		setCartUnitPrice
	} from '#lib/cart/index.ts';
	import ProductGrid from '#lib/components/ProductGrid.svelte';
	import OrderPanel from '#lib/components/OrderPanel.svelte';
	import CheckoutModal from '#lib/components/CheckoutModal.svelte';
	import CustomProductModal from '#lib/components/CustomProductModal.svelte';
	import { t } from '#lib/i18n/index.ts';

	let products = $state<Product[]>([]);
	let categories = $state<Category[]>([]);
	let cart = $state<CartItem[]>([]);
	let weight = $state('');
	let isCheckoutOpen = $state(false);
	let isCustomProductOpen = $state(false);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let total = $derived(cartTotal(cart));

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
		cart = addProductToCart(cart, product);
	}

	function addCustomProduct(data: { name: string; priceCents: number; vat?: number }) {
		cart = addCustomProductToCart(cart, data.name, data.priceCents, data.vat ?? 0);
		isCustomProductOpen = false;
	}

	function increaseQuantity(productId: string) {
		cart = increaseCartQuantity(cart, productId);
	}

	function decreaseQuantity(productId: string) {
		cart = decreaseCartQuantity(cart, productId);
		if (cart.length === 0) {
			weight = '';
		}
	}

	function clearCart() {
		cart = [];
		weight = '';
	}

	function setUnitPrice(productId: string, unitPrice: number) {
		cart = setCartUnitPrice(cart, productId, unitPrice);
	}

	function setComment(productId: string, comment: string) {
		cart = setCartComment(cart, productId, comment);
	}

	function setOrderTotal(desiredTotalCents: number) {
		cart = redistributeOpenPricesToTotal(cart, desiredTotalCents);
	}

	async function submitOrder(paymentMethod: PaymentMethod, customerDetails: string) {
		const payload = buildCreateOrderPayload(cart, paymentMethod, weight, customerDetails);

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
		{total}
		onConfirm={submitOrder}
		onCancel={() => (isCheckoutOpen = false)}
	/>
{/if}

{#if isCustomProductOpen}
	<CustomProductModal onConfirm={addCustomProduct} onCancel={() => (isCustomProductOpen = false)} />
{/if}
