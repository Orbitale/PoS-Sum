<script lang="ts">
	import type { Product, Category } from '#lib/types.ts';
	import { formatPrice } from '#lib/utils/format.ts';
	import { groupedCategories } from '#lib/stores/category-visibility.ts';
	import { customProductEnabled } from '#lib/stores/app-config.ts';
	import { t } from '#lib/i18n/index.ts';

	interface Props {
		products: Product[];
		categories: Category[];
		onProductClick: (product: Product) => void;
		onCreateCustomProduct?: () => void;
	}

	let { products, categories, onProductClick, onCreateCustomProduct }: Props = $props();

	let expandedCategoryId = $state<string | null>(null);

	let categoryMap = $derived(Object.fromEntries(categories.map((c) => [c.id, c])));

	let sortedProducts = $derived(
		[...products].sort((a, b) => {
			if (a.available !== b.available) {
				return a.available ? -1 : 1;
			}
			const catA = categoryMap[a.category_id]?.label ?? a.category_id;
			const catB = categoryMap[b.category_id]?.label ?? b.category_id;
			const catCmp = catA.localeCompare(catB);
			if (catCmp !== 0) {
				return catCmp;
			}
			return a.name.localeCompare(b.name);
		})
	);

	let categoryColors = $derived(Object.fromEntries(categories.map((c) => [c.id, c.color])));

	type DisplayItem =
		{ type: 'product'; product: Product } | { type: 'category'; category: Category };

	let displayItems = $derived.by((): DisplayItem[] => {
		if (expandedCategoryId) {
			return sortedProducts
				.filter((p) => p.category_id === expandedCategoryId)
				.map((p) => ({ type: 'product' as const, product: p }));
		}

		const items: DisplayItem[] = [];
		const seenGrouped = new Set<string>();

		for (const product of sortedProducts) {
			if ($groupedCategories.has(product.category_id)) {
				if (!seenGrouped.has(product.category_id)) {
					seenGrouped.add(product.category_id);
					const cat = categoryMap[product.category_id];
					if (cat) {
						items.push({ type: 'category', category: cat });
					}
				}
			} else {
				items.push({ type: 'product', product });
			}
		}

		return items;
	});
</script>

<div class="d-grid gap-2 p-2" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));">
	{#if expandedCategoryId}
		<button
			class="gridBtn btn text-black fw-bold rounded-3"
			onclick={() => (expandedCategoryId = null)}
		>
			<span>&larr;&nbsp;{$t('sales.back')}</span>
		</button>
	{/if}

	{#if $customProductEnabled && onCreateCustomProduct}
		<button
			class="gridBtn btn fw-semibold rounded-3 custom-product"
			onclick={onCreateCustomProduct}
		>
			<span>{$t('sales.createCustomProduct')}</span>
		</button>
	{/if}

	{#each displayItems as item (item.type === 'product' ? item.product.id : item.category.id)}
		{#if item.type === 'category'}
			<button
				class="gridBtn btn fw-semibold rounded-3 category"
				style="background: {item.category.color};"
				onclick={() => (expandedCategoryId = item.category.id)}
			>
				<span>{item.category.label}</span>
			</button>
		{:else}
			<button
				class="gridBtn btn fw-semibold rounded-3"
				class:opacity-50={!item.product.available}
				style="background: {!item.product.available
					? '#999'
					: (categoryColors[item.product.category_id] ?? '#888')};"
				onclick={() => onProductClick(item.product)}
				disabled={!item.product.available}
			>
				<span class:text-decoration-line-through={!item.product.available}>
					{item.product.name}
				</span>
				<span class="small fw-normal" class:text-decoration-line-through={!item.product.available}>
					{#if !item.product.fixed_price}
						🕊️ <i>{formatPrice(item.product.price)}</i>
					{:else}
						{formatPrice(item.product.price)}
					{/if}
				</span>
			</button>
		{/if}
	{/each}
</div>

<style>
	/* btn d-flex flex-column align-items-center justify-content-center */
	.gridBtn {
		min-height: 80px;
		color: white;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.gridBtn.category {
		border-width: 8px;
		border-color: rgba(255, 255, 255, 0.7);
		border-style: dashed;
	}
	.gridBtn.custom-product {
		background: #495057;
		border: 2px dashed rgba(255, 255, 255, 0.55);
	}
</style>
