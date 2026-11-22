<script lang="ts">
	import 'bootstrap/dist/css/bootstrap.min.css';
	import bootstrapJs from 'bootstrap/dist/js/bootstrap.bundle.min.js?url';
	import { onMount } from 'svelte';

	import NavMenu from '#lib/components/NavMenu.svelte';
	import ConfirmModal from '#lib/components/ConfirmModal.svelte';
	import type { Snippet } from 'svelte';
	import { loadAppConfig, theme as themeStore } from '#lib/stores/app-config.ts';
	import { locale } from '#lib/i18n/index.ts';

	let { children }: { children: Snippet } = $props();
	let ready = $state(false);

	onMount(async () => {
		try {
			const config = await loadAppConfig();
			if (config.shop_language) {
				locale.set(config.shop_language);
			}
			const mode = config.theme === 'dark' ? 'dark' : 'light';
			document.body.setAttribute('data-bs-theme', mode);
		} catch (e) {
			console.error('Failed to load configuration', e);
		} finally {
			ready = true;
		}
	});

	$effect(() => {
		document.body.setAttribute('data-bs-theme', $themeStore);
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.png" />
	<script src={bootstrapJs}></script>
</svelte:head>

{#if ready}
	<NavMenu />
	<div class="vh-100" style="padding-top: 48px">
		{@render children()}
	</div>
	<ConfirmModal />
{/if}
