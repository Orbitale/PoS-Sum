import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { locale, t } from './index.ts';

describe('i18n', () => {
	beforeEach(() => {
		locale.set('fr');
	});

	it('interpolates params', () => {
		expect(get(t)('order.totalBelowMinimum', { minimum: '2,00 €' })).toContain('2,00 €');
		expect(get(t)('order.decreaseQuantity', { name: 'Thé' })).toContain('Thé');
	});

	it('switches locale', () => {
		expect(get(t)('checkout.cash')).toBe('Espèces');
		locale.set('en');
		expect(get(t)('checkout.cash')).toBe('Cash');
	});

	it('falls back to the key when a translation is missing', () => {
		expect(get(t)('does.not.exist')).toBe('does.not.exist');
	});
});
