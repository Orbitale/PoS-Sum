<script lang="ts">
	import { untrack } from 'svelte';
	import type { OrderWithItems, UpdateOrderPayload } from '#lib/types.ts';
	import { parseOptionalFloat } from '#lib/money/index.ts';
	import { orderWeightEnabled } from '#lib/stores/app-config.ts';
	import { t } from '#lib/i18n/index.ts';
	import { isBackdropClick } from '#lib/utils/modal.ts';

	interface Props {
		order: OrderWithItems;
		onConfirm: (payload: UpdateOrderPayload) => void | Promise<void>;
		onCancel: () => void;
	}

	let { order, onConfirm, onCancel }: Props = $props();

	let customerDetails = $state(untrack(() => order.customer_details));
	let weightInput = $state(untrack(() => (order.weight != null ? String(order.weight) : '')));
	let isSubmitting = $state(false);

	function handleOverlayClick(event: MouseEvent) {
		if (isBackdropClick(event)) {
			onCancel();
		}
	}

	async function handleSubmit() {
		if (isSubmitting) {
			return;
		}
		isSubmitting = true;
		try {
			await onConfirm({
				id: order.id,
				weight: parseOptionalFloat(weightInput),
				customer_details: customerDetails
			});
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div
	class="modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
	style="z-index: 1300; background: rgba(0, 0, 0, 0.5);"
	role="dialog"
	aria-modal="true"
	aria-labelledby="order-edit-title"
	tabindex="-1"
	onclick={handleOverlayClick}
	onkeydown={(e) => e.key === 'Escape' && onCancel()}
>
	<div
		class="bg-body rounded-4 p-4 overflow-auto"
		style="width: min(480px, 95vw); max-height: 90vh;"
	>
		<h2 id="order-edit-title" class="h5 mb-3">{$t('orders.editTitle')}</h2>

		<label class="d-flex flex-column gap-1 fw-semibold mb-3" style="font-size: 0.95rem">
			{$t('orders.invoice.customerDetails')}
			<textarea class="form-control" rows="4" bind:value={customerDetails}></textarea>
		</label>

		{#if $orderWeightEnabled || order.weight != null}
			<label class="d-flex flex-column gap-1 fw-semibold mb-3" style="font-size: 0.95rem">
				{$t('orders.weight')}
				<input
					class="form-control"
					type="number"
					inputmode="decimal"
					min="0"
					step="any"
					placeholder={$t('order.weightPlaceholder')}
					bind:value={weightInput}
				/>
			</label>
		{/if}

		<div class="d-flex gap-2">
			<button
				type="button"
				class="btn btn-secondary flex-fill fw-semibold"
				onclick={onCancel}
				disabled={isSubmitting}
			>
				{$t('orders.editCancel')}
			</button>
			<button
				type="button"
				class="btn btn-primary flex-fill fw-semibold"
				onclick={handleSubmit}
				disabled={isSubmitting}
			>
				{isSubmitting ? $t('orders.editSaving') : $t('orders.editSave')}
			</button>
		</div>
	</div>
</div>
