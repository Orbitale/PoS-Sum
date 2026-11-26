import type { ConfigurationEntry } from '#lib/types.ts';
import type { DefaultDataset } from '#lib/datasets/types.ts';
import clothing from '../../../datasets/clothing.json';
import snackbar from '../../../datasets/snackbar.json';

export const CONFIGURATION_DEFAULTS: readonly ConfigurationEntry[] = [
	{ id: 'shop_name', name: 'Shop name', value: '' },
	{ id: 'company_details', name: 'Company details / address', value: '' },
	{ id: 'order_weight_enabled', name: 'Activate weight field in Order page', value: '0' },
	{ id: 'custom_product_enabled', name: 'Allow adding custom product on-the-fly', value: '0' },
	{ id: 'shop_language', name: 'Shop language', value: 'fr' },
	{ id: 'theme', name: 'Dark/Light mode', value: 'light' },
	{ id: 'vat_enabled', name: 'Activate VAT support', value: '0' }
];

export const DATASETS = {
	snackbar,
	clothing
} as const satisfies Record<string, DefaultDataset>;

export type DatasetId = keyof typeof DATASETS;

export const DATASET_IDS = Object.keys(DATASETS) as DatasetId[];

export function configurationOverrideKeys(): Set<string> {
	return new Set(CONFIGURATION_DEFAULTS.map((entry) => entry.id));
}