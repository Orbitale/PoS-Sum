import { describe, expect, it } from 'vitest';
import {
	applyNumpadKey,
	formatCentsToInput,
	parseEurosToCents,
	parseOptionalFloat,
	sanitizeAmountInput
} from './amount.ts';

describe('money parsing / formatting (data core)', () => {
	it('round-trips cents through the editable input format', () => {
		expect(formatCentsToInput(150)).toBe('1,50');
		expect(formatCentsToInput(0)).toBe('0,00');
		expect(formatCentsToInput(-250)).toBe('-2,50');
		expect(parseEurosToCents('1,50')).toBe(150);
		expect(parseEurosToCents('1.50')).toBe(150);
		expect(parseEurosToCents('10')).toBe(1000);
		expect(parseEurosToCents('-2,50')).toBe(-250);
	});

	it('treats empty or invalid euro input as 0 cents', () => {
		expect(parseEurosToCents('')).toBe(0);
		expect(parseEurosToCents('   ')).toBe(0);
		expect(parseEurosToCents('abc')).toBe(0);
	});

	it('rounds fractional cents', () => {
		expect(parseEurosToCents('1,994')).toBe(199);
		expect(parseEurosToCents('1,996')).toBe(200);
	});

	it('parses optional weight floats and rejects garbage', () => {
		expect(parseOptionalFloat('1,5')).toBe(1.5);
		expect(parseOptionalFloat('2.25')).toBe(2.25);
		expect(parseOptionalFloat('')).toBeNull();
		expect(parseOptionalFloat('abc')).toBeNull();
	});
});

describe('amount input sanitization / numpad (data core)', () => {
	it('keeps a single separator and strips letters', () => {
		expect(sanitizeAmountInput('12,3,4')).toBe('12,34');
		expect(sanitizeAmountInput('12.3.4')).toBe('12.34');
		expect(sanitizeAmountInput('1a2b,3c')).toBe('12,3');
	});

	it('can forbid negatives for cash and totals', () => {
		expect(sanitizeAmountInput('-12,50', { allowNegative: false })).toBe('12,50');
		expect(applyNumpadKey('10', '-', { allowNegative: false })).toBe('10');
	});

	it('applies digit, shortcut, backspace, and sign keys', () => {
		expect(applyNumpadKey('1', '2')).toBe('12');
		expect(applyNumpadKey('12', 'backspace')).toBe('1');
		expect(applyNumpadKey('5', ',00')).toBe('5,00');
		expect(applyNumpadKey('5,1', ',50')).toBe('5,50');
		expect(applyNumpadKey('10', '-')).toBe('-10');
		expect(applyNumpadKey('-10', '-')).toBe('10');
	});
});
