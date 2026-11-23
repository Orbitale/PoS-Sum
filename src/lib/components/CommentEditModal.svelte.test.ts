import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CommentEditModal from './CommentEditModal.svelte';

describe('CommentEditModal', () => {
	it('shows the product name and initial comment', () => {
		render(CommentEditModal, {
			props: {
				productName: 'Thé',
				initialComment: 'sans sucre',
				onConfirm: vi.fn(),
				onCancel: vi.fn()
			}
		});

		expect(screen.getByText('Thé')).toBeInTheDocument();
		expect(screen.getByRole('textbox')).toHaveValue('sans sucre');
	});

	it('confirms a trimmed comment', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		render(CommentEditModal, {
			props: {
				productName: 'Café',
				initialComment: '',
				onConfirm,
				onCancel: vi.fn()
			}
		});

		await user.type(screen.getByRole('textbox'), '  extra shot  ');
		await user.click(screen.getByRole('button', { name: 'Enregistrer le commentaire' }));
		expect(onConfirm).toHaveBeenCalledWith('extra shot');
	});

	it('cancels from the cancel button', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		const onConfirm = vi.fn();
		render(CommentEditModal, {
			props: {
				productName: 'Café',
				initialComment: '',
				onConfirm,
				onCancel
			}
		});

		await user.click(screen.getByRole('button', { name: 'Annuler' }));
		expect(onCancel).toHaveBeenCalledOnce();
		expect(onConfirm).not.toHaveBeenCalled();
	});
});
