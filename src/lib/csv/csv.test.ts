import { describe, expect, it } from 'vitest';
import { centsToEurosCsv, joinCsvLines, joinCsvRow, quoteCsv } from './csv.ts';
import { buildOrdersCsv } from './orders.ts';
import type { OrderWithItems } from '#lib/types.ts';

describe('csv helpers', () => {
	it('quotes and escapes fields', () => {
		expect(quoteCsv('plain')).toBe('"plain"');
		expect(quoteCsv('say "hi"')).toBe('"say ""hi"""');
	});

	it('formats cents for CSV cells', () => {
		expect(centsToEurosCsv(150)).toBe('1.50');
	});

	it('joins rows and lines', () => {
		expect(joinCsvRow(['a', 'b'])).toBe('a;b');
		expect(joinCsvLines(['x', 'y'])).toBe('x\ny');
	});
});

describe('buildOrdersCsv', () => {
	it('builds a product-pivoted export', () => {
		const orders: OrderWithItems[] = [
			{
				id: 'ord-1',
				created_at: '2026-01-01T10:00:00Z',
				total: 300,
				payment_method: 'cash',
				weight: 1.2,
				items: [
					{
						id: 'i1',
						order_id: 'ord-1',
						product_id: 'p1',
						product_name: 'Tea',
						unit_price: 150,
						quantity: 2,
						total: 300,
						comment: ''
					}
				]
			}
		];

		const csv = buildOrdersCsv(orders, {
			colId: 'Id',
			colDate: 'Date',
			colTotal: 'Total',
			colPaymentMethod: 'Pay',
			colWeight: 'Weight',
			colUnitPrice: 'Unit',
			colQty: 'Qty',
			colSubtotal: 'Sub'
		});

		expect(csv.split('\n')).toHaveLength(2);
		expect(csv).toContain('"Tea (Unit)"');
		expect(csv).toContain('"1.50"');
		expect(csv).toContain('"2"');
		expect(csv).toContain('"3.00"');
	});
});
