import { describe, expect, it } from 'vitest';
import {
	formatVatAmount,
	formatVatForInput,
	formatVatRate,
	isVatInRange,
	normalizeVat,
	parseVatInput,
	orderVatCents,
	vatAmountCents
} from './vat.ts';

describe('normalizeVat', () => {
	it('defaults missing values to zero', () => {
		expect(normalizeVat(undefined)).toBe(0);
	});

	it('accepts values up to two decimal places', () => {
		expect(normalizeVat(20)).toBe(20);
		expect(normalizeVat(5.5)).toBe(5.5);
		expect(normalizeVat(19.99)).toBe(19.99);
	});

	it('rejects out of range or over-precise values', () => {
		expect(() => normalizeVat(-0.01)).toThrow();
		expect(() => normalizeVat(100.01)).toThrow();
		expect(() => normalizeVat(12.345)).toThrow();
	});
});

describe('parseVatInput', () => {
	it('parses comma decimals', () => {
		expect(parseVatInput('5,5')).toBe(5.5);
		expect(parseVatInput('')).toBe(0);
	});
});

describe('vatAmountCents', () => {
	it('rounds half-up to the nearest cent', () => {
		expect(vatAmountCents(300, 5.5)).toBe(17);
		expect(formatVatAmount(300, 5.5)).toBe('0,17\u00a0€');
	});
});

describe('orderVatCents', () => {
	it('rounds once on the sum of raw line VAT, not summed rounded lines', () => {
		const items = [
			{ total: 301, vat: 5.5 },
			{ total: 302, vat: 5.5 }
		];
		expect(vatAmountCents(items[0].total, items[0].vat) + vatAmountCents(items[1].total, items[1].vat)).toBe(
			34
		);
		expect(orderVatCents(items)).toBe(33);
	});
});

describe('formatVatRate', () => {
	it('formats fractional rates', () => {
		expect(formatVatRate(5.5)).toBe('5,5 %');
	});
});

describe('formatVatForInput', () => {
	it('keeps integers compact', () => {
		expect(formatVatForInput(20)).toBe('20');
		expect(formatVatForInput(5.5)).toBe('5,50');
	});
});

describe('isVatInRange', () => {
	it('matches normalizeVat rules', () => {
		expect(isVatInRange(20)).toBe(true);
		expect(isVatInRange(20.12)).toBe(true);
		expect(isVatInRange(20.123)).toBe(false);
	});
});