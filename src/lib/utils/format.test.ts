import { describe, expect, it } from 'vitest';
import { formatPrice } from './format.ts';

describe('formatPrice', () => {
	it('formats cents as euro strings with a narrow no-break space', () => {
		expect(formatPrice(150)).toBe('1,50 €');
		expect(formatPrice(0)).toBe('0,00 €');
		expect(formatPrice(5)).toBe('0,05 €');
		expect(formatPrice(1000)).toBe('10,00 €');
	});

	it('keeps the euro sign for negative amounts', () => {
		expect(formatPrice(-250)).toBe('-2,50 €');
	});
});
