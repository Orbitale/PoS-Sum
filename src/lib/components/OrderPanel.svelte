<script lang="ts">
	import type { CartItem } from '$lib/types';
	import { formatPrice } from '$lib/utils/format';
	import { t } from '$lib/i18n';

	interface Props {
		items: CartItem[];
		onIncrease: (productId: string) => void;
		onDecrease: (productId: string) => void;
		onCheckout: () => void;
		onClear: () => void;
	}

	let { items, onIncrease, onDecrease, onCheckout, onClear }: Props = $props();

	let total = $derived(items.reduce((sum, i) => sum + i.product.price * i.quantity, 0));
	let isEmpty = $derived(items.length === 0);
</script>

<aside class="d-flex flex-column h-100 border-start order-panel">
	<h2 class="m-0 p-3 fs-5 border-bottom">{$t('order.currentOrder')}</h2>

	{#if isEmpty}
		<p class="p-4 text-muted text-center">{$t('order.emptyMessage')}</p>
	{:else}
		<ul class="list-unstyled m-0 flex-grow-1 overflow-auto">
			{#each items as item (item.product.id)}
				<li class="d-flex align-items-center justify-content-between gap-2 px-3 py-2 border-bottom">
					<div class="d-flex flex-column">
						<span class="fw-semibold" style="font-size: 0.95rem;">{item.product.name}</span>
						<span class="small text-muted">{formatPrice(item.product.price)}</span>
					</div>
					<div class="d-flex align-items-center gap-1">
						<button
							class="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center fw-bold"
							style="width: 32px; height: 32px; padding: 0; font-size: 1.1rem;"
							onclick={() => onDecrease(item.product.id)}
						>-</button>
						<span class="fw-semibold text-center" style="min-width: 24px;">{item.quantity}</span>
						<button
							class="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center fw-bold"
							style="width: 32px; height: 32px; padding: 0; font-size: 1.1rem;"
							onclick={() => onIncrease(item.product.id)}
						>+</button>
					</div>
					<span class="fw-semibold text-end" style="min-width: 60px;">{formatPrice(item.product.price * item.quantity)}</span>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="border-top border-2 p-3 mt-auto">
		<div class="d-flex justify-content-between fs-5 fw-bold mb-2">
			<span>{$t('order.total')}</span>
			<span>{formatPrice(total)}</span>
		</div>
		<div class="d-flex gap-2">
			<button class="btn btn-secondary flex-fill fw-semibold" style="min-height: 48px;" disabled={isEmpty} onclick={onClear}>{$t('order.clear')}</button>
			<button class="btn btn-success flex-fill fw-semibold" style="min-height: 48px;" disabled={isEmpty} onclick={onCheckout}>{$t('order.checkout')}</button>
		</div>
	</div>
</aside>

<style>
	@media (max-width:767px) {
		.order-panel {
				max-height: 55%;
		}
	}
</style>
