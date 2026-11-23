<script lang="ts">
	import { t } from '#lib/i18n/index.ts';

	interface Props {
		productName: string;
		initialComment: string;
		onConfirm: (comment: string) => void;
		onCancel: () => void;
	}

	let { productName, initialComment, onConfirm, onCancel }: Props = $props();

	// Capture the value when the modal is opened (component is remounted each time).

	let comment = $state(initialComment);
</script>

<div
	class="modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
	style="z-index: 1300; background: rgba(0,0,0,0.5);"
	onclick={onCancel}
	onkeydown={(e) => e.key === 'Escape' && onCancel()}
>
	<div
		class="bg-body rounded-4 p-4"
		style="width: min(420px, 95vw);"
		onclick={(e) => e.stopPropagation()}
	>
		<h2 class="h5 mb-2">{$t('order.editCommentTitle')}</h2>
		<p class="text-muted small mb-3">{productName}</p>

		<label class="d-flex flex-column gap-1 fw-semibold mb-3" style="font-size: 0.95rem">
			{$t('order.editCommentLabel')}
			<textarea class="form-control" rows="4" bind:value={comment}></textarea>
		</label>

		<div class="d-flex gap-2">
			<button class="btn btn-secondary flex-fill fw-semibold" onclick={onCancel}>
				{$t('order.cancel')}
			</button>
			<button
				class="btn btn-primary flex-fill fw-semibold"
				onclick={() => onConfirm(comment.trim())}
			>
				{$t('order.confirmComment')}
			</button>
		</div>
	</div>
</div>
