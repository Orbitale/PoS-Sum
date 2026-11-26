<script lang="ts">
	import { parseEurosToCents } from '#lib/money/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import { vatEnabled } from '#lib/stores/app-config.ts';
	import { isVatInRange, normalizeVat, parseVatInput } from '#lib/catalog/index.ts';
	import { formatPrice } from '#lib/utils/format.ts';
	import { isBackdropClick } from '#lib/utils/modal.ts';
	import AmountField from './AmountField.svelte';

	interface Props {
		onConfirm: (data: { name: string; priceCents: number; vat?: number }) => void;
		onCancel: () => void;
	}

	let { onConfirm, onCancel }: Props = $props();

	let name = $state('');
	let priceInput = $state('');
	let vatInput = $state('0');

	let priceCents = $derived(parseEurosToCents(priceInput));
	let vat = $derived(parseVatInput(vatInput));
	let canConfirm = $derived(name.trim().length > 0 && (!$vatEnabled || isVatInRange(vat)));

	function handleSubmit() {
		if (!canConfirm) {
			return;
		}
		onConfirm({
			name: name.trim(),
			priceCents,
			vat: $vatEnabled ? normalizeVat(vat) : 0
		});
	}

	function handleOverlayClick(event: MouseEvent) {
		if (isBackdropClick(event)) {
			onCancel();
		}
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
		<h2 class="h5 mb-3">{$t('sales.customProductTitle')}</h2>

		<div class="mb-3">
			<label class="form-label fw-semibold" for="custom-product-name">
				{$t('sales.customProductName')}
			</label>
			<input
				id="custom-product-name"
				class="form-control"
				type="text"
				bind:value={name}
				placeholder={$t('sales.customProductNamePlaceholder')}
			/>
		</div>

		<AmountField
			id="custom-product-price"
			label={$t('sales.customProductPrice')}
			value={priceInput}
			placeholder="0,00"
			onValueChange={(v) => (priceInput = v)}
		/>

		{#if $vatEnabled}
			<div class="mb-3">
				<label class="form-label fw-semibold" for="custom-product-vat">
					{$t('sales.customProductVat')}
				</label>
				<input
					id="custom-product-vat"
					class="form-control"
					type="text"
					inputmode="decimal"
					bind:value={vatInput}
					placeholder="0"
				/>
			</div>
		{/if}

		<div class="d-flex gap-2">
			<button class="btn btn-secondary flex-fill fw-semibold" onclick={onCancel}>
				{$t('sales.customProductCancel')}
			</button>
			<button
				class="btn btn-primary flex-fill fw-semibold"
				onclick={handleSubmit}
				disabled={!canConfirm}
			>
				{$t('sales.customProductAdd')} ({formatPrice(priceCents)})
			</button>
		</div>
	</div>
</div>
