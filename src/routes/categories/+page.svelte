<script lang="ts">
	import { onMount } from 'svelte';
	import { confirm } from '$lib/confirm.svelte';
	import { api_call } from '$lib/api';
	import type { Category, CreateCategoryPayload, UpdateCategoryPayload } from '$lib/types';
	import CategoryFormModal from '$lib/components/CategoryFormModal.svelte';
	import { t } from '$lib/i18n';

	let categories = $state<Category[]>([]);
	let editingCategory = $state<Category | null>(null);
	let isFormOpen = $state(false);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		await loadCategories();
	});

	async function loadCategories() {
		isLoading = true;
		error = null;
		try {
			categories = await api_call<Category[]>('list_categories');
		} catch (e) {
			error = $t('categories.loadError', { error: String(e) });
		} finally {
			isLoading = false;
		}
	}

	function openCreate() {
		editingCategory = null;
		isFormOpen = true;
	}

	function openEdit(category: Category) {
		editingCategory = category;
		isFormOpen = true;
	}

	function closeForm() {
		isFormOpen = false;
		editingCategory = null;
	}

	async function deleteCategory(category: Category) {
		const confirmed = await confirm($t('categories.deleteConfirm', { label: category.label }));
		if (!confirmed) {
			return;
		}

		try {
			await api_call('delete_category', { categoryId: category.id });
			await loadCategories();
		} catch (e) {
			error = $t('categories.deleteError', { error: String(e) });
		}
	}

	async function handleSave(data: { id: string; label: string; color: string }) {
		try {
			if (editingCategory) {
				const payload: UpdateCategoryPayload = {
					id: data.id,
					label: data.label,
					color: data.color
				};
				await api_call<Category>('update_category', { payload });
			} else {
				const payload: CreateCategoryPayload = {
					id: data.id,
					label: data.label,
					color: data.color
				};
				await api_call<Category>('create_category', { payload });
			}
			closeForm();
			await loadCategories();
		} catch (e) {
			error = $t('categories.saveError', { error: String(e) });
			closeForm();
		}
	}
</script>

<div class="mx-auto px-4 pb-4">
	<div class="d-flex align-items-center justify-content-between pt-4 pb-3">
		<h1 class="h4 m-0 fw-semibold">{$t('categories.title')}</h1>
		<button class="btn btn-primary fw-semibold" onclick={openCreate}>{$t('categories.addButton')}</button>
	</div>

	{#if isLoading}
		<div class="d-flex align-items-center justify-content-center text-muted fs-5" style="height: 200px">{$t('categories.loading')}</div>
	{:else if error}
		<div class="d-flex align-items-center justify-content-center text-danger fs-5" style="height: 200px">{error}</div>
	{:else if categories.length === 0}
		<div class="d-flex align-items-center justify-content-center text-muted fs-5" style="height: 200px">{$t('categories.empty')}</div>
	{:else}
		<div class="table-responsive">
			<table class="table">
				<thead>
					<tr>
						<th class="small text-muted fw-semibold">{$t('categories.colId')}</th>
						<th class="small text-muted fw-semibold">{$t('categories.colLabel')}</th>
						<th class="small text-muted fw-semibold">{$t('categories.colColor')}</th>
						<th class="small text-muted fw-semibold">{$t('categories.colActions')}</th>
					</tr>
				</thead>
				<tbody>
					{#each categories as cat (cat.id)}
						<tr>
							<td><code class="bg-body-secondary px-2 py-1 rounded-1 small">{cat.id}</code></td>
							<td>{cat.label}</td>
							<td>
								<span class="d-inline-block rounded-1 align-middle me-2 border" style="width: 20px; height: 20px; background: {cat.color};"></span>
								<code class="small">{cat.color}</code>
							</td>
							<td class="d-flex gap-1">
								<button class="btn btn-outline-secondary btn-sm fw-semibold" onclick={() => openEdit(cat)}>
									{$t('categories.edit')}
								</button>
								<button class="btn btn-outline-danger btn-sm fw-semibold" onclick={() => deleteCategory(cat)}>
									{$t('categories.delete')}
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
	<CategoryFormModal category={editingCategory} onSave={handleSave} onCancel={closeForm} />
{/if}

<style>
    th {
        text-transform: uppercase;
    }
</style>
