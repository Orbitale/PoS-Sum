import { writable, derived, get } from 'svelte/store';
import type { ConfigurationEntry } from '#lib/types.ts';
import { api_call } from '#lib/api.ts';

export type AppConfigMap = Record<string, string>;

function entriesToMap(entries: ConfigurationEntry[]): AppConfigMap {
	const map: AppConfigMap = {};
	for (const entry of entries) {
		map[entry.id] = entry.value;
	}
	return map;
}

export const appConfig = writable<AppConfigMap>({});
export const configLoaded = writable(false);

export const shopName = derived(appConfig, ($c) => $c.shop_name ?? '');
export const orderWeightEnabled = derived(
	appConfig,
	($c) => ($c.order_weight_enabled ?? '0') === '1'
);
export const customProductEnabled = derived(
	appConfig,
	($c) => ($c.custom_product_enabled ?? '0') === '1'
);
export const shopLanguage = derived(appConfig, ($c) => $c.shop_language ?? 'fr');
export const theme = derived(appConfig, ($c) => ($c.theme === 'dark' ? 'dark' : 'light'));

export async function loadAppConfig(): Promise<AppConfigMap> {
	const entries = await api_call<ConfigurationEntry[]>('list_configuration');
	const map = entriesToMap(entries);
	appConfig.set(map);
	configLoaded.set(true);
	return map;
}

export async function setConfigValue(id: string, value: string): Promise<void> {
	const updated = await api_call<ConfigurationEntry>('update_configuration', {
		payload: { id, value }
	});
	appConfig.update((current) => ({ ...current, [updated.id]: updated.value }));
}

export function getConfigValue(id: string, fallback = ''): string {
	return get(appConfig)[id] ?? fallback;
}
