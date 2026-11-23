<script lang="ts">
	import { onMount } from 'svelte';
	import type { CartItem } from '#lib/types.ts';
	import { cartMinimumTotal, cartTotal, hasOpenPriceItems } from '#lib/cart/index.ts';
	import { canEditCartUnitPrice, isOpenPriceForTotal } from '#lib/catalog/index.ts';
	import { formatPrice } from '#lib/utils/format.ts';
	import { t } from '#lib/i18n/index.ts';
	import { orderWeightEnabled } from '#lib/stores/app-config.ts';
	import PriceEditModal from './PriceEditModal.svelte';
	import CommentEditModal from './CommentEditModal.svelte';

	interface Props {
		items: CartItem[];
		weight: string;
		onWeightChange: (value: string) => void;
		onIncrease: (productId: string) => void;
		onDecrease: (productId: string) => void;
		onUnitPriceChange: (productId: string, unitPrice: number) => void;
		onCommentChange: (productId: string, comment: string) => void;
		onTotalChange: (totalCents: number) => void;
		onCheckout: () => void;
		onClear: () => void;
	}

	let {
		items,
		weight,
		onWeightChange,
		onIncrease,
		onDecrease,
		onUnitPriceChange,
		onCommentChange,
		onTotalChange,
		onCheckout,
		onClear
	}: Props = $props();

	let priceEditProductId = $state<string | null>(null);
	let commentEditProductId = $state<string | null>(null);
	let totalEditOpen = $state(false);

	let total = $derived(cartTotal(items));
	/** Floor when open-price lines are zeroed; custom lines keep their amount. */
	let minimumTotal = $derived(cartMinimumTotal(items));
	let isEmpty = $derived(items.length === 0);
	let hasOpenPrice = $derived(hasOpenPriceItems(items));

	let priceEditItem = $derived(
		priceEditProductId ? (items.find((i) => i.product.id === priceEditProductId) ?? null) : null
	);
	let commentEditItem = $derived(
		commentEditProductId ? (items.find((i) => i.product.id === commentEditProductId) ?? null) : null
	);

	onMount(() => {
		const tooltips: { dispose: () => void }[] = [];
		const Tooltip = window.bootstrap?.Tooltip;
		if (Tooltip) {
			document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
				tooltips.push(new Tooltip(el));
			});
		}
		return () => {
			for (const tip of tooltips) {
				tip.dispose();
			}
		};
	});

	$effect(() => {
		// Re-init tooltips when cart items change (new 💬 buttons appear).
		items.length;
		const Tooltip = window.bootstrap?.Tooltip;
		if (!Tooltip) return;

		const nodes = document.querySelectorAll('[data-bs-toggle="tooltip"]');
		nodes.forEach((el) => {
			Tooltip.getOrCreateInstance(el);
		});
	});
</script>

<aside class="d-flex flex-column border-start order-panel">
	<h2 class="m-0 p-3 fs-5 border-bottom">{$t('order.currentOrder')}</h2>

	{#if isEmpty}
		<p class="p-4 text-muted text-center">{$t('order.emptyMessage')}</p>
	{:else}
		<table class="table table-bordered">
			<tbody>
				{#each items as item (item.product.id)}
					<tr>
						<td>
							<div class="d-flex flex-wrap align-items-center gap-1">
								<span class="fw-semibold" style="font-size: 0.95rem;">{item.product.name}</span>
							</div>
							<div class="d-flex flex-wrap align-items-center gap-1">
								{#if isOpenPriceForTotal(item.product)}
									<span
										class="small"
										role="button"
										tabindex="0"
										data-bs-toggle="tooltip"
										data-bs-trigger="hover focus click"
										data-bs-title={$t('order.recommendedPriceTooltip')}
										aria-label={$t('order.recommendedPriceTooltip')}
									>
										🕊️
									</span>
								{/if}
								<span class="small text-muted">{formatPrice(item.unitPrice)}</span>
							</div>
						</td>
						<td class="col-sm-3">
							<button
								type="button"
								class="btn btn-secondary text-decoration-none"
								title={$t('order.addComment')}
								aria-label={$t('order.addComment')}
								onclick={() => (commentEditProductId = item.product.id)}
							>
								📝{!item.comment.trim() ? ' ' + $t('order.addCommentSmall') : ''}
							</button>
							<span class="small fst-italic ps-2">{item.comment}</span>
						</td>
						<td class="col-sm-1">
							<div class="d-flex align-items-center gap-1">
								<button
									class="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center fw-bold"
									style="width: 32px; height: 32px; padding: 0; font-size: 1.1rem;"
									onclick={() => onDecrease(item.product.id)}
								>
									&minus;
								</button>
								<span class="fw-semibold text-center" style="min-width: 24px;">
									{item.quantity}
								</span>
								<button
									class="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center fw-bold"
									style="width: 32px; height: 32px; padding: 0; font-size: 1.1rem;"
									onclick={() => onIncrease(item.product.id)}
								>
									&plus;
								</button>
							</div>
						</td>
						<td class="col-sm-2 fw-semibold text-end">
							{#if canEditCartUnitPrice(item.product)}
								<button
									type="button"
									class="btn btn-secondary btn-sm text-decoration-none"
									title={$t('order.editPrice')}
									aria-label={$t('order.editPrice')}
									onclick={() => (priceEditProductId = item.product.id)}
								>
									✏️
								</button>
							{/if}
							{formatPrice(item.unitPrice * item.quantity)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<div class="border-top border-2 p-3 mt-auto">
		{#if $orderWeightEnabled}
			<label class="d-flex flex-column gap-1 fw-semibold mb-2" style="font-size: 0.95rem;">
				{$t('order.weight')}
				<input
					class="form-control"
					type="number"
					inputmode="decimal"
					min="0"
					step="any"
					placeholder={$t('order.weightPlaceholder')}
					value={weight}
					disabled={isEmpty}
					oninput={(e) => onWeightChange(e.currentTarget.value)}
				/>
			</label>
		{/if}
		<div class="d-flex justify-content-between align-items-center mb-2 gap-2">
			<span>
			  <span class="fs-5 fw-bold">{$t('order.total')}</span>
				{#if hasOpenPrice}
					<small class="fs-6 text-sm text-body-secondary fst-italic">({$t('order.recommendedTotalTooltip')})</small>
				{/if}
			</span>
			<span class="d-flex align-items-center gap-1">
				<span>{formatPrice(total)}</span>
				{#if hasOpenPrice}
					<button
						type="button"
						class="btn btn-secondary btn-sm text-decoration-none"
						title={$t('order.editTotal')}
						aria-label={$t('order.editTotal')}
						onclick={() => (totalEditOpen = true)}
					>
						✏️
					</button>
				{/if}
			</span>
		</div>
		<div class="d-flex gap-2">
			<button
				class="btn btn-secondary flex-fill fw-semibold"
				style="min-height: 48px;"
				disabled={isEmpty}
				onclick={onClear}
			>
				{$t('order.clear')}
			</button>
			<button
				class="btn btn-success flex-fill fw-semibold"
				style="min-height: 48px;"
				disabled={isEmpty}
				onclick={onCheckout}
			>
				{$t('order.checkout')}
			</button>
		</div>
	</div>
</aside>

{#if priceEditItem}
	{@const editing = priceEditItem}
	<PriceEditModal
		subtitle={editing.product.name}
		initialCents={editing.unitPrice}
		onConfirm={(cents) => {
			onUnitPriceChange(editing.product.id, cents);
			priceEditProductId = null;
		}}
		onCancel={() => (priceEditProductId = null)}
	/>
{/if}

{#if totalEditOpen}
	<PriceEditModal
		title={$t('order.editTotalTitle')}
		label={$t('order.editTotalLabel')}
		initialCents={total}
		originalCents={total}
		minimumCents={minimumTotal}
		allowNegative={false}
		onConfirm={(cents) => {
			onTotalChange(cents);
			totalEditOpen = false;
		}}
		onCancel={() => (totalEditOpen = false)}
	/>
{/if}

{#if commentEditItem}
	{@const editingComment = commentEditItem}
	<CommentEditModal
		productName={editingComment.product.name}
		initialComment={editingComment.comment}
		onConfirm={(comment) => {
			onCommentChange(editingComment.product.id, comment);
			commentEditProductId = null;
		}}
		onCancel={() => (commentEditProductId = null)}
	/>
{/if}

<style>
	@media (max-width: 767px) {
		.order-panel {
			height: 30%;
			width: 100%;
		}
	}
	@media (min-width: 768px) {
		.order-panel {
			height: 100%;
			width: 50%;
		}
	}
	input[disabled]:hover {
		cursor: not-allowed;
	}
</style>
