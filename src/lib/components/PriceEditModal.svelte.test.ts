import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PriceEditModal from './PriceEditModal.svelte';

describe('PriceEditModal', () => {
	it('shows the original and minimum totals', () => {
		render(PriceEditModal, {
			props: {
				title: 'Modifier le total de la commande',
				label: 'Total',
				initialCents: 500,
				originalCents: 500,
				minimumCents: 200,
				allowNegative: false,
				onConfirm: vi.fn(),
				onCancel: vi.fn()
			}
		});

		expect(screen.getByRole('textbox')).toHaveValue('5,00');
		expect(screen.getByText(/Original/)).toBeInTheDocument();
		expect(screen.getByText(/Minimum/)).toBeInTheDocument();
	});

	it('blocks confirming a total below the minimum', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		render(PriceEditModal, {
			props: {
				initialCents: 500,
				minimumCents: 400,
				allowNegative: false,
				onConfirm,
				onCancel: vi.fn()
			}
		});

		const input = screen.getByRole('textbox');
		await user.clear(input);
		await user.type(input, '1,00');
		expect(screen.getByRole('button', { name: /Confirmer/ })).toBeDisabled();
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it('confirms a valid typed amount', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		render(PriceEditModal, {
			props: {
				initialCents: 100,
				onConfirm,
				onCancel: vi.fn()
			}
		});

		const input = screen.getByRole('textbox');
		await user.clear(input);
		await user.type(input, '1,25');
		await user.click(screen.getByRole('button', { name: /Confirmer/ }));
		expect(onConfirm).toHaveBeenCalledWith(125);
	});

	it('cancels via button or Escape', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		const { unmount } = render(PriceEditModal, {
			props: { initialCents: 100, onConfirm: vi.fn(), onCancel }
		});

		await user.click(screen.getByRole('button', { name: 'Annuler' }));
		expect(onCancel).toHaveBeenCalledOnce();

		unmount();
		onCancel.mockReset();
		render(PriceEditModal, {
			props: { initialCents: 100, onConfirm: vi.fn(), onCancel }
		});
		await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		expect(onCancel).toHaveBeenCalledOnce();
	});
});
