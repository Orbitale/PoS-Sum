/** True when the click landed on the overlay itself, not a child. */
export function isBackdropClick(event: MouseEvent): boolean {
	return event.currentTarget === event.target;
}
