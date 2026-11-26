import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { OrderWithItems } from '#lib/types.ts';

vi.mock('#lib/stores/app-config.ts', async () => {
	const { writable, derived } = await import('svelte/store');
	const appConfig = writable<Record<string, string>>({
		shop_name: 'Café Test',
		company_details: '1 rue de la Paix\n75002 Paris'
	});
	return {
		appConfig,
		shopName: derived(appConfig, ($c) => $c.shop_name ?? ''),
		companyAddress: derived(appConfig, ($c) => $c.company_details ?? ''),
		vatEnabled: derived(appConfig, ($c) => ($c.vat_enabled ?? '0') === '1')
	};
});

import OrderInvoiceModal from './OrderInvoiceModal.svelte';

const order: OrderWithItems = {
	id: 'order-42',
	created_at: '2025-06-15T14:30:00.000Z',
	total: 650,
	vat_total: 0,
	payment_method: 'card',
	weight: null,
	customer_details: 'Jean Dupont\n12 av. Victor Hugo',
	items: [
		{
			id: 'line-1',
			order_id: 'order-42',
			product_id: 'p1',
			product_name: 'Thé',
			unit_price: 150,
			quantity: 2,
			total: 300,
			comment: 'sans sucre',
			vat: 0
		},
		{
			id: 'line-2',
			order_id: 'order-42',
			product_id: 'p2',
			product_name: 'Croissant',
			unit_price: 350,
			quantity: 1,
			total: 350,
			comment: '',
			vat: 0
		}
	]
};

describe('OrderInvoiceModal', () => {
	it('shows shop details and order lines', () => {
		render(OrderInvoiceModal, { props: { order, onClose: vi.fn() } });

		expect(screen.getByText('Café Test')).toBeInTheDocument();
		expect(screen.getByText(/1 rue de la Paix/)).toBeInTheDocument();
		expect(screen.getByText('order-42')).toBeInTheDocument();
		expect(screen.getByText('Thé')).toBeInTheDocument();
		expect(screen.getByText('sans sucre')).toBeInTheDocument();
		expect(screen.getByText('6,50 €')).toBeInTheDocument();
	});

	it('shows stored customer details on the invoice', () => {
		render(OrderInvoiceModal, { props: { order, onClose: vi.fn() } });

		expect(screen.getByText('Client')).toBeInTheDocument();
		expect(screen.getByText(/Jean Dupont/)).toBeInTheDocument();
		expect(screen.getByText(/12 av. Victor Hugo/)).toBeInTheDocument();
	});

	it('closes and triggers print', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

		render(OrderInvoiceModal, { props: { order, onClose } });

		await user.click(screen.getByRole('button', { name: 'Fermer' }));
		expect(onClose).toHaveBeenCalledOnce();

		await user.click(screen.getByRole('button', { name: 'Imprimer' }));
		expect(printSpy).toHaveBeenCalledOnce();

		printSpy.mockRestore();
	});
});
