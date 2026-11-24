export function formatPrice(cents: number): string {
	const sign = cents < 0 ? '-' : '';
	const abs = Math.abs(cents);
	const euros = Math.floor(abs / 100);
	const remainder = abs % 100;
	return `${sign}${euros},${remainder.toString().padStart(2, '0')} €`;
}
