declare module 'bootstrap' {
	export class Offcanvas {
		static getInstance(element: Element): Offcanvas | null;
		hide(): void;
	}
}
