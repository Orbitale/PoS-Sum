<script lang="ts">
	import type { Product, Category } from '$lib/types';
	import { t } from '$lib/i18n';

	interface Props {
		product: Product | null;
		categories: Category[];
		onSave: (data: {
			name: string;
			price: number;
			category_id: string;
			available: boolean;
		}) => void;
		onCancel: () => void;
	}

	let { product, categories, onSave, onCancel }: Props = $props();

	let name = $derived(product?.name ?? '');
	let priceInput = $derived(product ? (product.price / 100).toFixed(2).replace('.', ',') : '');
	let category_id = $derived(product?.category_id ?? categories[0]?.id ?? '');
	let available = $derived(product?.available ?? true);
	let isSubmitting = $state(false);

	let priceCents = $derived.by(() => {
		const val = parseFloat(priceInput.replace(',', '.'));
		return isNaN(val) ? 0 : Math.round(val * 100);
	});

	let canSave = $derived(
		!isSubmitting && name.trim().length > 0 && !isNaN(priceCents) && category_id.length > 0
	);

	function handleSubmit() {
		if (!canSave) {
			return;
		}
		isSubmitting = true;
		onSave({ name: name.trim(), price: priceCents, category_id, available });
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="z-index: 100; background: rgba(0,0,0,0.5);" onclick={onCancel} onkeydown={(e) => e.key === 'Escape' && onCancel()}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-box bg-body rounded-4 p-4 overflow-auto" style="width: 90%; max-width: 420px; max-height: 90vh;" onclick={(e) => e.stopPropagation()}>
		<h2 class="h5 mb-3">{product ? $t('productForm.editTitle') : $t('productForm.newTitle')}</h2>

		<div class="mb-3">
			<label class="form-label fw-semibold" for="product-name">{$t('productForm.name')}</label>
			<input
				id="product-name"
				class="form-control"
				type="text"
				bind:value={name}
				placeholder={$t('productForm.namePlaceholder')}
			/>
		</div>

		<div class="mb-3">
			<label class="form-label fw-semibold" for="product-price">{$t('productForm.priceLabel')}</label>
			<input
				id="product-price"
				class="form-control"
				type="text"
				inputmode="decimal"
				bind:value={priceInput}
				placeholder="0,00"
			/>
		</div>

		<fieldset class="mb-3 border-0 p-0">
			<legend class="fw-semibold" style="font-size: 0.95rem">{$t('productForm.category')}</legend>
			<div class="d-flex flex-wrap gap-2">
				{#each categories as cat (cat.id)}
					<input type="radio" class="btn-check" name="category" id="cat-{cat.id}" value={cat.id} bind:group={category_id} />
					<label class="btn btn-outline-secondary" for="cat-{cat.id}">{cat.label}</label>
				{/each}
			</div>
		</fieldset>

		{#if product}
			<div class="mb-3">
				<label class="form-check d-flex align-items-center gap-2">
					<input class="form-check-input" style="width:18px;height:18px" type="checkbox" bind:checked={available} />
					{$t('productForm.available')}
				</label>
			</div>
		{/if}

		<div class="d-flex gap-2 mt-3">
			<button class="btn btn-secondary flex-fill fw-semibold" onclick={onCancel} disabled={isSubmitting}
				>{$t('productForm.cancel')}</button
			>
			<button class="btn btn-primary flex-fill fw-semibold" onclick={handleSubmit} disabled={!canSave}>
				{isSubmitting ? $t('productForm.saving') : $t('productForm.save')}
			</button>
		</div>
	</div>
</div>
