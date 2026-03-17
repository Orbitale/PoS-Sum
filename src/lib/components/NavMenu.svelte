<script lang="ts">
	import { page } from '$app/state';
	import { t } from '$lib/i18n';
	import { Offcanvas } from 'bootstrap';

	const links = [
		{ href: '/', labelKey: 'nav.sales' },
		{ href: '/products', labelKey: 'nav.products' },
		{ href: '/categories', labelKey: 'nav.categories' },
		{ href: '/orders', labelKey: 'nav.orders' },
		{ href: '/dashboard', labelKey: 'nav.dashboard' },
		{ href: '/configuration', labelKey: 'nav.configuration' }
	];

	function isActive(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}

	function closeMenu() {
		const el = document.getElementById('navOffcanvas');
		if (el) {
			Offcanvas.getInstance(el)?.hide();
		}
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
			class="offcanvas-md offcanvas-start"
			tabindex="-1"
			id="navOffcanvas"
			aria-labelledby="navOffcanvasLabel"
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
	</div>
</nav>
