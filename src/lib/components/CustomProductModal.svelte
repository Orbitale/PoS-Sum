<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { formatPrice } from '#lib/utils/format.ts';
	import { isBackdropClick } from '#lib/utils/modal.ts';
	import Numpad from './Numpad.svelte';

	interface Props {
		onConfirm: (data: { name: string; priceCents: number }) => void;
		onCancel: () => void;
	}

	let { onConfirm, onCancel }: Props = $props();

	let name = $state('');
	let priceInput = $state('');

	let priceCents = $derived.by(() => {
		if (priceInput.trim() === '') return 0;
		const val = parseFloat(priceInput.replace(',', '.'));
		return isNaN(val) ? 0 : Math.round(val * 100);
	});

	let canConfirm = $derived(name.trim().length > 0);

	function sanitizeAmountInput(raw: string): string {
		let value = raw.replace(/[^\d,.\-]/g, '');
		const negative = value.startsWith('-');
		value = value.replace(/-/g, '');
		value = (negative ? '-' : '') + value;

		const separatorMatch = value.match(/[,.]/);
		if (!separatorMatch || separatorMatch.index === undefined) {
			return value;
		}

		const sep = separatorMatch[0];
		const idx = separatorMatch.index;
		const intPart = value.slice(0, idx).replace(/[,.]/g, '');
		const fracPart = value.slice(idx + 1).replace(/[,.]/g, '');
		return `${intPart}${sep}${fracPart}`;
	}

	function handlePriceInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		priceInput = sanitizeAmountInput(input.value);
		input.value = priceInput;
	}

	function handleNumpadKey(key: string) {
		if (key === 'backspace') {
			priceInput = priceInput.slice(0, -1);
		} else if (key === '-') {
			if (priceInput.startsWith('-')) {
				priceInput = priceInput.slice(1);
			} else {
				priceInput = '-' + priceInput;
			}
		} else if (key.startsWith(',')) {
			if (!priceInput.includes(',') && !priceInput.includes('.')) {
				priceInput += ',';
			}
			if (key.length > 1) {
				priceInput = priceInput.replace(/[,.].*$/i, key);
			}
		} else {
			priceInput += key;
		}
		priceInput = sanitizeAmountInput(priceInput);
	}

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

		<div class="mb-3">
			<label class="form-label fw-semibold" for="custom-product-price">
				{$t('sales.customProductPrice')}
			</label>
			<input
				id="custom-product-price"
				class="form-control text-end fs-5"
				type="text"
				inputmode="decimal"
				value={priceInput}
				placeholder="0,00"
				oninput={handlePriceInput}
			/>
		</div>

		<div class="mb-3">
			<Numpad onKeyPress={handleNumpadKey} />
		</div>

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
