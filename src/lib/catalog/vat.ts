import { formatPrice } from '#lib/utils/format.ts';

const VAT_RANGE_MESSAGE = 'VAT must be a number between 0 and 100 with at most 2 decimal places';

export function normalizeVat(vat: number | undefined): number {
	const value = vat ?? 0;
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
		throw new Error(VAT_RANGE_MESSAGE);
	}
	const rounded = Math.round(value * 100) / 100;
	if (Math.abs(value - rounded) > 1e-9) {
		throw new Error(VAT_RANGE_MESSAGE);
	}
	return rounded;
}

export { VAT_RANGE_MESSAGE };

export function parseVatInput(input: string): number {
	const trimmed = input.trim().replace(',', '.');
	if (trimmed === '') {
		return 0;
	}
	const value = Number.parseFloat(trimmed);
	return Number.isNaN(value) ? NaN : value;
}

type VatLine = Pick<{ total: number; vat: number }, 'total' | 'vat'>;

/** VAT in cents from a line total and rate (%), rounded half-up to the nearest cent. */
export function vatAmountCents(lineTotalCents: number, vatRatePercent: number): number {
	if (vatRatePercent === 0 || lineTotalCents === 0) {
		return 0;
	}
	return Math.round((lineTotalCents * vatRatePercent) / 100);
}

/** Order VAT: sum raw line VAT, then round once (not sum of rounded line VAT). */
export function orderVatCents(items: ReadonlyArray<VatLine>): number {
	if (items.length === 0) {
		return 0;
	}
	let rawTotal = 0;
	for (const item of items) {
		if (item.vat === 0 || item.total === 0) {
			continue;
		}
		rawTotal += (item.total * item.vat) / 100;
	}
	return Math.round(rawTotal);
}

export function formatVatAmount(lineTotalCents: number, vatRatePercent: number): string {
	return formatPrice(vatAmountCents(lineTotalCents, vatRatePercent));
}

export function formatVatRate(vat: number): string {
	const formatted = new Intl.NumberFormat('fr-FR', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2
	}).format(vat);
	return `${formatted} %`;
}

export function formatVatForInput(vat: number): string {
	if (Number.isInteger(vat)) {
		return String(vat);
	}
	return vat.toFixed(2).replace('.', ',');
}

export function isVatInRange(vat: number): boolean {
	return !Number.isNaN(vat) && vat >= 0 && vat <= 100 && Math.abs(vat - Math.round(vat * 100) / 100) < 1e-9;
}