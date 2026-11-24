import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIGURATION_DEFAULTS, DATASETS } from './seed.ts';

function readRustSource(path: string): string {
	return readFileSync(new URL(`../../../src-tauri/src/${path}`, import.meta.url), 'utf8');
}

/** The seed files write one row per line, starting with its text id. */
function parseSqlRows(sql: string): (string | number)[][] {
	return sql
		.split('\n')
		.filter((line) => line.trim().startsWith("('"))
		.map((line) =>
			[...line.matchAll(/'((?:[^']|'')*)'|(-?\d+)/g)].map(([, text, number]) =>
				text === undefined ? Number(number) : text.replaceAll("''", "'")
			)
		);
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

	it('has the datasets of the Rust backend', () => {
		const source = readRustSource('db.rs');
		const names = [...source.matchAll(/"([\w-]+)" => include_str!/g)].map(([, name]) => name);
		expect(Object.keys(DATASETS)).toEqual(names);
	});

	it.each(Object.keys(DATASETS))('has the rows of the %s.sql seed', (name) => {
		const [categoriesSql, productsSql] = readRustSource(`seed/${name}.sql`).split(
			'INSERT OR IGNORE INTO products'
		);
		expect(DATASETS[name]).toEqual({
			categories: parseSqlRows(categoriesSql).map(([id, label, color]) => ({ id, label, color })),
			products: parseSqlRows(productsSql).map(
				([id, name, price, category_id, available, fixed_price]) => ({
					id,
					name,
					price,
					category_id,
					available: available === 1,
					fixed_price: fixed_price === 1
				})
			)
		});
	});
});
