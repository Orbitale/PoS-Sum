import { writable } from 'svelte/store';

const STORAGE_KEY = 'pos:grouped-categories';

function loadGrouped(): Set<string> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			return new Set(JSON.parse(raw));
		}
	} catch {
		// ignore corrupt data
	}
	return new Set();
}

function persist(set: Set<string>) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export const groupedCategories = writable<Set<string>>(loadGrouped());

export function toggleCategoryGrouped(id: string) {
	groupedCategories.update((set) => {
		if (set.has(id)) {
			set.delete(id);
		} else {
			set.add(id);
		}
		persist(set);
		return set;
	});
}

export function groupAllCategories(ids: string[]) {
	groupedCategories.update((set) => {
		for (const id of ids) {
			set.add(id);
		}
		persist(set);
		return set;
	});
}

export function ungroupAllCategories() {
	groupedCategories.update((set) => {
		set.clear();
		persist(set);
		return set;
	});
}
