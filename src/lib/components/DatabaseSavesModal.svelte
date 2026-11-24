<script lang="ts">
	import { onMount } from 'svelte';
	import { api_call } from '#lib/api.ts';
	import { t } from '#lib/i18n/index.ts';
	import { isBackdropClick } from '#lib/utils/modal.ts';
	import { urlize } from '#lib/utils/urlize.ts';

	interface Props {
		onClose: () => void;
		onRestored: () => void;
	}

	let { onClose, onRestored }: Props = $props();

	let saves = $state<string[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let customName = $state('');
	let isSaving = $state(false);
	let restoreTarget = $state<string | null>(null);
	let isRestoring = $state(false);

	let label = $derived(urlize(customName));
	let fileNamePreview = $derived(
		`pos_sum_${$t('saves.datePattern')}${label ? `_${label}` : ''}.db`
	);
	let isBusy = $derived(isSaving || isRestoring);

	onMount(loadSaves);

	async function loadSaves() {
		try {
			saves = await api_call<string[]>('list_database_saves');
		} catch (e) {
			error = $t('saves.loadError', { error: String(e) });
		} finally {
			isLoading = false;
		}
	}

	async function saveCurrentDatabase() {
		isSaving = true;
		error = null;
		try {
			await api_call<string>('create_database_save', { label });
			customName = '';
			await loadSaves();
		} catch (e) {
			error = $t('saves.saveError', { error: String(e) });
		} finally {
			isSaving = false;
		}
	}

	async function restore(backupFirst: boolean) {
		isRestoring = true;
		error = null;
		try {
			if (backupFirst) {
				await api_call<string>('create_database_save', {
					label: urlize($t('saves.backupLabel'))
				});
			}
			await api_call('restore_database_save', { fileName: restoreTarget });
			onRestored();
		} catch (e) {
			error = $t('saves.restoreError', { error: String(e) });
			restoreTarget = null;
			isRestoring = false;
			await loadSaves();
		}
	}

	function cancelRestore() {
		if (!isRestoring) {
			restoreTarget = null;
		}
	}

	function close() {
		if (!isBusy) {
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') {
			return;
		}
		if (restoreTarget) {
			cancelRestore();
		} else {
			close();
		}
	}

	function handleOverlayClick(event: MouseEvent) {
		if (isBackdropClick(event)) {
			close();
		}
	}

	function handleRestoreOverlayClick(event: MouseEvent) {
		if (isBackdropClick(event)) {
			cancelRestore();
		}
	}
</script>

<div
	class="modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
	style="z-index: 100; background: rgba(0,0,0,0.5);"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	onclick={handleOverlayClick}
	onkeydown={handleKeydown}
>
	<div
		class="modal-box bg-body rounded-4 p-4 overflow-auto"
		style="width: 90%; max-width: 640px; max-height: 90vh;"
	>
		<h2 class="h5 mb-3">{$t('saves.title')}</h2>

		{#if error}
			<p class="small text-danger">{error}</p>
		{/if}

		{#if isLoading}
			<p class="small text-muted">{$t('saves.loading')}</p>
		{:else if saves.length === 0}
			<p class="small text-muted">{$t('saves.empty')}</p>
		{:else}
			<ul class="list-group mb-3">
				{#each saves as save (save)}
					<li
						class="list-group-item d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2"
					>
						<span class="font-monospace small text-break">{save}</span>
						<button
							class="btn btn-outline-primary btn-sm fw-semibold flex-shrink-0"
							onclick={() => (restoreTarget = save)}
							disabled={isBusy}
						>
							{$t('saves.restore')}
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<label class="form-label fw-semibold" for="save-custom-name">{$t('saves.customName')}</label>
		<input
			id="save-custom-name"
			class="form-control"
			type="text"
			maxlength="50"
			bind:value={customName}
			placeholder={$t('saves.customNamePlaceholder')}
			disabled={isBusy}
		/>
		<div class="form-text">
			{$t('saves.fileName')}
			<span class="font-monospace text-break">{fileNamePreview}</span>
		</div>

		<div class="d-flex gap-2 mt-3">
			<button class="btn btn-secondary flex-fill fw-semibold" onclick={close} disabled={isBusy}>
				{$t('saves.close')}
			</button>
			<button
				class="btn btn-primary flex-fill fw-semibold"
				onclick={saveCurrentDatabase}
				disabled={isBusy}
			>
				{isSaving ? $t('saves.saving') : $t('saves.save')}
			</button>
		</div>
	</div>
</div>

{#if restoreTarget}
	<div
		class="modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
		style="z-index: 110; background: rgba(0,0,0,0.5);"
		role="alertdialog"
		aria-modal="true"
		tabindex="-1"
		onclick={handleRestoreOverlayClick}
		onkeydown={handleKeydown}
	>
		<div
			class="modal-box bg-body rounded-4 p-4 overflow-auto"
			style="width: 90%; max-width: 420px; max-height: 90vh;"
		>
			<h2 class="h5 mb-3">{$t('saves.restoreTitle')}</h2>
			<p class="mb-4">{$t('saves.restoreConfirm', { fileName: restoreTarget })}</p>
			{#if isRestoring}
				<p class="m-0 text-muted">{$t('saves.restoring')}</p>
			{:else}
				<div class="d-flex flex-column gap-2">
					<button class="btn btn-primary fw-semibold" onclick={() => restore(true)}>
						{$t('saves.backupAndRestore')}
					</button>
					<button class="btn btn-outline-danger fw-semibold" onclick={() => restore(false)}>
						{$t('saves.restoreWithoutBackup')}
					</button>
					<button class="btn btn-secondary fw-semibold" onclick={cancelRestore}>
						{$t('saves.cancel')}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
