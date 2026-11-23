import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { _respond, confirm, confirmState } from '#lib/confirm.svelte.ts';
import ConfirmModal from './ConfirmModal.svelte';

describe('ConfirmModal', () => {
	afterEach(() => {
		if (confirmState.isOpen) {
			_respond(false);
		}
	});

	it('stays hidden until confirm() is called', () => {
		render(ConfirmModal);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('resolves true when confirmed', async () => {
		const user = userEvent.setup();
		render(ConfirmModal);

		const promise = confirm('Supprimer cet élément ?');
		expect(await screen.findByText('Supprimer cet élément ?')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Confirmer' }));
		await expect(promise).resolves.toBe(true);
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('resolves false when cancelled', async () => {
		const user = userEvent.setup();
		render(ConfirmModal);

		const promise = confirm('Abandonner ?');
		await screen.findByText('Abandonner ?');
		await user.click(screen.getByRole('button', { name: 'Annuler' }));
		await expect(promise).resolves.toBe(false);
	});

	it('resolves false on Escape', async () => {
		render(ConfirmModal);
		const promise = confirm('Quitter ?');
		await screen.findByRole('dialog');
		await fireEvent.keyDown(window, { key: 'Escape' });
		await expect(promise).resolves.toBe(false);
	});
});
