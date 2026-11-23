/** Quote a CSV field for `;`-separated exports. */
export function quoteCsv(value: string): string {
	return `"${value.replace(/"/g, '""')}"`;
}

/** Cents → plain euro string for CSV cells (dot decimal, no currency symbol). */
export function centsToEurosCsv(cents: number): string {
	return (cents / 100).toFixed(2);
}

export function joinCsvRow(cells: string[]): string {
	return cells.join(';');
}

export function joinCsvLines(lines: string[]): string {
	return lines.join('\n');
}
