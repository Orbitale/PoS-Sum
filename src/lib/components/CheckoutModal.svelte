<script lang="ts">
	import { tick } from 'svelte';
	import type { CartItem } from '$lib/types';
	import { formatPrice } from '$lib/utils/format';
	import { t } from '$lib/i18n';

	interface Props {
		items: CartItem[];
		total: number;
		onConfirm: (paymentMethod: 'cash' | 'card') => void;
		onCancel: () => void;
	}

	let { items, total, onConfirm, onCancel }: Props = $props();

	let paymentMethod = $state<'cash' | 'card' | null>(null);
	let cashReceived = $state('');
	let isSubmitting = $state(false);
	let cashInput = $state<HTMLInputElement | null>(null);

	let formattedTotal = $derived((total / 100).toFixed(2).replace('.', ','));

	let cashReceivedCents = $derived.by(() => {
		if (cashReceived.trim() === '') return total;
		const val = parseFloat(cashReceived.replace(',', '.'));
		return isNaN(val) ? 0 : Math.round(val * 100);
	});

	let change = $derived(cashReceivedCents - total);

	let canConfirm = $derived.by(() => {
		return !(
			isSubmitting ||
			!paymentMethod ||
			(paymentMethod === 'cash' && cashReceivedCents < total)
		);
	});

	function selectPayment(method: 'cash' | 'card') {
		paymentMethod = method;
		cashReceived = '';
	}

	$effect(() => {
		if (paymentMethod === 'cash') {
			tick().then(() => cashInput?.focus());
		}
	});

	async function handleConfirm() {
		if (!paymentMethod || !canConfirm) {
			return;
		}
		isSubmitting = true;
		onConfirm(paymentMethod);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="z-index: 100; background: rgba(0,0,0,0.5);" onclick={onCancel} onkeydown={(e) => e.key === 'Escape' && onCancel()}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-box bg-body rounded-4 p-4 overflow-auto" style="width: 90%; max-width: 420px; max-height: 90vh;" onclick={(e) => e.stopPropagation()}>
		<h2 class="h5 mb-3">{$t('checkout.title')}</h2>

		<div class="mb-3">
			{#each items as item (item.product.id)}
				<div class="d-flex justify-content-between py-1" style="font-size:0.95rem">
					<span>{item.quantity}x {item.product.name}</span>
					<span>{formatPrice(item.product.price * item.quantity)}</span>
				</div>
			{/each}
			<div class="d-flex justify-content-between pt-2 mt-2 border-top border-2 fs-5 fw-bold">
				<span>{$t('checkout.total')}</span>
				<span>{formatPrice(total)}</span>
			</div>
		</div>

		<div class="d-flex gap-2 mb-3">
			<button
				class="btn flex-fill fw-semibold {paymentMethod === 'cash' ? 'btn-primary' : 'btn-outline-secondary'}"
				style="min-height: 48px;"
				onclick={() => selectPayment('cash')}
			>
				{$t('checkout.cash')}
			</button>
			<button
				class="btn flex-fill fw-semibold {paymentMethod === 'card' ? 'btn-primary' : 'btn-outline-secondary'}"
				style="min-height: 48px;"
				onclick={() => selectPayment('card')}
			>
				{$t('checkout.card')}
			</button>
		</div>

		{#if paymentMethod === 'cash'}
			<div class="cash-section mb-3">
				<label class="d-flex flex-column gap-1 fw-semibold" style="font-size:0.95rem">
					{$t('checkout.amountReceived')}
					<input bind:this={cashInput} class="form-control text-end fs-5" type="text" inputmode="decimal" placeholder={formattedTotal} bind:value={cashReceived} />
				</label>
				{#if cashReceivedCents >= total}
					<div class="mt-2 fs-5 text-success">
						{$t('checkout.change')} <strong>{formatPrice(change)}</strong>
					</div>
				{/if}
			</div>
		{/if}

		<div class="d-flex gap-2">
			<button class="btn btn-secondary flex-fill fw-semibold" onclick={onCancel} disabled={isSubmitting}
				>{$t('checkout.cancel')}</button
			>
			<button class="btn btn-success flex-fill fw-semibold" onclick={handleConfirm} disabled={!canConfirm}>
				{isSubmitting ? $t('checkout.submitting') : $t('checkout.confirm')}
			</button>
		</div>
	</div>
</div>
