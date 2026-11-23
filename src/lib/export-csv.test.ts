import { beforeEach, describe, expect, it, vi } from 'vitest';

const save = vi.fn();
const writeFile = vi.fn();

vi.mock('@tauri-apps/plugin-dialog', () => ({
	save: (...args: unknown[]) => save(...args)
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
	writeFile: (...args: unknown[]) => writeFile(...args)
}));

import { downloadCsv } from './export-csv.ts';

describe('downloadCsv', () => {
	beforeEach(() => {
		save.mockReset();
		writeFile.mockReset();
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => 'blob:csv'),
			revokeObjectURL: vi.fn()
		});
	});

	it('writes via Tauri dialog when a path is chosen', async () => {
		save.mockResolvedValueOnce('/tmp/orders.csv');
		writeFile.mockResolvedValueOnce(undefined);
		const stream = vi.fn(() => 'fake-stream');
		Object.defineProperty(Blob.prototype, 'stream', {
			configurable: true,
			value: stream
		});

		await downloadCsv('orders.csv', 'a;b', 'tauri');

		expect(save).toHaveBeenCalledWith({
			defaultPath: 'orders.csv',
			filters: [{ name: 'CSV', extensions: ['csv'] }]
		});
		expect(writeFile).toHaveBeenCalledWith('/tmp/orders.csv', 'fake-stream');
		expect(stream).toHaveBeenCalledOnce();
	});

	it('does nothing when the Tauri save dialog is cancelled', async () => {
		save.mockResolvedValueOnce(null);
		await downloadCsv('orders.csv', 'a;b', 'tauri');
		expect(writeFile).not.toHaveBeenCalled();
	});

	it('triggers an anchor download for non-tauri targets', async () => {
		const click = vi.fn();
		const anchor = { click, href: '', download: '' } as unknown as HTMLAnchorElement;
		vi.spyOn(document, 'createElement').mockReturnValue(anchor);

		await downloadCsv('orders.csv', 'a;b\n1;2', 'web');

		expect(anchor.download).toBe('orders.csv');
		expect(anchor.href).toBe('blob:csv');
		expect(click).toHaveBeenCalledOnce();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:csv');
	});
});
