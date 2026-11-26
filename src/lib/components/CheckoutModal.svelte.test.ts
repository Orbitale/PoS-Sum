import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CartItem, Product } from '#lib/types.ts';
import CheckoutModal from './CheckoutModal.svelte';

function cartItem(partial: Partial<Product> & Pick<Product, 'id' | 'name' | 'price'>): CartItem {
	return {
		product: {
			category_id: 'drinks',
			available: true,
			fixed_price: true,
			...partial
		},
		quantity: 2,
		unitPrice: partial.price,
		comment: 'note'
	};
}

describe('CheckoutModal', () => {
	const items = [cartItem({ id: 'p1', name: 'Thé', price: 150 })];

	it('shows the ticket and blocks confirm until a payment method is chosen', () => {
		render(CheckoutModal, {
			props: { items, total: 300, onConfirm: vi.fn(), onCancel: vi.fn() }
		});

		expect(screen.getByText(/2x Thé/)).toBeInTheDocument();
		expect(screen.getByText('note')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Confirmer' })).toBeDisabled();
	});

	it('confirms card or check without asking for cash received', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		const { unmount } = render(CheckoutModal, {
			props: { items, total: 300, onConfirm, onCancel: vi.fn() }
		});

		await user.click(screen.getByRole('button', { name: /Carte/ }));
		await user.click(screen.getByRole('button', { name: 'Confirmer' }));
		expect(onConfirm).toHaveBeenCalledWith('card', '');

		unmount();
		onConfirm.mockReset();
		render(CheckoutModal, {
			props: { items, total: 300, onConfirm, onCancel: vi.fn() }
		});
		await user.click(screen.getByRole('button', { name: /Chèque/ }));
		await user.click(screen.getByRole('button', { name: 'Confirmer' }));
		expect(onConfirm).toHaveBeenCalledWith('check', '');
	});

	it('treats empty cash received as exact payment of the total', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		render(CheckoutModal, {
			props: { items, total: 300, onConfirm, onCancel: vi.fn() }
		});

		await user.click(screen.getByRole('button', { name: /Espèces/ }));
		await user.click(screen.getByRole('button', { name: 'Confirmer' }));
		expect(onConfirm).toHaveBeenCalledWith('cash', '');
	});

	it('passes customer details on confirm', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		render(CheckoutModal, {
			props: { items, total: 300, onConfirm, onCancel: vi.fn() }
		});

		await user.type(screen.getByLabelText('Coordonnées du client'), 'Jean Dupont');
		await user.click(screen.getByRole('button', { name: /Carte/ }));
		await user.click(screen.getByRole('button', { name: 'Confirmer' }));
		expect(onConfirm).toHaveBeenCalledWith('card', 'Jean Dupont');
	});

	it('blocks underpaid cash and accepts enough cash', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		render(CheckoutModal, {
			props: { items, total: 300, onConfirm, onCancel: vi.fn() }
		});

		await user.click(screen.getByRole('button', { name: /Espèces/ }));
		const cashInput = screen.getByLabelText(/Montant reçu|Amount received/);
		await user.clear(cashInput);
		await user.type(cashInput, '1,00');
		expect(screen.getByRole('button', { name: 'Confirmer' })).toBeDisabled();

		await user.clear(cashInput);
		await user.type(cashInput, '5,00');
		expect(screen.getByText(/Monnaie/)).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Confirmer' }));
		expect(onConfirm).toHaveBeenCalledWith('cash', '');
	});

	it('cancels checkout without confirming payment', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		const onConfirm = vi.fn();
		render(CheckoutModal, {
			props: { items, total: 300, onConfirm, onCancel }
		});

		await user.click(screen.getByRole('button', { name: /Carte/ }));
		await user.click(screen.getByRole('button', { name: 'Annuler' }));
		expect(onCancel).toHaveBeenCalledOnce();
		expect(onConfirm).not.toHaveBeenCalled();
	});
});
