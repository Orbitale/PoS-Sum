import { invoke } from '@tauri-apps/api/core';

export type AppTarget = 'tauri' | 'web' | 'static';

declare const __APP_TARGET__: string;
export const APP_TARGET = __APP_TARGET__ as AppTarget;

export async function api_call<T = void>(
	command: string,
	params: Record<string, unknown> = {},
	target: AppTarget = APP_TARGET
): Promise<T> {
	switch (target) {
		case 'tauri':
			return invoke<T>(command, params);
		case 'web':
			throw new Error('Web backend not yet implemented');
		case 'static': {
			const browserBackend = await import('#lib/backend-browser/index.ts');
			return browserBackend.invoke<T>(command, params);
		}
	}
}
