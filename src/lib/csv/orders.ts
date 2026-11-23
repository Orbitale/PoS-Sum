import type { OrderWithItems } from '#lib/types.ts';
import { centsToEurosCsv, joinCsvLines, joinCsvRow, quoteCsv } from './csv.ts';

export interface OrdersCsvLabels {
	colId: string;
	colDate: string;
	colTotal: string;
	colPaymentMethod: string;
	colWeight: string;
	colUnitPrice: string;
	colQty: string;
	colSubtotal: string;
}

export function buildOrdersCsv(orders: OrderWithItems[], labels: OrdersCsvLabels): string {
	const productNames: string[] = [];
	const seen = new Set<string>();
	for (const order of orders) {
		for (const item of order.items) {
			if (!seen.has(item.product_name)) {
				seen.add(item.product_name);
				productNames.push(item.product_name);
			}
		}
	}

	const header = [
		quoteCsv(labels.colId),
		quoteCsv(labels.colDate),
		quoteCsv(labels.colTotal),
		quoteCsv(labels.colPaymentMethod),
		quoteCsv(labels.colWeight)
	];
	for (const name of productNames) {
		header.push(quoteCsv(`${name} (${labels.colUnitPrice})`));
		header.push(quoteCsv(`${name} (${labels.colQty})`));
		header.push(quoteCsv(`${name} (${labels.colSubtotal})`));
	}

	const lines: string[] = [joinCsvRow(header)];

	for (const order of orders) {
		const itemsByProduct = new Map<string, (typeof order.items)[number]>();
		for (const item of order.items) {
			itemsByProduct.set(item.product_name, item);
		}

		const row = [
			quoteCsv(order.id),
			quoteCsv(order.created_at),
			quoteCsv(centsToEurosCsv(order.total)),
			quoteCsv(order.payment_method),
			quoteCsv(order.weight != null ? String(order.weight) : '')
		];
		for (const name of productNames) {
			const item = itemsByProduct.get(name);
			if (item) {
				row.push(quoteCsv(centsToEurosCsv(item.unit_price)));
				row.push(quoteCsv(String(item.quantity)));
				row.push(quoteCsv(centsToEurosCsv(item.total)));
			} else {
				row.push(quoteCsv(''));
				row.push(quoteCsv(''));
				row.push(quoteCsv(''));
			}
		}
		lines.push(joinCsvRow(row));
	}

	return joinCsvLines(lines);
}
