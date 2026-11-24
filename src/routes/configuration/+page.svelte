<script lang="ts">
	import { onMount } from 'svelte';
	import { api_call, APP_TARGET } from '#lib/api.ts';
	import { confirm } from '#lib/confirm.svelte.ts';
	import DatabaseSavesModal from '#lib/components/DatabaseSavesModal.svelte';
	import type { AppVersion, Category } from '#lib/types.ts';
	import { t, locale, availableLocales } from '#lib/i18n/index.ts';
	import {
		groupedCategories,
		toggleCategoryGrouped,
		groupAllCategories,
		ungroupAllCategories
	} from '#lib/stores/category-visibility.ts';
	import {
		shopName,
		orderWeightEnabled,
		customProductEnabled,
		theme,
		setConfigValue
	} from '#lib/stores/app-config.ts';

	let dbPath = $state<string | null>(null);
	let appVersion = $state<AppVersion | null>(null);
	let isResetting = $state(false);
	let isResettingSales = $state(false);
	let isLoadingDefaults = $state(false);
	let isSavesOpen = $state(false);
	let categories = $state<Category[]>([]);
	let shopNameInput = $state('');
	let selectedDataset = $state<'snackbar' | 'clothing'>('snackbar');

	let allGrouped = $derived(
		categories.length > 0 && categories.every((c) => $groupedCategories.has(c.id))
	);
	let someGrouped = $derived(categories.some((c) => $groupedCategories.has(c.id)));
	// Mobile systems keep the files of the app private: no file manager can open its directory.
	let canOpenDatabaseDirectory = $derived(
		APP_TARGET !== 'static' && appVersion !== null && !['android', 'ios'].includes(appVersion.os)
	);
	let error = $state<string | null>(null);

	onMount(async () => {
		shopNameInput = $shopName;
		try {
			[dbPath, appVersion, categories] = await Promise.all([
				api_call<string>('get_db_path'),
				api_call<AppVersion>('get_app_version'),
				api_call<Category[]>('list_categories')
			]);
		} catch (e) {
			error = $t('configuration.loadError', { error: String(e) });
		}
	});

	async function saveShopName() {
		await setConfigValue('shop_name', shopNameInput.trim());
	}

	async function toggleWeightEnabled() {
		await setConfigValue('order_weight_enabled', $orderWeightEnabled ? '0' : '1');
	}

	async function toggleCustomProductEnabled() {
		await setConfigValue('custom_product_enabled', $customProductEnabled ? '0' : '1');
	}

	async function changeLanguage(value: string) {
		locale.set(value);
		await setConfigValue('shop_language', value);
	}

	async function changeTheme(value: 'light' | 'dark') {
		document.body.setAttribute('data-bs-theme', value);
		await setConfigValue('theme', value);
	}

	async function openDatabaseDirectory() {
		try {
			await api_call('open_database_directory');
		} catch (e) {
			alert($t('saves.openDirectoryError', { error: String(e) }));
		}
	}

	async function loadDefaults() {
		const confirmed = await confirm($t('configuration.replaceDefaultsConfirm'));
		if (!confirmed) {
			return;
		}
		isLoadingDefaults = true;
		try {
			await api_call('load_default_dataset', { dataset: selectedDataset });
			window.location.reload();
		} catch (e) {
			alert($t('configuration.replaceDefaultsFailed', { error: String(e) }));
			isLoadingDefaults = false;
		}
	}

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

	{#if error}
		<div class="d-flex align-items-center justify-content-center text-danger fs-5 flex-grow-1">
			{error}
		</div>
	{/if}

	<section class="mb-4 pb-3 border-bottom">
		<h2 class="h6 fw-semibold mb-2">{$t('configuration.shopName')}</h2>
		<div class="d-flex gap-2 flex-wrap" style="max-width: 420px;">
			<input
				class="form-control"
				type="text"
				bind:value={shopNameInput}
				placeholder={$t('configuration.shopNamePlaceholder')}
			/>
			<button class="btn btn-outline-primary btn-sm fw-semibold" onclick={saveShopName}>
				{$t('configuration.save')}
			</button>
		</div>
	</section>

	<section class="mb-4 pb-3 border-bottom">
		<h2 class="h6 fw-semibold mb-2">{$t('configuration.language')}</h2>
		<select
			class="form-select"
			style="max-width: 200px;"
			value={$locale}
			onchange={(e) => changeLanguage((e.target as HTMLSelectElement).value)}
		>
			{#each availableLocales as loc (loc)}
				<option value={loc}>{$t('languages.' + loc)}</option>
			{/each}
		</select>
	</section>

	<section class="mb-4 pb-3 border-bottom">
		<h2 class="h6 fw-semibold mb-2">{$t('configuration.theme')}</h2>
		<select
			class="form-select"
			style="max-width: 200px;"
			value={$theme}
			onchange={(e) => changeTheme((e.target as HTMLSelectElement).value as 'light' | 'dark')}
		>
			<option value="light">{$t('configuration.themeLight')}</option>
			<option value="dark">{$t('configuration.themeDark')}</option>
		</select>
	</section>

	<section class="mb-4 pb-3 border-bottom">
		<h2 class="h6 fw-semibold mb-2">{$t('configuration.orderOptions')}</h2>
		<label class="d-flex align-items-center gap-2 mb-2" style="cursor: pointer; font-size: 0.95rem">
			<input
				class="form-check-input"
				type="checkbox"
				checked={$orderWeightEnabled}
				onchange={toggleWeightEnabled}
			/>
			<span>{$t('configuration.enableOrderWeight')}</span>
		</label>
		<label class="d-flex align-items-center gap-2" style="cursor: pointer; font-size: 0.95rem">
			<input
				class="form-check-input"
				type="checkbox"
				checked={$customProductEnabled}
				onchange={toggleCustomProductEnabled}
			/>
			<span>{$t('configuration.enableCustomProduct')}</span>
		</label>
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
				<p class="m-0 small text-body-secondary">
					<span class="fw-semibold">{$t('dashboard.dbPath')} :</span>
					<code class="bg-body-secondary px-1 rounded-1 small">{dbPath}</code>
					<button
						class="btn btn-outline-primary btn-sm py-0 ms-1 fw-semibold"
						onclick={() => (isSavesOpen = true)}
					>
						{$t('saves.open')}
					</button>
					{#if canOpenDatabaseDirectory}
						<button
							class="btn btn-outline-primary btn-sm py-0 ms-1 fw-semibold"
							onclick={openDatabaseDirectory}
						>
							{$t('saves.openDirectory')}
						</button>
					{/if}
				</p>
			{/if}
		</section>
	{/if}

	<section class="visibility-section mb-4 pb-3 border-bottom">
		<h2 class="h6 fw-semibold mb-2">{$t('configuration.categoryGrouping')}</h2>
		<p class="small text-muted mb-2">{$t('configuration.categoryGroupingHint')}</p>

		{#if categories.length === 0}
			<p class="small text-muted mb-2">{$t('configuration.noCategoriesYet')}</p>
		{:else}
			<label
				class="d-flex align-items-center gap-2 py-1 fw-semibold border-bottom pb-2 mb-1"
				style="cursor: pointer; font-size: 0.9rem"
			>
				<input
					class="form-check-input"
					type="checkbox"
					checked={allGrouped}
					indeterminate={someGrouped && !allGrouped}
					onchange={() => {
						if (allGrouped) {
							ungroupAllCategories();
						} else {
							groupAllCategories(categories.map((c) => c.id));
						}
					}}
				/>
				<span>{allGrouped ? $t('configuration.ungroupAll') : $t('configuration.groupAll')}</span>
			</label>

			{#each categories as cat (cat.id)}
				<label
					class="d-flex align-items-center gap-2 py-1"
					style="cursor: pointer; font-size: 0.9rem"
				>
					<input
						class="form-check-input"
						type="checkbox"
						checked={$groupedCategories.has(cat.id)}
						onchange={() => toggleCategoryGrouped(cat.id)}
					/>
					<span
						class="d-inline-block flex-shrink-0 rounded-1"
						style="width: 14px; height: 14px; background: {cat.color};"
					></span>
					<span>{cat.label}</span>
				</label>
			{/each}
		{/if}
	</section>

	<section class="mb-4 pb-3 border-bottom">
		<h2 class="h6 fw-semibold mb-2">{$t('configuration.replaceDefaultsTitle')}</h2>
		<p class="small text-muted mb-2">{$t('configuration.replaceDefaultsHint')}</p>
		<div class="d-flex flex-wrap gap-2 align-items-center mb-2">
			<select class="form-select" style="max-width: 240px;" bind:value={selectedDataset}>
				<option value="snackbar">{$t('configuration.datasetSnackbar')}</option>
				<option value="clothing">{$t('configuration.datasetClothing')}</option>
			</select>
			<button
				class="btn btn-outline-primary btn-sm fw-semibold"
				onclick={loadDefaults}
				disabled={isLoadingDefaults}
			>
				{isLoadingDefaults
					? $t('configuration.replacingDefaults')
					: $t('configuration.replaceDefaults')}
			</button>
		</div>
	</section>

	<section class="mb-4">
		<div>
			<button
				class="btn btn-outline-danger btn-sm fw-semibold flex-shrink-0"
				onclick={resetSales}
				disabled={isResettingSales}
			>
				{isResettingSales ? $t('dashboard.resetting') : $t('dashboard.resetSales')}
			</button>
			<p class="m-0 small text-muted">{$t('dashboard.resetSalesWarning')}</p>
		</div>
	</section>

	<section class="mb-4">
		<div>
			<button
				class="btn btn-outline-danger btn-sm fw-semibold flex-shrink-0"
				onclick={resetDatabase}
				disabled={isResetting}
			>
				{isResetting ? $t('dashboard.resetting') : $t('dashboard.resetAll')}
			</button>
			<p class="m-0 small text-muted">{$t('dashboard.resetAllWarning')}</p>
		</div>
	</section>
</div>

{#if isSavesOpen}
	<DatabaseSavesModal
		onClose={() => (isSavesOpen = false)}
		onRestored={() => window.location.reload()}
	/>
{/if}
