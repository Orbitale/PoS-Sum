export function sanitizeCategoryId(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9._-]/g, '')
		.replace(/[._-]{2,}/g, (m) => m[0]);
}
