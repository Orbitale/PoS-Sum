import { describe, expect, it } from 'vitest';
import { urlize } from './urlize.ts';

describe('urlize', () => {
	it('lowercases words and joins them with single dashes', () => {
		expect(urlize('End of Day 2')).toBe('end-of-day-2');
		expect(urlize('  -- Day__one !! ')).toBe('day-one');
	});

	it('transliterates accents and ligatures', () => {
		expect(urlize('Fin de journée')).toBe('fin-de-journee');
		expect(urlize('Soirée des VŒUX, Æther')).toBe('soiree-des-voeux-aether');
	});

	it('only keeps ASCII letters and digits', () => {
		expect(urlize('../../etc/passwd')).toBe('etc-passwd');
		expect(urlize('!!!')).toBe('');
	});
});
