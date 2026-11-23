import { describe, expect, it } from 'vitest';
import {
	applyNumpadKey,
	formatCentsToInput,
	parseEurosToCents,
	parseOptionalFloat,
	sanitizeAmountInput
} from './amount.ts';

describe('formatCentsToInput', () => {
	it('formats cents with comma decimal', () => {
		expect(formatCentsToInput(150)).toBe('1,50');
		expect(formatCentsToInput(0)).toBe('0,00');
		expect(formatCentsToInput(-250)).toBe('-2,50');
	});
});

describe('parseEurosToCents', () => {
	it('parses comma and dot decimals', () => {
		expect(parseEurosToCents('1,50')).toBe(150);
		expect(parseEurosToCents('1.50')).toBe(150);
		expect(parseEurosToCents('10')).toBe(1000);
	});

	it('returns 0 for empty or invalid input', () => {
		expect(parseEurosToCents('')).toBe(0);
		expect(parseEurosToCents('   ')).toBe(0);
		expect(parseEurosToCents('abc')).toBe(0);
	});

	it('rounds fractional cents', () => {
		// 1.994 → 199.4 → 199; 1.996 → 199.6 → 200
		expect(parseEurosToCents('1,994')).toBe(199);
		expect(parseEurosToCents('1,996')).toBe(200);
	});
});

describe('parseOptionalFloat', () => {
	it('returns null for empty input', () => {
		expect(parseOptionalFloat('')).toBeNull();
		expect(parseOptionalFloat('  ')).toBeNull();
	});

	it('parses finite numbers', () => {
		expect(parseOptionalFloat('1,5')).toBe(1.5);
		expect(parseOptionalFloat('2.25')).toBe(2.25);
	});
});

describe('sanitizeAmountInput', () => {
	it('keeps a single decimal separator', () => {
		expect(sanitizeAmountInput('12,3,4')).toBe('12,34');
		expect(sanitizeAmountInput('12.3.4')).toBe('12.34');
	});

	it('strips letters', () => {
		expect(sanitizeAmountInput('1a2b,3c')).toBe('12,3');
	});

	it('can disallow negatives', () => {
		expect(sanitizeAmountInput('-12,50', { allowNegative: false })).toBe('12,50');
	});
});

describe('applyNumpadKey', () => {
	it('appends digits and handles backspace', () => {
		expect(applyNumpadKey('1', '2')).toBe('12');
		expect(applyNumpadKey('12', 'backspace')).toBe('1');
	});

	it('applies quick decimal shortcuts', () => {
		expect(applyNumpadKey('5', ',00')).toBe('5,00');
		expect(applyNumpadKey('5,1', ',50')).toBe('5,50');
	});

	it('toggles sign when allowed', () => {
		expect(applyNumpadKey('10', '-')).toBe('-10');
		expect(applyNumpadKey('-10', '-')).toBe('10');
		expect(applyNumpadKey('10', '-', { allowNegative: false })).toBe('10');
	});
});
