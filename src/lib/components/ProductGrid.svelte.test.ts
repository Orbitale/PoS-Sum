import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Product } from '#lib/types.ts';
import { appConfig } from '#lib/stores/app-config.ts';
import { groupedCategories } from '#lib/stores/category-visibility.ts';
import ProductGrid from './ProductGrid.svelte';

const categories: Category[] = [
	{ id: 'drinks', label: 'Boissons', color: '#abcdef' },
	{ id: 'food', label: 'Nourriture', color: '#fedcba' }
];

const products: Product[] = [
	{
		id: 'p1',
		name: 'Thé',
		price: 150,
		category_id: 'drinks',
		available: true,
		fixed_price: true
	},
	{
		id: 'p2',
		name: 'Soup',
		price: 400,
		category_id: 'food',
		available: true,
		fixed_price: false
	},
	{
		id: 'p3',
		name: 'Old',
		price: 100,
		category_id: 'drinks',
		available: false,
		fixed_price: true
	}
];

describe('ProductGrid (cashier scenarios)', () => {
	beforeEach(() => {
		appConfig.set({ custom_product_enabled: '0' });
		groupedCategories.set(new Set());
	});

	it('adds an available product and ignores unavailable ones', async () => {
		const user = userEvent.setup();
		const onProductClick = vi.fn();
		render(ProductGrid, {
			props: { products, categories, onProductClick }
		});

		expect(screen.getByRole('button', { name: /Old/ })).toBeDisabled();
		await user.click(screen.getByRole('button', { name: /Thé/ }));
		expect(onProductClick).toHaveBeenCalledWith(products[0]);
	});

	it('offers a custom product entry when enabled', async () => {
		const user = userEvent.setup();
		const onCreateCustomProduct = vi.fn();
		appConfig.set({ custom_product_enabled: '1' });

		render(ProductGrid, {
			props: {
				products,
				categories,
				onProductClick: vi.fn(),
				onCreateCustomProduct
			}
		});

		await user.click(screen.getByRole('button', { name: 'Créer un produit personnalisé' }));
		expect(onCreateCustomProduct).toHaveBeenCalledOnce();
	});

	it('opens a grouped category then returns to the root grid', async () => {
		const user = userEvent.setup();
		groupedCategories.set(new Set(['drinks']));

		render(ProductGrid, {
			props: { products, categories, onProductClick: vi.fn() }
		});

		expect(screen.queryByText('Thé')).not.toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Boissons' }));
		expect(screen.getByText('Thé')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: /RETOUR/ }));
		expect(screen.queryByText('Thé')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Boissons' })).toBeInTheDocument();
	});
});
