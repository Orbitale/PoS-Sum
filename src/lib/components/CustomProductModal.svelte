<script lang="ts">
	import { parseEurosToCents } from '#lib/money/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import { formatPrice } from '#lib/utils/format.ts';
	import { isBackdropClick } from '#lib/utils/modal.ts';
	import AmountField from './AmountField.svelte';

	interface Props {
		onConfirm: (data: { name: string; priceCents: number }) => void;
		onCancel: () => void;
	}

	let { onConfirm, onCancel }: Props = $props();

	let name = $state('');
	let priceInput = $state('');

	let priceCents = $derived(parseEurosToCents(priceInput));
	let canConfirm = $derived(name.trim().length > 0);

	function handleSubmit() {
		if (!canConfirm) {
			return;
		}
		onConfirm({ name: name.trim(), priceCents });
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
