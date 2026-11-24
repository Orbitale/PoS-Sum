import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { invoke as invokeBrowser } from '#lib/backend-browser/index.ts';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
	isTauri: vi.fn()
}));

vi.mock('#lib/backend-browser/index.ts', () => ({
	invoke: vi.fn()
}));

import { api_call } from './api.ts';

describe('api_call', () => {
	beforeEach(() => {
		vi.mocked(invoke).mockReset();
		vi.mocked(isTauri).mockReset().mockReturnValue(true);
		vi.mocked(invokeBrowser).mockReset();
	});

	it('forwards tauri commands to invoke', async () => {
		vi.mocked(invoke).mockResolvedValueOnce([{ id: 'p1' }]);
		await expect(api_call('list_products', { active: true }, 'tauri')).resolves.toEqual([
			{ id: 'p1' }
		]);
		expect(invoke).toHaveBeenCalledWith('list_products', { active: true });
	});

	it('propagates invoke failures', async () => {
		vi.mocked(invoke).mockRejectedValueOnce(new Error('backend down'));
		await expect(api_call('list_orders', {}, 'tauri')).rejects.toThrow('backend down');
	});

	it('rejects the tauri target outside of the Tauri app', async () => {
		vi.mocked(isTauri).mockReturnValue(false);
		await expect(api_call('list_products', {}, 'tauri')).rejects.toThrow(
			'Wrong backend configured'
		);
		expect(invoke).not.toHaveBeenCalled();
	});

	it('forwards static commands to the browser backend', async () => {
		vi.mocked(invokeBrowser).mockResolvedValueOnce([{ id: 'p1' }]);
		await expect(api_call('list_products', { active: true }, 'static')).resolves.toEqual([
			{ id: 'p1' }
		]);
		expect(invokeBrowser).toHaveBeenCalledWith('list_products', { active: true });
		expect(invoke).not.toHaveBeenCalled();
	});

	it('rejects the unimplemented web target', async () => {
		await expect(api_call('list_products', {}, 'web')).rejects.toThrow(
			'Web backend not yet implemented'
		);
		expect(invoke).not.toHaveBeenCalled();
		expect(invokeBrowser).not.toHaveBeenCalled();
	});
});
