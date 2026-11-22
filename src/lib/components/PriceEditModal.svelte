<script lang="ts">
	import { formatPrice } from '#lib/utils/format.ts';
	import { t } from '#lib/i18n/index.ts';
	import Numpad from './Numpad.svelte';

	interface Props {
		title?: string;
		subtitle?: string;
		label?: string;
		initialCents: number;
		/** When set, shown next to the label as the originally calculated amount. */
		originalCents?: number | null;
		/** When set, amounts below this cannot be confirmed. */
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

	let amount = $state((initialCents / 100).toFixed(2).replace('.', ','));

	let amountCents = $derived.by(() => {
		if (amount.trim() === '') return 0;
		const val = parseFloat(amount.replace(',', '.'));
		return isNaN(val) ? 0 : Math.round(val * 100);
	});

	let belowMinimum = $derived(minimumCents != null && amountCents < minimumCents);

	let canConfirm = $derived(!belowMinimum);

	function sanitizeAmountInput(raw: string): string {
		const pattern = allowNegative ? /[^\d,.\-]/g : /[^\d,.]/g;
		let value = raw.replace(pattern, '');
		if (allowNegative) {
			const negative = value.startsWith('-');
			value = value.replace(/-/g, '');
			value = (negative ? '-' : '') + value;
		}

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

	function handleInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		amount = sanitizeAmountInput(input.value);
		input.value = amount;
	}

	function handleInputFocus(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const hasFocus = document.activeElement === event.currentTarget;
		console.info('hasFocus', hasFocus);
		// Using timeout so that all input is selected at first
		setTimeout(() => input.select(), 1);
	}

	function handleNumpadKey(key: string) {
		if (key === 'backspace') {
			amount = amount.slice(0, -1);
		} else if (key === '-') {
			if (!allowNegative) {
				return;
			}
			if (amount.startsWith('-')) {
				amount = amount.slice(1);
			} else {
				amount = '-' + amount;
			}
		} else if (key.startsWith(',')) {
			if (!amount.includes(',') && !amount.includes('.')) {
				amount += ',';
			}
			if (key.length > 1) {
				amount = amount.replace(/[,.].*$/i, key);
			}
		} else {
			amount += key;
		}
		amount = sanitizeAmountInput(amount);
	}

	function handleConfirm() {
		if (!canConfirm) {
			return;
		}
		const cents = minimumCents != null ? Math.max(amountCents, minimumCents) : amountCents;
		onConfirm(cents);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
	style="z-index: 1300; background: rgba(0,0,0,0.5);"
	onclick={onCancel}
	onkeydown={(e) => e.key === 'Escape' && onCancel()}
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="bg-body rounded-4 p-4"
		style="width: min(420px, 95vw);"
		onclick={(e) => e.stopPropagation()}
	>
		<h2 class="h5 mb-2">{title ?? $t('order.editPriceTitle')}</h2>
		{#if subtitle}
			<p class="text-muted small mb-3">{subtitle}</p>
		{/if}

		<label class="d-flex flex-column gap-1 fw-semibold mb-3" style="font-size: 0.95rem">
			<span class="d-flex flex-wrap align-items-baseline gap-2">
				<span>{label ?? $t('order.editPriceLabel')}</span>
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
			</span>
			<input
				class="form-control text-end fs-5"
				class:is-invalid={belowMinimum}
				type="text"
				inputmode="decimal"
				value={amount}
				oninput={handleInput}
				onfocus={handleInputFocus}
			/>
			{#if belowMinimum && minimumCents != null}
				<span class="small text-danger fw-normal">
					{$t('order.totalBelowMinimum', { minimum: formatPrice(minimumCents) })}
				</span>
			{/if}
		</label>

		<Numpad onKeyPress={handleNumpadKey} />

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
