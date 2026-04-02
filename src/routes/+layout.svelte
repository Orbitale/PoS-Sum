<script lang="ts">
	import 'bootstrap/dist/css/bootstrap.min.css';
	import bootstrapJs from 'bootstrap/dist/js/bootstrap.bundle.min.js?url';

	import NavMenu from '$lib/components/NavMenu.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.png" />
	<script src="{bootstrapJs}"></script>
</svelte:head>

<NavMenu />
<div class="vh-100" style="padding-top: 48px">
	{@render children()}
</div>
<ConfirmModal />
