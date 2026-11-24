import { APP_TARGET, type AppTarget } from '#lib/api.ts';

export async function downloadCsv(
	filename: string,
	csv: string,
	target: AppTarget = APP_TARGET
): Promise<void> {
	if (target === 'tauri') {
		const { save } = await import('@tauri-apps/plugin-dialog');
		const { writeFile } = await import('@tauri-apps/plugin-fs');

		const path = await save({
			defaultPath: filename,
			filters: [{ name: 'CSV', extensions: ['csv'] }]
		});

		if (!path) {
			return;
		}

		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		await writeFile(path, blob.stream());
		return;
	}

	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
