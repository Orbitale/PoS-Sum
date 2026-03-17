import { writable, derived } from 'svelte/store';
import fr from './locales/fr.json';
import en from './locales/en.json';

type Messages = Record<string, unknown>;

const locales: Record<string, Messages> = { fr, en };

export const availableLocales = Object.keys(locales);

const STORAGE_KEY = 'pos:locale';

function loadLocale(): string {
	if (typeof localStorage !== 'undefined') {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored && stored in locales) {
			return stored;
		}
	}
	return 'fr';
}

export const locale = writable<string>(loadLocale());

locale.subscribe((value) => {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, value);
	}
});

function resolve(obj: unknown, path: string): string {
	const keys = path.split('.');
	let current: unknown = obj;
	for (const key of keys) {
		if (current === null || current === undefined || typeof current !== 'object') {
			return path;
		}
		current = (current as Record<string, unknown>)[key];
	}
	return typeof current === 'string' ? current : path;
}

export const t = derived(locale, ($locale) => {
	const messages = locales[$locale] ?? locales.fr;
	const fallback = locales.fr;

	return (key: string, params?: Record<string, string>): string => {
		let value = resolve(messages, key);
		if (value === key && messages !== fallback) {
			value = resolve(fallback, key);
		}
		if (params) {
			for (const [k, v] of Object.entries(params)) {
				value = value.replaceAll(`{${k}}`, v);
			}
		}
		return value;
	};
});
