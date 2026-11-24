import { BackendError } from './errors.ts';

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidArgument(path: string, expected: string): BackendError {
	return new BackendError(`Invalid argument \`${path}\`: expected ${expected}`);
}

/**
 * Rejects the arguments the Rust backend would fail to deserialize. Values are read one by one so
 * that commands build plain objects: IndexedDB can't store proxies such as Svelte's `$state`.
 */
export class Args {
	constructor(
		private readonly fields: Fields,
		private readonly path = ''
	) {}

	string(key: string, fallback?: string): string {
		return this.read(key, 'a string', (value) => typeof value === 'string', fallback);
	}

	integer(key: string): number {
		return this.read<number>(key, 'an integer', Number.isSafeInteger);
	}

	boolean(key: string, fallback?: boolean): boolean {
		return this.read(key, 'a boolean', (value) => typeof value === 'boolean', fallback);
	}

	optionalNumber(key: string): number | null {
		return this.read<number | null>(
			key,
			'a number',
			(value) => value === null || typeof value === 'number',
			null
		);
	}

	oneOf<T extends string>(key: string, values: readonly T[]): T {
		return this.read(key, `one of ${values.join(', ')}`, (value) => values.includes(value as T));
	}

	object(key: string): Args {
		return new Args(this.read(key, 'an object', isFields), `${this.path}${key}.`);
	}

	list(key: string): Args[] {
		return this.read<unknown[]>(key, 'an array', Array.isArray).map((value, index) => {
			const path = `${this.path}${key}[${index}]`;
			if (!isFields(value)) {
				throw invalidArgument(path, 'an object');
			}
			return new Args(value, `${path}.`);
		});
	}

	private read<T>(
		key: string,
		expected: string,
		isValid: (value: unknown) => boolean,
		fallback?: T
	): T {
		const value = this.fields[key];
		if (value === undefined && fallback !== undefined) {
			return fallback;
		}
		if (!isValid(value)) {
			throw invalidArgument(`${this.path}${key}`, expected);
		}
		return value as T;
	}
}
