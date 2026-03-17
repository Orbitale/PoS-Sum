<script lang="ts">
	import { onMount } from 'svelte';
	import { confirm } from '$lib/confirm.svelte';
	import { api_call } from '$lib/api';
	import type { Product, Category, CreateProductPayload, UpdateProductPayload } from '$lib/types';
	import { formatPrice } from '$lib/utils/format';
	import ProductFormModal from '$lib/components/ProductFormModal.svelte';
	import { t } from '$lib/i18n';

	let products = $state<Product[]>([]);
	let categories = $state<Category[]>([]);
	let editingProduct = $state<Product | null>(null);
	let isFormOpen = $state(false);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	let categoryMap = $derived(Object.fromEntries(categories.map((c) => [c.id, c])));

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		isLoading = true;
		error = null;
		try {
			[products, categories] = await Promise.all([
				api_call<Product[]>('list_products'),
				api_call<Category[]>('list_categories')
			]);
		} catch (e) {
			error = $t('products.loadError', { error: String(e) });
		} finally {
			isLoading = false;
		}
	}

	function openCreate() {
		editingProduct = null;
		isFormOpen = true;
	}

	function openEdit(product: Product) {
		editingProduct = product;
		isFormOpen = true;
	}

	function closeForm() {
		isFormOpen = false;
		editingProduct = null;
	}

	async function handleSave(data: {
		name: string;
		price: number;
		category_id: string;
		available: boolean;
	}) {
		try {
			if (editingProduct) {
				const payload: UpdateProductPayload = {
					id: editingProduct.id,
					name: data.name,
					price: data.price,
					category_id: data.category_id,
					available: data.available
				};
				await api_call<Product>('update_product', { payload });
			} else {
				const payload: CreateProductPayload = {
					name: data.name,
					price: data.price,
					category_id: data.category_id
				};
				await api_call<Product>('create_product', { payload });
			}
			closeForm();
			await loadData();
		} catch (e) {
			error = $t('products.saveError', { error: String(e) });
			closeForm();
		}
	}

	async function toggleAvailability(productId: string) {
		try {
			const newAvailable = await api_call<boolean>('toggle_product_availability', { productId });
			products = products.map((p) => (p.id === productId ? { ...p, available: newAvailable } : p));
		} catch (e) {
			error = $t('products.toggleError', { error: String(e) });
		}
	}

	async function deleteProduct(product: Product) {
		const confirmed = await confirm($t('products.deleteConfirm', { name: product.name }));
		if (!confirmed) {
			return;
		}

		try {
			await api_call('delete_product', { productId: product.id });
			await loadData();
		} catch (e) {
			error = $t('products.deleteError', { error: String(e) });
		}
	}
</script>

<div class="mx-auto px-4 pb-4">
	<div class="d-flex align-items-center justify-content-between pt-4 pb-3">
		<h1 class="h4 m-0 fw-semibold">{$t('products.title')}</h1>
		<button class="btn btn-primary fw-semibold" onclick={openCreate}>{$t('products.addButton')}</button>
	</div>

	{#if isLoading}
		<div class="d-flex align-items-center justify-content-center text-muted fs-5" style="height: 200px">{$t('products.loading')}</div>
	{:else if error}
		<div class="d-flex align-items-center justify-content-center text-danger fs-5" style="height: 200px">{error}</div>
	{:else if products.length === 0}
		<div class="d-flex align-items-center justify-content-center text-muted fs-5" style="height: 200px">{$t('products.empty')}</div>
	{:else}
		<div class="table-responsive">
			<table class="table">
				<thead>
					<tr>
						<th scope="col" class="small text-muted fw-semibold">{$t('products.colName')}</th>
						<th scope="col" class="small text-muted fw-semibold">{$t('products.colPrice')}</th>
						<th scope="col" class="small text-muted fw-semibold">{$t('products.colCategory')}</th>
						<th scope="col" class="small text-muted fw-semibold">{$t('products.colAvailable')}</th>
						<th scope="col" class="small text-muted fw-semibold">{$t('products.colActions')}</th>
					</tr>
				</thead>
				<tbody>
					{#each products as product (product.id)}
						<tr class:opacity-50={!product.available}>
							<td>{product.name}</td>
							<td class="price">{formatPrice(product.price)}</td>
							<td>
								<span
									class="badge"
									style="background: {categoryMap[product.category_id]?.color ??
										'#888'}22; color: {categoryMap[product.category_id]?.color ?? '#888'};"
								>
									{categoryMap[product.category_id]?.label ?? product.category_id}
								</span>
							</td>
							<td>
								<button
									class="btn btn-sm fw-semibold {product.available ? 'btn-success' : 'btn-danger'}"
									onclick={() => toggleAvailability(product.id)}
								>
									{product.available ? $t('products.yes') : $t('products.no')}
								</button>
							</td>
							<td class="d-flex gap-1">
								<button class="btn btn-outline-secondary btn-sm fw-semibold" onclick={() => openEdit(product)}>
									{$t('products.edit')}
								</button>
								<button class="btn btn-outline-danger btn-sm fw-semibold" onclick={() => deleteProduct(product)}>
									{$t('products.delete')}
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if isFormOpen}
	<ProductFormModal
		product={editingProduct}
		{categories}
		onSave={handleSave}
		onCancel={closeForm}
	/>
{/if}

<style>
	th {
		text-transform: uppercase;
	}
	td.price {
		white-space: nowrap;
	}
</style>
