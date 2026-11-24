/** Pages display errors with `String(error)`: like Tauri's rejections, it must give the bare message. */
export class BackendError extends Error {
	override name = 'BackendError';

	override toString(): string {
		return this.message;
	}
}
