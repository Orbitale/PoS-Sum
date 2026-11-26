<script lang="ts">
	import type { CartItem, PaymentMethod } from '#lib/types.ts';
	import { formatCentsToInput, parseEurosToCents } from '#lib/money/index.ts';
	import { formatPrice } from '#lib/utils/format.ts';
	import { t } from '#lib/i18n/index.ts';
	import AmountField from './AmountField.svelte';

	interface Props {
		items: CartItem[];
		total: number;
		onConfirm: (paymentMethod: PaymentMethod, customerDetails: string) => void;
		onCancel: () => void;
	}

	let { items, total, onConfirm, onCancel }: Props = $props();

	let paymentMethod = $state<PaymentMethod | null>(null);
	let cashReceived = $state('');
	let customerDetails = $state('');
	let isSubmitting = $state(false);

	let numberOfProducts = $derived(items.reduce((acc, item) => acc + item.quantity, 0));
	let formattedTotal = $derived(formatCentsToInput(total));

	let cashReceivedCents = $derived(
		cashReceived.trim() === '' ? total : parseEurosToCents(cashReceived)
	);

	let change = $derived(cashReceivedCents - total);

	let canConfirm = $derived.by(() => {
		return !(
			isSubmitting ||
			!paymentMethod ||
			(paymentMethod === 'cash' && cashReceivedCents < total)
		);
	});

	function selectPayment(method: PaymentMethod) {
		paymentMethod = method;
		cashReceived = '';
	}

	async function handleConfirm() {
		if (!paymentMethod || !canConfirm) {
			return;
		}
		isSubmitting = true;
		onConfirm(paymentMethod, customerDetails);
	}
</script>

<div
	class="modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
>
	<div class="checkout-modal bg-body rounded-4 p-3">
		<div class="checkout-inner">
			<div class="checkout-items">
				<h2 class="h5">{$t('checkout.title')}</h2>

				<table class="table table-hover table-bordered" style="font-size:0.95rem">
					<tbody>
						{#each items as item (item.product.id)}
							<tr>
								<td>
									{item.quantity}x {item.product.name}
									{#if item.comment}
										<div class="small text-muted fst-italic">{item.comment}</div>
									{/if}
								</td>
								<td>{formatPrice(item.unitPrice * item.quantity)}</td>
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
				<label class="d-flex flex-column gap-1 fw-semibold mb-3" style="font-size: 0.95rem">
					{$t('checkout.customerDetails')}
					<textarea class="form-control" rows="4" bind:value={customerDetails}></textarea>
				</label>
				<div class:visible={paymentMethod === 'cash'} class:invisible={paymentMethod !== 'cash'}>
					<AmountField
						id="checkout-cash-received"
						label={$t('checkout.amountReceived')}
						value={cashReceived}
						placeholder={formattedTotal}
						allowNegative={false}
						onValueChange={(v) => (cashReceived = v)}
					/>
					<div class="mt-2 fs-5 text-success">
						{$t('checkout.change')} <strong>{formatPrice(change)}</strong>
					</div>
				</div>
			</div>

			<div class="checkout-actions d-flex gap-2 flex-wrap align-items-stretch">
				<div class="d-flex gap-2 flex-grow-1 flex-wrap">
					<button
						class="btn flex-fill fw-semibold {paymentMethod === 'cash'
							? 'btn-primary'
							: 'btn-outline-secondary'}"
						style="min-height: 48px;"
						onclick={() => selectPayment('cash')}
					>
						💵 {$t('checkout.cash')}
					</button>
					<button
						class="btn flex-fill fw-semibold {paymentMethod === 'card'
							? 'btn-primary'
							: 'btn-outline-secondary'}"
						style="min-height: 48px;"
						onclick={() => selectPayment('card')}
					>
						💳 {$t('checkout.card')}
					</button>
					<button
						class="btn flex-fill fw-semibold {paymentMethod === 'check'
							? 'btn-primary'
							: 'btn-outline-secondary'}"
						style="min-height: 48px;"
						onclick={() => selectPayment('check')}
					>
						🧾 {$t('checkout.check')}
					</button>
				</div>
				<div class="d-flex gap-2 flex-grow-1">
					<button
						class="btn btn-success flex-fill fw-semibold"
						style="min-height: 48px;"
						onclick={handleConfirm}
						disabled={!canConfirm}
					>
						{isSubmitting ? $t('checkout.submitting') : $t('checkout.confirm')}
					</button>
					<button
						class="btn btn-danger flex-fill fw-semibold"
						style="min-height: 48px;"
						onclick={onCancel}
						disabled={isSubmitting}
					>
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
				'items payment'
				'actions actions';
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
