<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.ts';
	import { shopName, theme, setConfigValue } from '#lib/stores/app-config.ts';

	const links: Array<{ href: string; labelKey: string }> = [
		{ href: '/', labelKey: 'nav.sales' },
		{ href: '/dashboard', labelKey: 'nav.dashboard' },
		{ href: '/products', labelKey: 'nav.products' },
		{ href: '/categories', labelKey: 'nav.categories' },
		{ href: '/orders', labelKey: 'nav.orders' },
		{ href: '/configuration', labelKey: 'nav.configuration' }
	];

	let offcanvas: HTMLElement;

	let isDarkMode = $derived($theme === 'dark');

	async function changeMode(newMode: boolean) {
		const value = newMode ? 'dark' : 'light';
		document.body.setAttribute('data-bs-theme', value);
		try {
			await setConfigValue('theme', value);
		} catch (e) {
			console.error('Failed to save theme', e);
		}
	}

	function isActive(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}

	function closeMenu() {
		window?.bootstrap?.Offcanvas?.getInstance(offcanvas)?.hide();
	}
</script>

<nav class="navbar navbar-expand-md fixed-top bg-body border-bottom py-1">
	<div class="container-fluid">
		<button
			class="navbar-toggler border-0"
			type="button"
			data-bs-toggle="offcanvas"
			data-bs-target="#navOffcanvas"
			aria-controls="navOffcanvas"
			aria-label="Toggle navigation"
		>
			<span class="navbar-toggler-icon"></span>
		</button>

		{#if $shopName}
			<span class="navbar-brand mb-0 h1 fs-6 fw-semibold mx-2 text-truncate">
				{$shopName}
			</span>
		{/if}

		<div
			class="offcanvas offcanvas-start"
			tabindex="-1"
			id="navOffcanvas"
			aria-labelledby="navOffcanvasLabel"
			bind:this={offcanvas}
		>
			<div class="offcanvas-header">
				<h5 class="offcanvas-title" id="navOffcanvasLabel">
					{$shopName || 'Menu'}
				</h5>
				<button
					type="button"
					class="btn-close"
					data-bs-dismiss="offcanvas"
					data-bs-target="#navOffcanvas"
					aria-label="Close"
				></button>
			</div>
			<div class="offcanvas-body">
				<ul class="navbar-nav gap-1">
					{#each links as link (link)}
						<li class="nav-item">
							<a
								class="nav-link rounded {isActive(link.href) ? 'active fw-semibold' : ''}"
								href={link.href}
								aria-current={isActive(link.href) ? 'page' : undefined}
								onclick={closeMenu}
							>
								{$t(link.labelKey)}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<div class="ms-auto">
			<button
				class="btn btn-outline-secondary"
				type="button"
				onclick={() => changeMode(!isDarkMode)}
			>
				{isDarkMode ? '☀' : '🌙'}
			</button>
		</div>
	</div>
</nav>

<style>
	.navbar-toggler {
		background: #bbb;
	}
</style>
