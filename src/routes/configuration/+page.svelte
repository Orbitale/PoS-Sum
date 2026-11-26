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
		companyAddress,
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
	let companyAddressInput = $state('');
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
		companyAddressInput = $companyAddress;
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

	async function saveShopDetails() {
		await Promise.all([
			setConfigValue('shop_name', shopNameInput.trim()),
			setConfigValue('company_details', companyAddressInput.trim())
		]);
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
		<h1 class="m-0 fw-semibold">{$t('configuration.title')}</h1>
	</div>

	{#if error}
		<div class="d-flex align-items-center justify-content-center text-danger fs-5 flex-grow-1">
			{error}
		</div>
	{/if}

	<div class="card">
		<div class="card-header">
			{$t('configuration.companyInformation')}
		</div>
		<div class="card-body">
			<div class="row">
				<div class="col-sm-6">
					<label for="shopNameInput" class="form-label">
						{$t('configuration.shopName')}
					</label>
					<input
						class="form-control mb-3"
						id="shopNameInput"
						type="text"
						bind:value={shopNameInput}
					/>

					<label for="companyAddressInput" class="form-label">
						{$t('configuration.companyAddress')}
					</label>
					<textarea
						id="companyAddressInput"
						class="form-control mb-3"
						rows="4"
						bind:value={companyAddressInput}></textarea>

					<div class="form-check">
						<input
							class="form-check-input"
							type="checkbox"
							id="toggleWeightEnabled"
							checked={$orderWeightEnabled}
							onchange={toggleWeightEnabled}
						/>
						<label for="toggleWeightEnabled" class="form-check-label">
							{$t('configuration.enableOrderWeight')}
						</label>
					</div>

					<div class="form-check">
						<input
							class="form-check-input"
							type="checkbox"
							id="customProductEnabled"
							checked={$customProductEnabled}
							onchange={toggleCustomProductEnabled}
						/><label for="customProductEnabled" class="form-check-label">
							{$t('configuration.enableCustomProduct')}
						</label>
					</div>

					<button class="btn btn-outline-primary btn-sm fw-semibold mt-2" onclick={saveShopDetails}>
						{$t('configuration.save')}
					</button>
				</div>
				<div class="col-sm-6">
					<h2 class="h6 fw-semibold mb-2">{$t('configuration.categoryGrouping')}</h2>
					<p class="small text-muted mb-2">{$t('configuration.categoryGroupingHint')}</p>

					{#if categories.length === 0}
						<p class="small text-muted fst-italic mb-2">{$t('configuration.noCategoriesYet')}</p>
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
							<span>
								{allGrouped ? $t('configuration.ungroupAll') : $t('configuration.groupAll')}
							</span>
						</label>

						{#each categories as cat (cat.id)}
							<label
								class="d-flex align-items-center gap-2 py-1"
								style="cursor: pointer; font-size: 0.9rem"
								for="regroupCategory{cat.id}"
							>
								<input
									class="form-check-input"
									type="checkbox"
									id="regroupCategory{cat.id}"
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
				</div>
			</div>
		</div>
	</div>

	<section class="card mt-3">
		<div class="card-header">
			{$t('configuration.application')}
		</div>
		<div class="card-body">
			<div class="row">
				<div class="col-sm-6">
					<label for="configurationLanguage" class="form-label">
						{$t('configuration.language')}
					</label>
					<select
						class="form-select"
						id="configurationLanguage"
						value={$locale}
						onchange={(e) => changeLanguage((e.target as HTMLSelectElement).value)}
					>
						{#each availableLocales as loc (loc)}
							<option value={loc}>{$t('languages.' + loc)}</option>
						{/each}
					</select>

					<label for="configurationTheme" class="form-label mt-2">
						{$t('configuration.theme')}
					</label>
					<div class="row">
						<div class="col-sm-6">
							<div class="form-check">
								<input
									class="form-check-input"
									type="radio"
									name="configurationTheme"
									id="configurationThemeLight"
									checked={$theme === 'light'}
									onchange={(e) => changeTheme('light')}
								/>
								<label class="form-check-label" for="configurationThemeLight">
									{$t('configuration.themeLight')}
								</label>
							</div>
						</div>
						<div class="col-sm-6">
							<div class="form-check">
								<input
									class="form-check-input"
									type="radio"
									name="configurationTheme"
									id="configurationThemeDark"
									checked={$theme === 'dark'}
									onchange={(e) => changeTheme('dark')}
								/>
								<label class="form-check-label" for="configurationThemeDark">
									{$t('configuration.themeDark')}
								</label>
							</div>
						</div>
					</div>
				</div>
				<div class="col-sm-6">
					{#if dbPath || appVersion}
						<h2 class="h6 fw-semibold">{$t('dashboard.appInfo')}</h2>
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
					{/if}
				</div>
			</div>
		</div>
	</section>

	<div class="card mt-3 border-danger">
		<div class="card-header">
			🚨 {$t('configuration.redZone')}
		</div>
		<div class="card-body">
			<section class="mb-4">
				<label for="selectDataset" class="h6 fw-semibold mb-2">
					{$t('configuration.replaceDefaultsTitle')}
				</label>
				<p class="small text-muted mb-2">
					{@html $t('configuration.replaceDefaultsHint')}
				</p>
				<div class="d-flex flex-wrap gap-2 align-items-center mb-2">
					<select id="selectDataset" class="form-select" bind:value={selectedDataset}>
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

			<section class="mb-3">
				<button
					class="btn btn-outline-danger btn-sm fw-semibold flex-shrink-0"
					onclick={resetSales}
					disabled={isResettingSales}
				>
					{isResettingSales ? $t('dashboard.resetting') : $t('dashboard.resetSales')}
				</button>
				<p class="m-0 small text-muted">{$t('dashboard.resetSalesWarning')}</p>
			</section>

			<section>
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
	</div>
</div>

{#if isSavesOpen}
	<DatabaseSavesModal
		onClose={() => (isSavesOpen = false)}
		onRestored={() => window.location.reload()}
	/>
{/if}
