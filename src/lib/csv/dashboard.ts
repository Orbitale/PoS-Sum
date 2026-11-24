import type { DashboardSummary } from '#lib/types.ts';
import { centsToEurosCsv, joinCsvLines, joinCsvRow, quoteCsv } from './csv.ts';

export interface DashboardCsvLabels {
	colProduct: string;
	colUnitPrice: string;
	colQuantity: string;
	colTotal: string;
	productTableTotal: string;
	colPaymentMethod: string;
	colRevenue: string;
	colTransactions: string;
}

export function buildDashboardCsv(summary: DashboardSummary, labels: DashboardCsvLabels): string {
	const lines: string[] = [];

	lines.push(
		joinCsvRow([
			quoteCsv(labels.colProduct),
			quoteCsv(labels.colUnitPrice),
			quoteCsv(labels.colQuantity),
			quoteCsv(labels.colTotal)
		])
	);
	for (const row of summary.per_product) {
		const unitPrice = centsToEurosCsv(Math.round(row.total_revenue / row.total_quantity));
		lines.push(
			joinCsvRow([
				quoteCsv(row.product_name),
				quoteCsv(unitPrice),
				quoteCsv(String(row.total_quantity)),
				quoteCsv(centsToEurosCsv(row.total_revenue))
			])
		);
	}
	lines.push(
		joinCsvRow([
			quoteCsv(labels.productTableTotal),
			quoteCsv(''),
			quoteCsv(''),
			quoteCsv(centsToEurosCsv(summary.total_revenue))
		])
	);

	lines.push('');

	lines.push(
		joinCsvRow([
			quoteCsv(labels.colPaymentMethod),
			quoteCsv(labels.colRevenue),
			quoteCsv(labels.colTransactions)
		])
	);
	for (const row of summary.per_payment_method) {
		lines.push(
			joinCsvRow([
				quoteCsv(row.payment_method),
				quoteCsv(centsToEurosCsv(row.total_revenue)),
				quoteCsv(String(row.transaction_count))
			])
		);
	}
	lines.push(
		joinCsvRow([
			quoteCsv(labels.colTotal),
			quoteCsv(centsToEurosCsv(summary.total_revenue)),
			quoteCsv(String(summary.total_transactions))
		])
	);

	return joinCsvLines(lines);
}
