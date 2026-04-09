<script lang="ts">
	import { page } from '$app/state';
	import { t } from '$lib/i18n';

	const links = [
		{ href: '/', labelKey: 'nav.sales' },
		{ href: '/products', labelKey: 'nav.products' },
		{ href: '/categories', labelKey: 'nav.categories' },
		{ href: '/orders', labelKey: 'nav.orders' },
		{ href: '/dashboard', labelKey: 'nav.dashboard' },
		{ href: '/configuration', labelKey: 'nav.configuration' }
	];

	let offcanvas: HTMLElement;

	let isDarkMode: boolean = $state(false);

	$effect(() => {
		changeMode(isDarkMode);
	});

	function changeMode(newMode: boolean) {
		isDarkMode = newMode;
		window?.document.body.setAttribute('data-bs-theme', isDarkMode ? 'dark' : 'light');
	}

	function isActive(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}

	function closeMenu() {
		console.info('Close offcanvas', offcanvas);
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

		<div
			class="offcanvas offcanvas-start"
			tabindex="-1"
			id="navOffcanvas"
			aria-labelledby="navOffcanvasLabel"
			bind:this={offcanvas}
		>
			<div class="offcanvas-header">
				<h5 class="offcanvas-title" id="navOffcanvasLabel">Menu</h5>
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
					{#each links as link (link.href)}
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

		<div>
			<button class="btn btn-outline-secondary" type="button" onclick="{() => changeMode(!isDarkMode)}">
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
