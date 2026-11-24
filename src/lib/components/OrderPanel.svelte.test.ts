import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem, Product } from '#lib/types.ts';
import { CUSTOM_PRODUCT_CATEGORY_ID } from '#lib/catalog/index.ts';
import { appConfig } from '#lib/stores/app-config.ts';
import OrderPanel from './OrderPanel.svelte';

function product(partial: Partial<Product> & Pick<Product, 'id' | 'name' | 'price'>): Product {
	return {
		category_id: 'drinks',
		available: true,
		fixed_price: true,
		...partial
	};
}

function item(p: Product, quantity = 1, unitPrice = p.price, comment = ''): CartItem {
	return { product: p, quantity, unitPrice, comment };
}

const noopHandlers = {
	onWeightChange: vi.fn(),
	onIncrease: vi.fn(),
	onDecrease: vi.fn(),
	onUnitPriceChange: vi.fn(),
	onCommentChange: vi.fn(),
	onTotalChange: vi.fn(),
	onCheckout: vi.fn(),
	onClear: vi.fn()
};

describe('OrderPanel', () => {
	beforeEach(() => {
		appConfig.set({ order_weight_enabled: '0' });
		vi.stubGlobal('bootstrap', undefined);
		for (const fn of Object.values(noopHandlers)) {
			fn.mockReset();
		}
	});

	it('blocks checkout on an empty cart', () => {
		render(OrderPanel, {
			props: { items: [], weight: '', ...noopHandlers }
		});

		expect(screen.getByRole('button', { name: 'Encaisser' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Effacer' })).toBeDisabled();
	});

	it('changes quantities, clears the cart and starts checkout', async () => {
		const user = userEvent.setup();
		const onIncrease = vi.fn();
		const onDecrease = vi.fn();
		const onCheckout = vi.fn();
		const onClear = vi.fn();
		const items = [item(product({ id: 'a', name: 'Thé', price: 150, fixed_price: false }), 2, 150)];

		render(OrderPanel, {
			props: {
				items,
				weight: '',
				...noopHandlers,
				onIncrease,
				onDecrease,
				onCheckout,
				onClear
			}
		});

		expect(screen.getByTestId('cart-qty-a')).toHaveTextContent('2');
		await user.click(screen.getByRole('button', { name: 'Diminuer la quantité de Thé' }));
		expect(onDecrease).toHaveBeenCalledWith('a');
		await user.click(screen.getByRole('button', { name: 'Augmenter la quantité de Thé' }));
		expect(onIncrease).toHaveBeenCalledWith('a');
		await user.click(screen.getByRole('button', { name: 'Effacer' }));
		expect(onClear).toHaveBeenCalledOnce();
		await user.click(screen.getByRole('button', { name: 'Encaisser' }));
		expect(onCheckout).toHaveBeenCalledOnce();
	});

	it('records optional weight when the feature is enabled', async () => {
		const user = userEvent.setup();
		appConfig.set({ order_weight_enabled: '1' });
		const onWeightChange = vi.fn();

		render(OrderPanel, {
			props: {
				items: [item(product({ id: 'a', name: 'Thé', price: 100 }))],
				weight: '',
				...noopHandlers,
				onWeightChange
			}
		});

		await user.type(screen.getByLabelText(/Poids/), '1.5');
		expect(onWeightChange).toHaveBeenCalled();
	});

	it('edits an open-price line unit price', async () => {
		const user = userEvent.setup();
		const onUnitPriceChange = vi.fn();
		const items = [item(product({ id: 'a', name: 'Thé', price: 200, fixed_price: false }), 1, 200)];

		render(OrderPanel, {
			props: { items, weight: '', ...noopHandlers, onUnitPriceChange }
		});

		await user.click(screen.getByRole('button', { name: 'Modifier le prix' }));
		const input = screen.getByRole('textbox');
		await user.clear(input);
		await user.type(input, '3,00');
		await user.click(screen.getByRole('button', { name: /Confirmer/ }));
		expect(onUnitPriceChange).toHaveBeenCalledWith('a', 300);
	});

	it('keeps the price when the price dialog is cancelled', async () => {
		const user = userEvent.setup();
		const onUnitPriceChange = vi.fn();
		const items = [item(product({ id: 'a', name: 'Thé', price: 200, fixed_price: false }), 1, 200)];

		render(OrderPanel, {
			props: { items, weight: '', ...noopHandlers, onUnitPriceChange }
		});

		await user.click(screen.getByRole('button', { name: 'Modifier le prix' }));
		await user.click(screen.getByRole('button', { name: 'Annuler' }));
		expect(onUnitPriceChange).not.toHaveBeenCalled();
	});

	it('edits the order total for carts with open-price items', async () => {
		const user = userEvent.setup();
		const onTotalChange = vi.fn();
		const items = [
			item(product({ id: 'fixed', name: 'Thé', price: 100, fixed_price: true }), 1, 100),
			item(product({ id: 'open', name: 'Soupe', price: 400, fixed_price: false }), 1, 400)
		];

		render(OrderPanel, {
			props: { items, weight: '', ...noopHandlers, onTotalChange }
		});

		await user.click(screen.getByRole('button', { name: 'Modifier le total' }));
		const input = screen.getByRole('textbox');
		await user.clear(input);
		await user.type(input, '3,50');
		await user.click(screen.getByRole('button', { name: /Confirmer/ }));
		expect(onTotalChange).toHaveBeenCalledWith(350);
	});

	it('refuses a total below the minimum', async () => {
		const user = userEvent.setup();
		const onTotalChange = vi.fn();
		const items = [
			item(product({ id: 'fixed', name: 'Thé', price: 300, fixed_price: true }), 1, 300),
			item(
				product({
					id: 'custom',
					name: 'Service',
					price: 100,
					fixed_price: true,
					category_id: CUSTOM_PRODUCT_CATEGORY_ID
				}),
				1,
				100
			),
			item(product({ id: 'open', name: 'Soupe', price: 400, fixed_price: false }), 1, 400)
		];

		render(OrderPanel, {
			props: { items, weight: '', ...noopHandlers, onTotalChange }
		});

		await user.click(screen.getByRole('button', { name: 'Modifier le total' }));
		const input = screen.getByRole('textbox');
		await user.clear(input);
		await user.type(input, '1,00');
		expect(screen.getByRole('button', { name: /Confirmer/ })).toBeDisabled();
		expect(onTotalChange).not.toHaveBeenCalled();
	});

	it('adds a comment to a line', async () => {
		const user = userEvent.setup();
		const onCommentChange = vi.fn();
		const items = [item(product({ id: 'a', name: 'Thé', price: 100 }), 1, 100)];

		render(OrderPanel, {
			props: { items, weight: '', ...noopHandlers, onCommentChange }
		});

		await user.click(screen.getByRole('button', { name: /Ajouter un commentaire/ }));
		await user.type(screen.getByRole('textbox'), '  sans sucre  ');
		await user.click(screen.getByRole('button', { name: /Enregistrer le commentaire/ }));
		expect(onCommentChange).toHaveBeenCalledWith('a', 'sans sucre');
	});
});
