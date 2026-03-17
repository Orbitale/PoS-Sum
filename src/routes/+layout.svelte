<script lang="ts">
	import 'bootstrap/dist/css/bootstrap.min.css';
	import 'bootstrap/dist/js/bootstrap.bundle.min.js';

	import NavMenu from '$lib/components/NavMenu.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<NavMenu />
<div class="vh-100" style="padding-top: 48px">
	{@render children()}
</div>
<ConfirmModal />
