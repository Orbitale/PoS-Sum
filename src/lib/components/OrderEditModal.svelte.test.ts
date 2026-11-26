import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { OrderWithItems } from '#lib/types.ts';

vi.mock('#lib/stores/app-config.ts', async () => {
	const { writable, derived } = await import('svelte/store');
	const appConfig = writable<Record<string, string>>({ order_weight_enabled: '1' });
	return {
		appConfig,
		orderWeightEnabled: derived(appConfig, ($c) => ($c.order_weight_enabled ?? '0') === '1')
	};
});

import OrderEditModal from './OrderEditModal.svelte';

const order: OrderWithItems = {
	id: 'order-1',
	created_at: '2025-06-15T14:30:00Z',
	total: 500,
	vat_total: 0,
	payment_method: 'cash',
	weight: 1.5,
	customer_details: 'Alice',
	items: [
		{
			id: 'line-1',
			order_id: 'order-1',
			product_id: 'p1',
			product_name: 'Tea',
			unit_price: 500,
			quantity: 1,
			total: 500,
			comment: '',
			vat: 0
		}
	]
};

describe('OrderEditModal', () => {
	it('submits updated order details', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		render(OrderEditModal, { props: { order, onConfirm, onCancel: vi.fn() } });

		const field = screen.getByLabelText('Coordonnées du client');
		await user.clear(field);
		await user.type(field, 'Bob Martin');
		await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

		expect(onConfirm).toHaveBeenCalledWith({
			id: 'order-1',
			weight: 1.5,
			customer_details: 'Bob Martin'
		});
	});

	it('calls onCancel', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		render(OrderEditModal, { props: { order, onConfirm: vi.fn(), onCancel } });
		await user.click(screen.getByRole('button', { name: 'Annuler' }));
		expect(onCancel).toHaveBeenCalledOnce();
	});
});
