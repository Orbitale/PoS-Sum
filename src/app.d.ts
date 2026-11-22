import type { Offcanvas, Tooltip } from 'bootstrap';

declare global {
	interface Window {
		bootstrap?: {
			Offcanvas: typeof Offcanvas;
			Tooltip: typeof Tooltip;
		};
	}
}

export {};
