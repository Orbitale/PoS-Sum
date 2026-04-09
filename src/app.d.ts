import type { Offcanvas } from 'bootstrap';

declare global {
	interface Window {
		bootstrap?: {
			Offcanvas: typeof Offcanvas;
		};
	}
}

export {};
