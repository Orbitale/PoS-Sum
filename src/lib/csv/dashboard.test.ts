import { describe, expect, it } from 'vitest';
import type { DashboardSummary } from '#lib/types.ts';
import { buildDashboardCsv } from './dashboard.ts';

const labels = {
	colProduct: 'Product',
	colUnitPrice: 'Unit',
	colQuantity: 'Qty',
	colTotal: 'Total',
	productTableTotal: 'Product total',
	colPaymentMethod: 'Method',
	colRevenue: 'Revenue',
	colTransactions: 'Tx'
};

describe('buildDashboardCsv', () => {
	it('exports product and payment breakdowns', () => {
		const summary: DashboardSummary = {
			total_revenue: 500,
			total_transactions: 2,
			per_product: [
				{
					product_id: 'p1',
					product_name: 'Tea',
					total_quantity: 2,
					total_revenue: 300
				}
			],
			per_payment_method: [
				{ payment_method: 'cash', total_revenue: 300, transaction_count: 1 },
				{ payment_method: 'card', total_revenue: 200, transaction_count: 1 }
			]
		};

		const csv = buildDashboardCsv(summary, labels);
		const lines = csv.split('\n');

		expect(lines[0]).toContain('"Product"');
		expect(csv).toContain('"Tea"');
		expect(csv).toContain('"1.50"');
		expect(csv).toContain('"Product total"');
		expect(csv).toContain('"cash"');
		expect(csv).toContain('"card"');
		expect(lines).toContain('');
	});

	it('still emits headers and totals when there are no rows', () => {
		const summary: DashboardSummary = {
			total_revenue: 0,
			total_transactions: 0,
			per_product: [],
			per_payment_method: []
		};

		const csv = buildDashboardCsv(summary, labels);
		expect(csv).toContain('"Product"');
		expect(csv).toContain('"Method"');
		expect(csv).toContain('"Product total"');
		expect(csv).toContain('"0.00"');
	});
});
