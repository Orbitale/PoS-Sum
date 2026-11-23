<script lang="ts">
	import { confirmState, _respond } from '#lib/confirm.svelte.ts';
	import { isBackdropClick } from '#lib/utils/modal.ts';
	import { t } from '#lib/i18n/index.ts';

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			_respond(false);
		}
	}

	function handleOverlayClick(event: MouseEvent) {
		if (isBackdropClick(event)) {
			_respond(false);
		}
	}
</script>

<svelte:window onkeydown={confirmState.isOpen ? handleKeydown : undefined} />

{#if confirmState.isOpen}
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
			style="width: 90%; max-width: 420px; max-height: 90vh;"
		>
			<h2 class="h5 mb-3">{$t('confirm.title')}</h2>
			<p class="mb-4">{confirmState.message}</p>
			<div class="d-flex gap-2">
				<button
					type="button"
					class="btn btn-secondary flex-fill fw-semibold"
					onclick={() => _respond(false)}
				>
					{$t('confirm.cancel')}
				</button>
				<button
					type="button"
					class="btn btn-danger flex-fill fw-semibold"
					onclick={() => _respond(true)}
				>
					{$t('confirm.ok')}
				</button>
			</div>
		</div>
	</div>
{/if}
