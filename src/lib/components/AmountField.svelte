<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		applyNumpadKey,
		sanitizeAmountInput,
		type AmountInputOptions
	} from '#lib/money/index.ts';
	import Numpad from './Numpad.svelte';

	interface Props {
		id?: string;
		label?: string;
		value: string;
		placeholder?: string;
		invalid?: boolean;
		allowNegative?: boolean;
		showNumpad?: boolean;
		hint?: string;
		/** Extra content rendered next to the label (e.g. original/minimum hints). */
		labelExtra?: Snippet;
		onValueChange: (value: string) => void;
	}

	let {
		id = undefined,
		label = undefined,
		value,
		placeholder = '0,00',
		invalid = false,
		allowNegative = true,
		showNumpad = true,
		hint = undefined,
		labelExtra = undefined,
		onValueChange
	}: Props = $props();

	let options = $derived<AmountInputOptions>({ allowNegative });

	function handleInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const next = sanitizeAmountInput(input.value, options);
		input.value = next;
		onValueChange(next);
	}

	function handleFocus(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		setTimeout(() => input.select(), 1);
	}

	function handleNumpadKey(key: string) {
		onValueChange(applyNumpadKey(value, key, options));
	}
</script>

<label class="d-flex flex-column gap-1 fw-semibold mb-3" style="font-size: 0.95rem" for={id}>
	{#if label || labelExtra}
		<span class="d-flex flex-wrap align-items-baseline gap-2">
			{#if label}
				<span>{label}</span>
			{/if}
			{#if labelExtra}
				{@render labelExtra()}
			{/if}
		</span>
	{/if}
	<input
		{id}
		class="form-control text-end fs-5"
		class:is-invalid={invalid}
		type="text"
		inputmode="decimal"
		{placeholder}
		{value}
		oninput={handleInput}
		onfocus={handleFocus}
	/>
	{#if hint}
		<span class="small text-danger fw-normal">{hint}</span>
	{/if}
</label>

{#if showNumpad}
	<div class="mb-3">
		<Numpad onKeyPress={handleNumpadKey} />
	</div>
{/if}
