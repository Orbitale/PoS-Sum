<script lang="ts">
	import { untrack } from 'svelte';
	import { formatCentsToInput, parseEurosToCents } from '#lib/money/index.ts';
	import { formatPrice } from '#lib/utils/format.ts';
	import { isBackdropClick } from '#lib/utils/modal.ts';
	import { t } from '#lib/i18n/index.ts';
	import AmountField from './AmountField.svelte';

	interface Props {
		title?: string;
		subtitle?: string;
		label?: string;
		initialCents: number;
		originalCents?: number | null;
		minimumCents?: number | null;
		allowNegative?: boolean;
		onConfirm: (cents: number) => void;
		onCancel: () => void;
	}

	let {
		title = undefined,
		subtitle = undefined,
		label = undefined,
		initialCents,
		originalCents = null,
		minimumCents = null,
		allowNegative = true,
		onConfirm,
		onCancel
	}: Props = $props();

	let amount = $state(untrack(() => formatCentsToInput(initialCents)));

	let amountCents = $derived(parseEurosToCents(amount));
	let belowMinimum = $derived(minimumCents != null && amountCents < minimumCents);
	let canConfirm = $derived(!belowMinimum);

	function handleOverlayClick(event: MouseEvent) {
		if (isBackdropClick(event)) {
			onCancel();
		}
	}

	function handleConfirm() {
		if (!canConfirm) {
			return;
		}
		const cents = minimumCents != null ? Math.max(amountCents, minimumCents) : amountCents;
		onConfirm(cents);
	}
</script>

<div
	class="modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
	style="z-index: 1300; background: rgba(0,0,0,0.5);"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	onclick={handleOverlayClick}
	onkeydown={(e) => e.key === 'Escape' && onCancel()}
>
	<div class="bg-body rounded-4 p-4" style="width: min(420px, 95vw);">
		<h2 class="h5 mb-2">{title ?? $t('order.editPriceTitle')}</h2>
		{#if subtitle}
			<p class="text-muted small mb-3">{subtitle}</p>
		{/if}

		<AmountField
			id="price-edit-amount"
			label={label ?? $t('order.editPriceLabel')}
			value={amount}
			invalid={belowMinimum}
			{allowNegative}
			hint={belowMinimum && minimumCents != null
				? $t('order.totalBelowMinimum', { minimum: formatPrice(minimumCents) })
				: undefined}
			onValueChange={(v) => (amount = v)}
		>
			{#snippet labelExtra()}
				{#if originalCents != null}
					<span class="small fw-normal text-muted">
						{$t('order.originalTotal')}: {formatPrice(originalCents)}
					</span>
				{/if}
				{#if minimumCents != null}
					<span class="small fw-normal text-muted">
						{$t('order.minimumTotal')}: {formatPrice(minimumCents)}
					</span>
				{/if}
			{/snippet}
		</AmountField>

		<div class="d-flex gap-2 mt-3">
			<button class="btn btn-secondary flex-fill fw-semibold" onclick={onCancel}>
				{$t('order.cancel')}
			</button>
			<button
				class="btn btn-primary flex-fill fw-semibold"
				onclick={handleConfirm}
				disabled={!canConfirm}
			>
				{$t('order.confirmPrice')} ({formatPrice(amountCents)})
			</button>
		</div>
	</div>
</div>
