export interface AmountInputOptions {
	allowNegative?: boolean;
}

export function formatCentsToInput(cents: number): string {
	return (cents / 100).toFixed(2).replace('.', ',');
}

export function parseEurosToCents(input: string): number {
	if (input.trim() === '') {
		return 0;
	}
	const val = parseFloat(input.replace(',', '.'));
	return Number.isNaN(val) ? 0 : Math.round(val * 100);
}

export function parseOptionalFloat(input: string): number | null {
	const trimmed = input.trim();
	if (trimmed === '') {
		return null;
	}
	const parsed = parseFloat(trimmed.replace(',', '.'));
	return Number.isFinite(parsed) ? parsed : null;
}

export function sanitizeAmountInput(raw: string, options: AmountInputOptions = {}): string {
	const allowNegative = options.allowNegative ?? true;
	const pattern = allowNegative ? /[^\d,.\-]/g : /[^\d,.]/g;
	let value = raw.replace(pattern, '');

	if (allowNegative) {
		const negative = value.startsWith('-');
		value = value.replace(/-/g, '');
		value = (negative ? '-' : '') + value;
	}

	const separatorMatch = value.match(/[,.]/);
	if (!separatorMatch || separatorMatch.index === undefined) {
		return value;
	}

	const sep = separatorMatch[0];
	const idx = separatorMatch.index;
	const intPart = value.slice(0, idx).replace(/[,.]/g, '');
	const fracPart = value.slice(idx + 1).replace(/[,.]/g, '');
	return `${intPart}${sep}${fracPart}`;
}

export function applyNumpadKey(
	current: string,
	key: string,
	options: AmountInputOptions = {}
): string {
	const allowNegative = options.allowNegative ?? true;
	let next = current;

	if (key === 'backspace') {
		next = next.slice(0, -1);
	} else if (key === '-') {
		if (!allowNegative) {
			return sanitizeAmountInput(next, options);
		}
		next = next.startsWith('-') ? next.slice(1) : '-' + next;
	} else if (key.startsWith(',')) {
		if (!next.includes(',') && !next.includes('.')) {
			next += ',';
		}
		if (key.length > 1) {
			next = next.replace(/[,.].*$/i, key);
		}
	} else {
		next += key;
	}

	return sanitizeAmountInput(next, options);
}
