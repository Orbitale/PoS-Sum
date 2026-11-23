import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CategoryFormModal from './CategoryFormModal.svelte';

describe('CategoryFormModal', () => {
	it('keeps save disabled until id and label are filled', () => {
		render(CategoryFormModal, {
			props: { category: null, onSave: vi.fn(), onCancel: vi.fn() }
		});
		expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
	});

	it('creates a sanitized category id', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		render(CategoryFormModal, {
			props: { category: null, onSave, onCancel: vi.fn() }
		});

		await user.type(screen.getByLabelText(/ID/), 'Hot Drinks!!');
		await user.type(screen.getByLabelText('Libellé'), 'Boissons chaudes');
		await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

		expect(onSave).toHaveBeenCalledWith({
			id: 'hotdrinks',
			label: 'Boissons chaudes',
			color: '#6b7280'
		});
	});

	it('disables the id field when editing', () => {
		render(CategoryFormModal, {
			props: {
				category: { id: 'drinks', label: 'Boissons', color: '#112233' },
				onSave: vi.fn(),
				onCancel: vi.fn()
			}
		});

		expect(screen.getByLabelText(/ID/)).toBeDisabled();
		expect(screen.getByLabelText(/ID/)).toHaveValue('drinks');
		expect(screen.getByLabelText('Libellé')).toHaveValue('Boissons');
	});

	it('cancels via button and Escape', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		const { unmount } = render(CategoryFormModal, {
			props: { category: null, onSave: vi.fn(), onCancel }
		});

		await user.click(screen.getByRole('button', { name: 'Annuler' }));
		expect(onCancel).toHaveBeenCalledOnce();

		unmount();
		onCancel.mockReset();
		render(CategoryFormModal, {
			props: { category: null, onSave: vi.fn(), onCancel }
		});
		await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		expect(onCancel).toHaveBeenCalledOnce();
	});
});
