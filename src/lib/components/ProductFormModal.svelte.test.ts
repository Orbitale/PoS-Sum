import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Category, Product } from '#lib/types.ts';
import ProductFormModal from './ProductFormModal.svelte';

const categories: Category[] = [
	{ id: 'drinks', label: 'Boissons', color: '#111' },
	{ id: 'food', label: 'Nourriture', color: '#222' }
];

describe('ProductFormModal', () => {
	it('keeps save disabled without a name', () => {
		render(ProductFormModal, {
			props: { product: null, categories, onSave: vi.fn(), onCancel: vi.fn() }
		});
		expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
	});

	it('saves a new product', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		render(ProductFormModal, {
			props: { product: null, categories, onSave, onCancel: vi.fn() }
		});

		await user.type(screen.getByLabelText('Nom'), 'Limonade');
		await user.type(screen.getByLabelText('Prix (EUR)'), '2,50');
		await user.click(screen.getByLabelText('Nourriture'));
		await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

		expect(onSave).toHaveBeenCalledWith({
			name: 'Limonade',
			price: 250,
			category_id: 'food',
			available: true,
			fixed_price: true,
			vat: 0
		});
	});

	it('edits an existing product including availability', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		const product: Product = {
			id: 'p1',
			name: 'Thé',
			price: 150,
			category_id: 'drinks',
			available: true,
			fixed_price: false,
			vat: 0
		};

		render(ProductFormModal, {
			props: { product, categories, onSave, onCancel: vi.fn() }
		});

		expect(screen.getByLabelText('Nom')).toHaveValue('Thé');
		expect(screen.getByLabelText('Prix (EUR)')).toHaveValue('1,50');
		expect(screen.getByLabelText('Prix fixe')).not.toBeChecked();

		await user.click(screen.getByLabelText('Disponible'));
		await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

		expect(onSave).toHaveBeenCalledWith({
			name: 'Thé',
			price: 150,
			category_id: 'drinks',
			available: false,
			fixed_price: false,
			vat: 0
		});
	});

	it('cancels via Escape without saving', async () => {
		const onCancel = vi.fn();
		const onSave = vi.fn();
		render(ProductFormModal, {
			props: { product: null, categories, onSave, onCancel }
		});

		await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		expect(onCancel).toHaveBeenCalledOnce();
		expect(onSave).not.toHaveBeenCalled();
	});
});
