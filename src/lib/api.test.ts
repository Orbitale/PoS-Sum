import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

import { api_call } from './api.ts';

describe('api_call', () => {
	beforeEach(() => {
		vi.mocked(invoke).mockReset();
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

	it('rejects unimplemented web and static targets', async () => {
		await expect(api_call('list_products', {}, 'web')).rejects.toThrow(
			'Web backend not yet implemented'
		);
		await expect(api_call('list_products', {}, 'static')).rejects.toThrow(
			'Static backend not yet implemented'
		);
		expect(invoke).not.toHaveBeenCalled();
	});
});
