import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => ({
	page: {
		url: new URL('http://localhost/products')
	}
}));

vi.mock('#lib/stores/app-config.ts', async () => {
	const { writable, derived } = await import('svelte/store');
	const appConfig = writable<Record<string, string>>({
		shop_name: 'Café Test',
		theme: 'light'
	});
	return {
		appConfig,
		shopName: derived(appConfig, ($c) => $c.shop_name ?? ''),
		theme: derived(appConfig, ($c) => ($c.theme === 'dark' ? 'dark' : 'light')),
		setConfigValue: vi.fn().mockResolvedValue(undefined)
	};
});

import { setConfigValue } from '#lib/stores/app-config.ts';
import NavMenu from './NavMenu.svelte';

describe('NavMenu (staff navigation)', () => {
	beforeEach(() => {
		vi.mocked(setConfigValue).mockClear();
		document.body.removeAttribute('data-bs-theme');
	});

	it('highlights the active section and links to the others', () => {
		render(NavMenu);

		expect(document.querySelector('.navbar-brand')).toHaveTextContent('Café Test');
		expect(screen.getByRole('link', { name: 'Produits' })).toHaveAttribute(
			'aria-current',
			'page'
		);
		expect(screen.getByRole('link', { name: 'Point de vente' })).toHaveAttribute('href', '/');
		expect(screen.getByRole('link', { name: 'Commandes' })).toHaveAttribute('href', '/orders');
	});

	it('toggles dark mode for the workstation', async () => {
		const user = userEvent.setup();
		render(NavMenu);

		await user.click(screen.getByRole('button', { name: '🌙' }));
		expect(setConfigValue).toHaveBeenCalledWith('theme', 'dark');
		expect(document.body.getAttribute('data-bs-theme')).toBe('dark');
	});
});
