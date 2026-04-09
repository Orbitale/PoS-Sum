<script lang="ts">
	interface Props {
		onKeyPress: (key: string) => void;
	}

	let { onKeyPress }: Props = $props();

	const remap: {[key: string]: string} = {
		'⌫': 'backspace',
		'−': '-',
	};

	const keys = [
		'1', '2', '3',
		'4', '5', '6',
		'7', '8', '9',
		',', '0', '⌫',
		',50', ',00', '−',
	];
</script>

<div class="grid">
	{#each keys as key}
		<button
			class="btn col-4 {key === '⌫' ? 'btn-outline-danger' : 'btn-outline-primary'} fw-semibold fs-4"
			type="button"
			onclick={() => onKeyPress(remap[key] ?? key)}
		>
			{key}
		</button>
	{/each}
</div>
