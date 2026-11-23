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
		expect(centsToEurosCsv(0)).toBe('0.00');
	});

	it('joins rows and lines', () => {
		expect(joinCsvRow(['a', 'b'])).toBe('a;b');
		expect(joinCsvLines(['x', 'y'])).toBe('x\ny');
	});
});

describe('buildOrdersCsv', () => {
	const labels = {
		colId: 'Id',
		colDate: 'Date',
		colTotal: 'Total',
		colPaymentMethod: 'Pay',
		colWeight: 'Weight',
		colUnitPrice: 'Unit',
		colQty: 'Qty',
		colSubtotal: 'Sub'
	};

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

		const csv = buildOrdersCsv(orders, labels);
		expect(csv.split('\n')).toHaveLength(2);
		expect(csv).toContain('"Tea (Unit)"');
		expect(csv).toContain('"1.50"');
		expect(csv).toContain('"2"');
		expect(csv).toContain('"3.00"');
	});

	it('emits only the header for an empty order list', () => {
		const csv = buildOrdersCsv([], labels);
		expect(csv.split('\n')).toHaveLength(1);
		expect(csv).toContain('"Id"');
		expect(csv).not.toContain('Tea');
	});

	it('leaves blank product cells when an order lacks that product', () => {
		const orders: OrderWithItems[] = [
			{
				id: 'ord-1',
				created_at: '2026-01-01T10:00:00Z',
				total: 150,
				payment_method: 'cash',
				weight: null,
				items: [
					{
						id: 'i1',
						order_id: 'ord-1',
						product_id: 'p1',
						product_name: 'Tea',
						unit_price: 150,
						quantity: 1,
						total: 150,
						comment: ''
					}
				]
			},
			{
				id: 'ord-2',
				created_at: '2026-01-02T10:00:00Z',
				total: 200,
				payment_method: 'card',
				weight: null,
				items: [
					{
						id: 'i2',
						order_id: 'ord-2',
						product_id: 'p2',
						product_name: 'Coffee',
						unit_price: 200,
						quantity: 1,
						total: 200,
						comment: ''
					}
				]
			}
		];

		const csv = buildOrdersCsv(orders, labels);
		const [, row1, row2] = csv.split('\n');
		expect(csv).toContain('"Tea (Unit)"');
		expect(csv).toContain('"Coffee (Unit)"');
		// ord-1 has Tea filled and Coffee blank triples; count empty quoted cells
		expect(row1.split(';').filter((c) => c === '""').length).toBeGreaterThanOrEqual(3);
		expect(row2.split(';').filter((c) => c === '""').length).toBeGreaterThanOrEqual(3);
	});
});
