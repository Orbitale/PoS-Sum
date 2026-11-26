<script lang="ts">
	import type { OrderWithItems } from '#lib/types.ts';
	import { formatPrice } from '#lib/utils/format.ts';
	import { shopName, companyAddress } from '#lib/stores/app-config.ts';
	import { t } from '#lib/i18n/index.ts';
	import { vatEnabled } from '#lib/stores/app-config.ts';
	import { formatVatAmount } from '#lib/catalog/index.ts';
	import { isBackdropClick } from '#lib/utils/modal.ts';

	interface Props {
		order: OrderWithItems;
		onClose: () => void;
	}

	let { order, onClose }: Props = $props();

	function formatDateTime(iso: string): string {
		const d = new Date(iso);
		return (
			d.toLocaleDateString('fr-FR', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric'
			}) +
			' ' +
			d.toLocaleTimeString('fr-FR', {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			})
		);
	}

	function handleOverlayClick(event: MouseEvent) {
		if (isBackdropClick(event)) {
			onClose();
		}
	}

	function handlePrint() {
		window.print();
	}
</script>

<div
	class="modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
	role="dialog"
	aria-modal="true"
	aria-labelledby="invoice-title"
	tabindex="-1"
	onclick={handleOverlayClick}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div class="invoice-modal bg-body rounded-4 p-4 overflow-auto">
		<div class="invoice-print-area">
			<header class="invoice-header mb-3">
				<div class="fs-5 fw-bold invoice-shop-name">{$shopName}</div>
				<div class="small company-address">{$companyAddress}</div>
			</header>

			{#if order.customer_details.trim()}
				<section class="mb-3">
					<div class="small fw-semibold mb-1">{$t('orders.invoice.customer')}</div>
					<div class="customer-details">{order.customer_details}</div>
				</section>
			{/if}

			<h2 id="invoice-title" class="h5 mb-3">{$t('orders.invoice.title')}</h2>

			<dl class="row small mb-3 g-2">
				<dt class="col-sm-4 text-muted">{$t('orders.invoice.orderRef')}</dt>
				<dd class="col-sm-8 mb-0 font-monospace">{order.id}</dd>
				<dt class="col-sm-4 text-muted">{$t('orders.invoice.date')}</dt>
				<dd class="col-sm-8 mb-0">{formatDateTime(order.created_at)}</dd>
				<dt class="col-sm-4 text-muted">{$t('orders.invoice.payment')}</dt>
				<dd class="col-sm-8 mb-0">{$t('orders.paymentMethod.' + order.payment_method)}</dd>
				{#if order.weight != null}
					<dt class="col-sm-4 text-muted">{$t('orders.weight')}</dt>
					<dd class="col-sm-8 mb-0">{order.weight}&nbsp;Kg</dd>
				{/if}
			</dl>

			<table class="table table-bordered table-sm mb-3">
				<thead>
					<tr>
						<th class="text-uppercase small">{$t('orders.colProduct')}</th>
						<th class="text-uppercase small text-end text-nowrap">{$t('orders.colQty')}</th>
						{#if $vatEnabled}
							<th class="text-uppercase small text-end text-nowrap">{$t('orders.colVat')}</th>
						{/if}
						<th class="text-uppercase small text-end text-nowrap">{$t('orders.colUnitPrice')}</th>
						<th class="text-uppercase small text-end text-nowrap">{$t('orders.colSubtotal')}</th>
					</tr>
				</thead>
				<tbody>
					{#each order.items as item (item.id)}
						<tr>
							<td>
								{item.product_name}
								{#if item.comment}
									<div class="small text-muted fst-italic">{item.comment}</div>
								{/if}
							</td>
							<td class="text-end text-nowrap">{item.quantity}</td>
							{#if $vatEnabled}
								<td class="text-end text-nowrap">{formatVatAmount(item.total, item.vat)}</td>
							{/if}
							<td class="text-end text-nowrap">{formatPrice(item.unit_price)}</td>
							<td class="text-end text-nowrap">{formatPrice(item.total)}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					{#if $vatEnabled}
						<tr>
							<th colspan={4} class="text-end">{$t('orders.invoice.vatTotal')}</th>
							<th class="text-end text-nowrap">{formatPrice(order.vat_total)}</th>
						</tr>
					{/if}
					<tr>
						<th colspan={$vatEnabled ? 4 : 3} class="text-end">{$t('orders.invoice.total')}</th>
						<th class="text-end text-nowrap">{formatPrice(order.total)}</th>
					</tr>
				</tfoot>
			</table>
		</div>

		<div class="d-flex gap-2 no-print">
			<button type="button" class="btn btn-primary flex-fill fw-semibold" onclick={handlePrint}>
				{$t('orders.invoice.print')}
			</button>
			<button type="button" class="btn btn-secondary flex-fill fw-semibold" onclick={onClose}>
				{$t('orders.invoice.close')}
			</button>
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		z-index: 1300;
		background: rgba(0, 0, 0, 0.5);
	}
	.invoice-modal {
		width: min(640px, 95vw);
		max-height: 90vh;
	}
	.company-address,
	.customer-details {
		white-space: pre-line;
	}

	@media print {
		:global(body),
		:global(body *) {
			visibility: hidden;
		}
		:global(body) {
			background: #fff !important;
		}
		.modal-overlay,
		.modal-overlay :global(*) {
			visibility: visible;
		}
		.modal-overlay {
			position: absolute;
			inset: 0;
			width: 100%;
			height: auto;
			min-height: 100%;
			background: #fff !important;
			display: block;
			padding: 0;
		}
		.invoice-modal,
		.invoice-print-area {
			background: #fff !important;
			color: #000 !important;
		}
		.invoice-modal {
			width: 100%;
			max-height: none;
			overflow: visible;
			box-shadow: none;
			border-radius: 0;
			padding: 1rem;
			position: absolute;
			left: 0;
			top: 0;
		}
		.invoice-header .company-address {
			color: #000 !important;
		}
		.invoice-print-area :global(.table) {
			--bs-table-bg: #fff;
			--bs-table-color: #000;
			--bs-table-border-color: #000;
			color: #000 !important;
		}
		.invoice-print-area :global(.text-muted) {
			color: #333 !important;
		}
		.no-print {
			display: none !important;
		}
	}
</style>
