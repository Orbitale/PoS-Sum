import { writable, derived } from 'svelte/store';
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

export const shopName = derived(appConfig, ($c) => $c.shop_name ?? '');
export const companyAddress = derived(appConfig, ($c) => $c.company_details ?? '');
export const orderWeightEnabled = derived(
	appConfig,
	($c) => ($c.order_weight_enabled ?? '0') === '1'
);
export const customProductEnabled = derived(
	appConfig,
	($c) => ($c.custom_product_enabled ?? '0') === '1'
);
export const theme = derived(appConfig, ($c) => ($c.theme === 'dark' ? 'dark' : 'light'));

export async function loadAppConfig(): Promise<AppConfigMap> {
	const entries = await api_call<ConfigurationEntry[]>('list_configuration');
	const map = entriesToMap(entries);
	appConfig.set(map);
	return map;
}

export async function setConfigValue(id: string, value: string): Promise<void> {
	const updated = await api_call<ConfigurationEntry>('update_configuration', {
		payload: { id, value }
	});
	appConfig.update((current) => ({ ...current, [updated.id]: updated.value }));
}
