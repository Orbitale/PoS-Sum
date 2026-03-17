<script lang="ts">
	import { onMount } from 'svelte';
	import { api_call } from '$lib/api';
	import { downloadCsv } from '$lib/export-csv';
	import type { DashboardSummary } from '$lib/types';
	import { formatPrice } from '$lib/utils/format';
	import { t } from '$lib/i18n';

	let summary = $state<DashboardSummary | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			summary = await api_call<DashboardSummary>('get_dashboard_summary');
		} catch (e) {
			error = $t('dashboard.loadError', { error: String(e) });
		} finally {
			isLoading = false;
		}
	});

	function centsToEuros(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function q(value: string): string {
		return `"${value.replace(/"/g, '""')}"`;
	}

	async function exportCsv() {
		if (!summary) {
			return;
		}

		const lines: string[] = [];

		// Sales by product table
		lines.push(
			[
				q($t('dashboard.colProduct')),
				q($t('dashboard.colUnitPrice')),
				q($t('dashboard.colQuantity')),
				q($t('dashboard.colTotal'))
			].join(';')
		);
		for (const row of summary.per_product) {
			const unitPrice = centsToEuros(Math.round(row.total_revenue / row.total_quantity));
			lines.push(
				[
					q(row.product_name),
					q(unitPrice),
					q(String(row.total_quantity)),
					q(centsToEuros(row.total_revenue))
				].join(';')
			);
		}
		lines.push(
			[
				q($t('dashboard.productTableTotal')),
				q(''),
				q(''),
				q(centsToEuros(summary.total_revenue))
			].join(';')
		);

		// Blank separator line
		lines.push('');

		// Payment method breakdown table
		lines.push(
			[
				q($t('dashboard.colPaymentMethod')),
				q($t('dashboard.colRevenue')),
				q($t('dashboard.colTransactions'))
			].join(';')
		);
		for (const row of summary.per_payment_method) {
			lines.push(
				[
					q(row.payment_method),
					q(centsToEuros(row.total_revenue)),
					q(String(row.transaction_count))
				].join(';')
			);
		}
		lines.push(
			[
				q($t('dashboard.colTotal')),
				q(centsToEuros(summary.total_revenue)),
				q(String(summary.total_transactions))
			].join(';')
		);

		const csv = lines.join('\n');

		await downloadCsv('tableau-de-bord.csv', csv);
	}
</script>

<div class="mx-auto px-4 pb-4">
	<div class="d-flex align-items-center justify-content-between pt-4 pb-3">
		<h1 class="h4 m-0 fw-semibold">{$t('dashboard.title')}</h1>
		{#if summary && summary.total_transactions > 0}
			<button class="btn btn-outline-primary btn-sm fw-semibold" onclick={exportCsv}>
				{$t('dashboard.exportCsv')}
			</button>
		{/if}
	</div>

	{#if isLoading}
		<div class="d-flex align-items-center justify-content-center text-muted fs-5" style="height: 200px">{$t('dashboard.loading')}</div>
	{:else if error}
		<div class="d-flex align-items-center justify-content-center text-danger fs-5" style="height: 200px">{error}</div>
	{:else if summary && summary.total_transactions === 0}
		<div class="d-flex align-items-center justify-content-center text-muted fs-5" style="height: 200px">{$t('dashboard.noSales')}</div>
	{:else if summary}
		<div class="d-flex gap-3 mb-4">
			<div class="flex-fill d-flex flex-column gap-1 p-3 border rounded-3 bg-body-secondary">
				<span class="small fw-semibold text-uppercase text-muted">{$t('dashboard.totalRevenue')}</span>
				<span class="fs-3 fw-bold">{formatPrice(summary.total_revenue)}</span>
			</div>
			<div class="flex-fill d-flex flex-column gap-1 p-3 border rounded-3 bg-body-secondary">
				<span class="small fw-semibold text-uppercase text-muted">{$t('dashboard.totalTransactions')}</span>
				<span class="fs-3 fw-bold">{summary.total_transactions}</span>
			</div>
		</div>

		<section class="mb-4">
			<h2 class="h6 fw-semibold mb-2">{$t('dashboard.productTable')}</h2>
			<div class="table-responsive">
				<table class="table">
					<thead>
						<tr>
							<th class="text-uppercase small text-muted fw-semibold">{$t('dashboard.colProduct')}</th>
							<th class="text-uppercase small text-muted fw-semibold text-end text-nowrap">{$t('dashboard.colUnitPrice')}</th>
							<th class="text-uppercase small text-muted fw-semibold text-end text-nowrap">{$t('dashboard.colQuantity')}</th>
							<th class="text-uppercase small text-muted fw-semibold text-end text-nowrap">{$t('dashboard.colTotal')}</th>
						</tr>
					</thead>
					<tbody>
						{#each summary.per_product as row (row.product_id)}
							<tr>
								<td>{row.product_name}</td>
								<td class="text-end text-nowrap"
									>{formatPrice(Math.round(row.total_revenue / row.total_quantity))}</td
								>
								<td class="text-end text-nowrap">{row.total_quantity}</td>
								<td class="text-end text-nowrap">{formatPrice(row.total_revenue)}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td class="fw-bold border-top border-2 border-bottom-0" colspan="3">{$t('dashboard.productTableTotal')}</td>
							<td class="fw-bold border-top border-2 border-bottom-0 text-end text-nowrap">{formatPrice(summary.total_revenue)}</td>
						</tr>
					</tfoot>
				</table>
			</div>
		</section>

		<section class="mb-4">
			<h2 class="h6 fw-semibold mb-2">{$t('dashboard.paymentBreakdown')}</h2>
			<div class="table-responsive">
				<table class="table">
					<thead>
						<tr>
							<th class="text-uppercase small text-muted fw-semibold">{$t('dashboard.colPaymentMethod')}</th>
							<th class="text-uppercase small text-muted fw-semibold text-end text-nowrap">{$t('dashboard.colRevenue')}</th>
							<th class="text-uppercase small text-muted fw-semibold text-end text-nowrap">{$t('dashboard.colTransactions')}</th>
						</tr>
					</thead>
					<tbody>
						{#each summary.per_payment_method as row (row.payment_method)}
							<tr>
								<td>{$t('dashboard.paymentMethod.' + row.payment_method)}</td>
								<td class="text-end text-nowrap">{formatPrice(row.total_revenue)}</td>
								<td class="text-end text-nowrap">{row.transaction_count}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

</div>
