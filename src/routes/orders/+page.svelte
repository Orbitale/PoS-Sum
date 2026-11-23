<script lang="ts">
	import { onMount } from 'svelte';
	import { api_call } from '#lib/api.ts';
	import { buildOrdersCsv } from '#lib/csv/index.ts';
	import { downloadCsv } from '#lib/export-csv.ts';
	import type { OrderWithItems } from '#lib/types.ts';
	import { formatPrice } from '#lib/utils/format.ts';
	import { t } from '#lib/i18n/index.ts';

	let orders = $state<OrderWithItems[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		await loadOrders();
	});

	async function loadOrders() {
		isLoading = true;
		error = null;
		try {
			orders = await api_call<OrderWithItems[]>('list_orders');
		} catch (e) {
			error = $t('orders.loadError', { error: String(e) });
		} finally {
			isLoading = false;
		}
	}

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

	async function exportCsv() {
		const csv = buildOrdersCsv(orders, {
			colId: $t('orders.csvColId'),
			colDate: $t('orders.csvColDate'),
			colTotal: $t('orders.csvColTotal'),
			colPaymentMethod: $t('orders.csvColPaymentMethod'),
			colWeight: $t('orders.csvColWeight'),
			colUnitPrice: $t('orders.colUnitPrice'),
			colQty: $t('orders.colQty'),
			colSubtotal: $t('orders.colSubtotal')
		});
		await downloadCsv('commandes.csv', csv);
	}
</script>

<div class="mx-auto px-4 pb-4">
	<div class="d-flex align-items-center justify-content-between pt-4 pb-3">
		<h1 class="h4 m-0 fw-semibold">{$t('orders.title')}</h1>
		{#if orders.length > 0}
			<button class="btn btn-outline-primary btn-sm fw-semibold" onclick={exportCsv}>
				{$t('orders.exportCsv')}
			</button>
		{/if}
	</div>

	{#if isLoading}
		<div
			class="d-flex align-items-center justify-content-center text-muted fs-5"
			style="height: 200px"
		>
			{$t('orders.loading')}
		</div>
	{:else if error}
		<div
			class="d-flex align-items-center justify-content-center text-danger fs-5"
			style="height: 200px"
		>
			{error}
		</div>
	{:else if orders.length === 0}
		<div
			class="d-flex align-items-center justify-content-center text-muted fs-5"
			style="height: 200px"
		>
			{$t('orders.empty')}
		</div>
	{:else}
		<div class="d-flex flex-column gap-3">
			{#each orders as order (order.id)}
				<div class="border rounded-3 overflow-hidden">
					<div class="d-flex align-items-center gap-3 px-3 py-1 bg-body-secondary border-bottom">
						<span class="small fw-semibold">{formatDateTime(order.created_at)}</span>
						<span
							class="badge rounded-pill {order.payment_method === 'cash'
								? 'bg-success-subtle text-success-emphasis'
								: order.payment_method === 'check'
									? 'bg-warning-subtle text-warning-emphasis'
									: 'bg-primary-subtle text-primary-emphasis'}"
						>
							{$t('orders.paymentMethod.' + order.payment_method)}
						</span>
						{#if order.weight != null}
							<span class="small text-muted">{$t('orders.weight')}: {order.weight}&nbsp;Kg</span>
						{/if}
						<span class="ms-auto fs-5 fw-bold">{formatPrice(order.total)}</span>
					</div>
					<table class="table table-sm mb-0">
						<thead>
							<tr>
								<th class="text-uppercase small text-muted fw-semibold">
									{$t('orders.colProduct')}
								</th>
								<th class="text-uppercase small text-muted fw-semibold text-end text-nowrap">
									{$t('orders.colQty')}
								</th>
								<th class="text-uppercase small text-muted fw-semibold text-end text-nowrap">
									{$t('orders.colUnitPrice')}
								</th>
								<th class="text-uppercase small text-muted fw-semibold text-end text-nowrap">
									{$t('orders.colSubtotal')}
								</th>
							</tr>
						</thead>
						<tbody>
							{#each order.items as item (item.id)}
								<tr>
									<td class="p-1">
										{item.product_name}
										{#if item.comment}
											<div class="small text-muted fst-italic">{item.comment}</div>
										{/if}
									</td>
									<td class="text-end text-nowrap">{item.quantity}</td>
									<td class="text-end text-nowrap">{formatPrice(item.unit_price)}</td>
									<td class="text-end text-nowrap">{formatPrice(item.total)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/each}
		</div>
	{/if}
</div>
