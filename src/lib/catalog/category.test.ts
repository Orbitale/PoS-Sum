import { describe, expect, it } from 'vitest';
import { sanitizeCategoryId } from './category.ts';

describe('sanitizeCategoryId', () => {
	it('lowercases and strips invalid characters', () => {
		expect(sanitizeCategoryId('Drinks & Snacks!')).toBe('drinkssnacks');
		expect(sanitizeCategoryId('Café')).toBe('caf');
	});

	it('collapses repeated separators', () => {
		expect(sanitizeCategoryId('hot--drinks')).toBe('hot-drinks');
		expect(sanitizeCategoryId('a..b__c')).toBe('a.b_c');
	});
});
