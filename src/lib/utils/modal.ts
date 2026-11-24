export function isBackdropClick(event: MouseEvent): boolean {
	return event.currentTarget === event.target;
}
