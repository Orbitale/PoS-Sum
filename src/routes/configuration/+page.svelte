<script lang="ts">
	import { onMount } from 'svelte';
	import { api_call } from '$lib/api';
	import { confirm } from '$lib/confirm.svelte';
	import type { AppVersion, Category } from '$lib/types';
	import { t, locale, availableLocales } from '$lib/i18n';
	import {
		groupedCategories,
		toggleCategoryGrouped,
		groupAllCategories,
		ungroupAllCategories
	} from '$lib/stores/category-visibility';

	let dbPath = $state<string | null>(null);
	let appVersion = $state<AppVersion | null>(null);
	let isResetting = $state(false);
	let isResettingSales = $state(false);
	let categories = $state<Category[]>([]);

	let allGrouped = $derived(categories.length > 0 && categories.every(c => $groupedCategories.has(c.id)));
	let someGrouped = $derived(categories.some(c => $groupedCategories.has(c.id)));

	onMount(async () => {
		[dbPath, appVersion, categories] = await Promise.all([
			api_call<string>('get_db_path'),
			api_call<AppVersion>('get_app_version'),
			api_call<Category[]>('list_categories')
		]);
	});

	async function resetSales() {
		const confirmed = await confirm($t('dashboard.resetSalesConfirm'));
		if (!confirmed) {
			return;
		}
		isResettingSales = true;
		try {
			await api_call('reset_sales');
			window.location.reload();
		} catch (e) {
			alert($t('dashboard.resetSalesFailed', { error: String(e) }));
			isResettingSales = false;
		}
	}

	async function resetDatabase() {
		const confirmed = await confirm($t('dashboard.resetConfirm'));
		if (!confirmed) {
			return;
		}
		isResetting = true;
		try {
			await api_call('reset_database');
			window.location.reload();
		} catch (e) {
			alert($t('dashboard.resetFailed', { error: String(e) }));
			isResetting = false;
		}
	}
</script>

<div class="mx-auto px-4 pb-4">
	<div class="pt-4 pb-3">
		<h1 class="h4 m-0 fw-semibold">{$t('configuration.title')}</h1>
	</div>

	<section class="mb-4 pb-3 border-bottom">
		<h2 class="h6 fw-semibold mb-2">{$t('configuration.language')}</h2>
		<select
			class="form-select"
			style="max-width: 200px;"
			value={$locale}
			onchange={(e) => locale.set((e.target as HTMLSelectElement).value)}
		>
			{#each availableLocales as loc (loc)}
				<option value={loc}>{$t('languages.' + loc)}</option>
			{/each}
		</select>
	</section>

	{#if dbPath || appVersion}
		<section class="mb-4">
			<h2 class="h6 fw-semibold mb-2">{$t('dashboard.appInfo')}</h2>
			{#if appVersion}
				<p class="m-0 small text-body-secondary">
					<span class="fw-semibold">{$t('dashboard.version')} :</span>
					<code class="bg-body-secondary px-1 rounded-1 small">{appVersion.version}</code>
					({appVersion.os}/{appVersion.arch})
				</p>
			{/if}
			{#if dbPath}
				<p class="m-0 small text-body-secondary"><span class="fw-semibold">{$t('dashboard.dbPath')} :</span> <code class="bg-body-secondary px-1 rounded-1 small">{dbPath}</code></p>
			{/if}
		</section>
	{/if}

	<section class="visibility-section mb-4 pb-3 border-bottom">
		<h2 class="h6 fw-semibold mb-2">{$t('configuration.categoryGrouping')}</h2>
		<p class="small text-muted mb-2">{$t('configuration.categoryGroupingHint')}</p>

		{#if categories.length === 0}
			<p class="small text-muted mb-2">{$t('configuration.noCategoriesYet')}</p>
		{:else}
			<label class="d-flex align-items-center gap-2 py-1 fw-semibold border-bottom pb-2 mb-1" style="cursor: pointer; font-size: 0.9rem">
				<input
					class="form-check-input"
					type="checkbox"
					checked={allGrouped}
					indeterminate={someGrouped && !allGrouped}
					onchange={() => {
						if (allGrouped) {
							ungroupAllCategories();
						} else {
							groupAllCategories(categories.map(c => c.id));
						}
					}}
				/>
				<span>{allGrouped ? $t('configuration.ungroupAll') : $t('configuration.groupAll')}</span>
			</label>

			{#each categories as cat (cat.id)}
				<label class="d-flex align-items-center gap-2 py-1" style="cursor: pointer; font-size: 0.9rem">
					<input
						class="form-check-input"
						type="checkbox"
						checked={$groupedCategories.has(cat.id)}
						onchange={() => toggleCategoryGrouped(cat.id)}
					/>
					<span class="d-inline-block flex-shrink-0 rounded-1" style="width: 14px; height: 14px; background: {cat.color};"></span>
					<span>{cat.label}</span>
				</label>
			{/each}
		{/if}
	</section>

	<section class="mb-4">
		<div>
			<button class="btn btn-outline-danger btn-sm fw-semibold flex-shrink-0" onclick={resetSales} disabled={isResettingSales}>
				{isResettingSales ? $t('dashboard.resetting') : $t('dashboard.resetSales')}
			</button>
			<p class="m-0 small text-muted">{$t('dashboard.resetSalesWarning')}</p>
		</div>
	</section>

	<section class="mb-4">
		<div>
			<button class="btn btn-outline-danger btn-sm fw-semibold flex-shrink-0" onclick={resetDatabase} disabled={isResetting}>
				{isResetting ? $t('dashboard.resetting') : $t('dashboard.resetAll')}
			</button>
			<p class="m-0 small text-muted">{$t('dashboard.resetAllWarning')}</p>
		</div>
	</section>
</div>
