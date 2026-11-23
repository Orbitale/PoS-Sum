import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CustomProductModal from './CustomProductModal.svelte';

describe('CustomProductModal (cashier scenarios)', () => {
	it('requires a name before adding to the order', () => {
		render(CustomProductModal, {
			props: { onConfirm: vi.fn(), onCancel: vi.fn() }
		});
		expect(screen.getByRole('button', { name: /Ajouter à la commande/ })).toBeDisabled();
	});

	it('adds an on-the-fly product with a numpad price', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		render(CustomProductModal, {
			props: { onConfirm, onCancel: vi.fn() }
		});

		await user.type(screen.getByLabelText('Nom'), 'Service');
		await user.click(screen.getByRole('button', { name: '5' }));
		await user.click(screen.getByRole('button', { name: ',00' }));
		await user.click(screen.getByRole('button', { name: /Ajouter à la commande/ }));

		expect(onConfirm).toHaveBeenCalledWith({ name: 'Service', priceCents: 500 });
	});

	it('cancels without adding a product', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		const onConfirm = vi.fn();
		render(CustomProductModal, {
			props: { onConfirm, onCancel }
		});

		await user.type(screen.getByLabelText('Nom'), 'X');
		await user.click(screen.getByRole('button', { name: 'Annuler' }));
		expect(onCancel).toHaveBeenCalledOnce();
		expect(onConfirm).not.toHaveBeenCalled();
	});
});
