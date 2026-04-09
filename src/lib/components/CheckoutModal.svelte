<script lang="ts">
	import type { CartItem } from '$lib/types';
	import { formatPrice } from '$lib/utils/format';
	import { t } from '$lib/i18n';
	import Numpad from './Numpad.svelte';

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

	let numberOfProducts = $derived(items.reduce((acc, item) => acc + item.quantity, 0));
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

	function handleNumpadKey(key: string) {
		if (key === 'backspace') {
			cashReceived = cashReceived.slice(0, -1);
		} else if (key.startsWith(',')) {
			if (!cashReceived.includes(',')) {
				cashReceived += key;
			}
			if (key.length > 1) {
				// cases for ",00" or ",50"
				cashReceived = cashReceived.replace(/,.*$/gi, key);
			}
		} else {
			cashReceived += key;
		}
	}

	async function handleConfirm() {
		if (!paymentMethod || !canConfirm) {
			return;
		}
		isSubmitting = true;
		onConfirm(paymentMethod);
	}
</script>

<div class="modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
	<div class="checkout-modal bg-body rounded-4 p-3">
		<div class="checkout-inner">

			<div class="checkout-items">
				<h2 class="h5">{$t('checkout.title')}</h2>

				<table class="table table-hover table-bordered" style="font-size:0.95rem">
					<tbody>
						{#each items as item (item.product.id)}
							<tr>
								<td>{item.quantity}x {item.product.name}</td>
								<td>{formatPrice(item.product.price * item.quantity)}</td>
							</tr>
						{/each}
						<tr class="table-info">
							<td><strong>{$t('checkout.numberOfProducts')}</strong></td>
							<td><strong>{numberOfProducts}</strong></td>
						</tr>
						<tr class="table-success">
							<td><strong>{$t('checkout.total')}</strong></td>
							<td><strong>{formatPrice(total)}</strong></td>
						</tr>
					</tbody>
				</table>
			</div>

			<div class="checkout-payment">
				<div class:visible={paymentMethod === 'cash'} class:invisible={paymentMethod !== 'cash'}>
					<div class="mt-3">
						<Numpad onKeyPress={handleNumpadKey} />
					</div>
					<label class="d-flex flex-column gap-1 fw-semibold" style="font-size:0.95rem">
						{$t('checkout.amountReceived')}
						<input class="form-control text-end fs-5" type="text" inputmode="none" readonly placeholder={formattedTotal} value={cashReceived} />
					</label>
					<div class="mt-2 fs-5 text-success">
						{$t('checkout.change')} <strong>{formatPrice(change)}</strong>
					</div>
				</div>
			</div>

			<div class="checkout-actions">
				<div class="d-flex gap-2 mb-2">
					<button
							class="btn flex-fill fw-semibold {paymentMethod === 'cash' ? 'btn-primary' : 'btn-outline-secondary'}"
							style="min-height: 48px;"
							onclick={() => selectPayment('cash')}
					>
						💵 {$t('checkout.cash')}
					</button>
					<button
							class="btn flex-fill fw-semibold {paymentMethod === 'card' ? 'btn-primary' : 'btn-outline-secondary'}"
							style="min-height: 48px;"
							onclick={() => selectPayment('card')}
					>
						💳 {$t('checkout.card')}
					</button>
				</div>
				<div class="d-flex gap-2">
					<button class="btn btn-success flex-fill fw-semibold" onclick={handleConfirm} disabled={!canConfirm}>
						{isSubmitting ? $t('checkout.submitting') : $t('checkout.confirm')}
					</button>
					<button class="btn btn-danger flex-fill fw-semibold" onclick={onCancel} disabled={isSubmitting}>
						{$t('checkout.cancel')}
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		z-index: 1200;
		background: rgba(0, 0, 0, 0.5);
	}
	.checkout-modal {
		width: 100vw;
		height: 100vh;
	}
	.checkout-inner {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	.checkout-items {
		flex: 1 1 0;
		min-height: 0;
		overflow-y: auto;
	}
	.checkout-payment {
		flex: 0 0 auto;
	}
	.checkout-actions {
		flex: 0 0 auto;
		padding-top: 0.5rem;
	}

	@media (min-width: 768px) {
		.checkout-inner {
			display: grid;
			grid-template-columns: 1fr 1fr;
			grid-template-rows: 1fr auto;
			grid-template-areas:
				"items payment"
				"actions actions";
			gap: 1rem;
		}
		.checkout-items {
			grid-area: items;
			overflow-y: auto;
		}
		.checkout-payment {
			grid-area: payment;
		}
		.checkout-actions {
			grid-area: actions;
		}
	}
</style>
