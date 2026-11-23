import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#lib/api.ts', () => ({
	api_call: vi.fn()
}));

import { api_call } from '#lib/api.ts';
import {
	appConfig,
	configLoaded,
	customProductEnabled,
	getConfigValue,
	loadAppConfig,
	orderWeightEnabled,
	setConfigValue,
	shopLanguage,
	shopName,
	theme
} from './app-config.ts';

describe('app-config store', () => {
	beforeEach(() => {
		appConfig.set({});
		configLoaded.set(false);
		vi.mocked(api_call).mockReset();
	});

	it('derives config flags and defaults', () => {
		expect(get(shopName)).toBe('');
		expect(get(orderWeightEnabled)).toBe(false);
		expect(get(customProductEnabled)).toBe(false);
		expect(get(shopLanguage)).toBe('fr');
		expect(get(theme)).toBe('light');

		appConfig.set({
			shop_name: 'Café Test',
			order_weight_enabled: '1',
			custom_product_enabled: '1',
			shop_language: 'en',
			theme: 'dark'
		});

		expect(get(shopName)).toBe('Café Test');
		expect(get(orderWeightEnabled)).toBe(true);
		expect(get(customProductEnabled)).toBe(true);
		expect(get(shopLanguage)).toBe('en');
		expect(get(theme)).toBe('dark');
		expect(getConfigValue('shop_name')).toBe('Café Test');
		expect(getConfigValue('missing', 'fallback')).toBe('fallback');
	});

	it('treats unknown theme values as light', () => {
		appConfig.set({ theme: 'purple' });
		expect(get(theme)).toBe('light');
	});

	it('loads configuration entries from the API', async () => {
		vi.mocked(api_call).mockResolvedValueOnce([
			{ id: 'shop_name', value: 'POS' },
			{ id: 'theme', value: 'light' }
		]);

		const map = await loadAppConfig();
		expect(map).toEqual({ shop_name: 'POS', theme: 'light' });
		expect(get(appConfig)).toEqual({ shop_name: 'POS', theme: 'light' });
		expect(get(configLoaded)).toBe(true);
		expect(api_call).toHaveBeenCalledWith('list_configuration');
	});

	it('propagates load failures without marking config as loaded', async () => {
		vi.mocked(api_call).mockRejectedValueOnce(new Error('offline'));
		await expect(loadAppConfig()).rejects.toThrow('offline');
		expect(get(configLoaded)).toBe(false);
	});

	it('updates a single configuration value', async () => {
		appConfig.set({ theme: 'light' });
		vi.mocked(api_call).mockResolvedValueOnce({ id: 'theme', value: 'dark' });

		await setConfigValue('theme', 'dark');
		expect(get(theme)).toBe('dark');
		expect(api_call).toHaveBeenCalledWith('update_configuration', {
			payload: { id: 'theme', value: 'dark' }
		});
	});

	it('propagates update failures without changing the store', async () => {
		appConfig.set({ theme: 'light' });
		vi.mocked(api_call).mockRejectedValueOnce(new Error('denied'));
		await expect(setConfigValue('theme', 'dark')).rejects.toThrow('denied');
		expect(get(theme)).toBe('light');
	});
});
