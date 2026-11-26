import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	CONFIGURATION_DEFAULTS,
	DATASET_IDS,
	DATASETS,
	configurationOverrideKeys
} from './seed.ts';

function readRustSource(path: string): string {
	return readFileSync(new URL(`../../../src-tauri/src/${path}`, import.meta.url), 'utf8');
}

describe('seed data', () => {
	it('has the configuration defaults of the Rust backend', () => {
		const source = readRustSource('db.rs');
		const block = /CONFIG_DEFAULTS[^=]*=\s*&\[([\s\S]*?)\];/.exec(source)?.[1] ?? '';
		const strings = [...block.matchAll(/"([^"]*)"/g)].map(([, value]) => value);
		const defaults = [];
		for (let i = 0; i < strings.length; i += 3) {
			defaults.push({ id: strings[i], name: strings[i + 1], value: strings[i + 2] });
		}
		expect(CONFIGURATION_DEFAULTS).toEqual(defaults);
	});

	it('lists the same datasets as the Rust backend', () => {
		const names = [...readRustSource('datasets.rs').matchAll(/"([\w-]+)" => Ok/g)].map(
			([, name]) => name
		);
		expect(DATASET_IDS).toEqual(names);
	});

	it.each(DATASET_IDS)('loads the shared datasets/%s.json file', (id) => {
		const path = new URL(`../../../datasets/${id}.json`, import.meta.url);
		const file = JSON.parse(readFileSync(path, 'utf8'));
		expect(DATASETS[id]).toEqual(file);
	});

	it.each(DATASET_IDS)('only overrides known configuration keys in %s', (id) => {
		const allowed = configurationOverrideKeys();
		for (const key of Object.keys(DATASETS[id].configuration)) {
			expect(allowed.has(key)).toBe(true);
		}
	});
});