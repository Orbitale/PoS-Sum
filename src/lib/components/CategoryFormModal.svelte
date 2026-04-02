<script lang="ts">
	import type { Category } from '$lib/types';
	import { t } from '$lib/i18n';

	interface Props {
		category: Category | null;
		onSave: (data: { id: string; label: string; color: string }) => void;
		onCancel: () => void;
	}

	let { category, onSave, onCancel }: Props = $props();

	let id = $derived(category?.id ?? '');
	let label = $derived(category?.label ?? '');
	let color = $derived(category?.color ?? '#6b7280');
	let isSubmitting = $state(false);

	let isEditing = $derived(category !== null);

	function sanitizeId(value: string): string {
		return value
			.toLowerCase()
			.replace(/[^a-z0-9._-]/g, '')
			.replace(/[._-]{2,}/g, (m) => m[0]);
	}

	function handleIdInput(e: Event) {
		const input = e.target as HTMLInputElement;
		id = sanitizeId(input.value);
		input.value = id;
	}

	let canSave = $derived(
		!isSubmitting && id.trim().length > 0 && label.trim().length > 0 && color.length > 0
	);

	function handleSubmit() {
		if (!canSave) {
			return;
		}
		isSubmitting = true;
		onSave({ id: id.trim(), label: label.trim(), color });
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="z-index: 100; background: rgba(0,0,0,0.5);" onclick={onCancel} onkeydown={(e) => e.key === 'Escape' && onCancel()}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-box bg-body rounded-4 p-4 overflow-auto" style="width: 90%; max-width: 420px; max-height: 90vh;" onclick={(e) => e.stopPropagation()}>
		<h2 class="h5 mb-3">{isEditing ? $t('categoryForm.editTitle') : $t('categoryForm.newTitle')}</h2>

		<div class="mb-3">
			<label class="form-label fw-semibold" for="category-id">{$t('categoryForm.idLabel')}</label>
			<input
				id="category-id"
				class="form-control"
				type="text"
				value={id}
				oninput={handleIdInput}
				placeholder={$t('categoryForm.idPlaceholder')}
				disabled={isEditing}
			/>
			{#if isEditing}
				<span class="form-text text-muted small">{$t('categoryForm.idHint')}</span>
			{/if}
		</div>

		<div class="mb-3">
			<label class="form-label fw-semibold" for="category-label">{$t('categoryForm.label')}</label>
			<input
				id="category-label"
				class="form-control"
				type="text"
				bind:value={label}
				placeholder={$t('categoryForm.labelPlaceholder')}
			/>
		</div>

		<div class="mb-3">
			<label class="form-label fw-semibold" for="category-color">{$t('categoryForm.color')}</label>
			<div class="d-flex align-items-center gap-3">
				<input id="category-color" class="border rounded-2" type="color" bind:value={color} style="width: 48px; height: 40px; padding: 2px; cursor: pointer;" />
				<span class="d-inline-block px-2 py-1 rounded-2 small fw-semibold font-monospace" style="background: {color}; color: #fff;">{color}</span>
			</div>
		</div>

		<div class="d-flex gap-2 mt-3">
			<button class="btn btn-secondary flex-fill fw-semibold" onclick={onCancel} disabled={isSubmitting}
				>{$t('categoryForm.cancel')}</button
			>
			<button class="btn btn-primary flex-fill fw-semibold" onclick={handleSubmit} disabled={!canSave}>
				{isSubmitting ? $t('categoryForm.saving') : $t('categoryForm.save')}
			</button>
		</div>
	</div>
</div>
