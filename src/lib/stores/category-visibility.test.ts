import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	groupAllCategories,
	groupedCategories,
	toggleCategoryGrouped,
	ungroupAllCategories
} from './category-visibility.ts';

describe('category-visibility store', () => {
	beforeEach(() => {
		localStorage.clear();
		ungroupAllCategories();
	});

	it('toggles a category in and out of the grouped set and persists it', () => {
		toggleCategoryGrouped('drinks');
		expect(get(groupedCategories).has('drinks')).toBe(true);
		expect(JSON.parse(localStorage.getItem('pos:grouped-categories') ?? '[]')).toEqual(['drinks']);

		toggleCategoryGrouped('drinks');
		expect(get(groupedCategories).has('drinks')).toBe(false);
	});

	it('groups and ungroups all categories', () => {
		groupAllCategories(['a', 'b']);
		expect([...get(groupedCategories)].sort()).toEqual(['a', 'b']);
		ungroupAllCategories();
		expect(get(groupedCategories).size).toBe(0);
		expect(JSON.parse(localStorage.getItem('pos:grouped-categories') ?? '[]')).toEqual([]);
	});

	it('starts empty when stored JSON is corrupt', async () => {
		localStorage.setItem('pos:grouped-categories', '{not-json');
		vi.resetModules();
		const mod = await import('./category-visibility.ts');
		expect(get(mod.groupedCategories).size).toBe(0);
	});
});
