export function urlize(value: string): string {
	return (
		value
			.toLowerCase()
			.normalize('NFKD')
			.replace(/\p{M}/gu, '')
			// Ligatures have no decomposition.
			.replaceAll('œ', 'oe')
			.replaceAll('æ', 'ae')
			.split(/[^a-z0-9]+/)
			.filter(Boolean)
			.join('-')
	);
}
