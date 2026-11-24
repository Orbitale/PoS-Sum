import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Numpad from './Numpad.svelte';

describe('Numpad', () => {
	it('maps the backspace and minus buttons to key names', async () => {
		const user = userEvent.setup();
		const onKeyPress = vi.fn();
		render(Numpad, { props: { onKeyPress } });

		await user.click(screen.getByRole('button', { name: '7' }));
		await user.click(screen.getByRole('button', { name: '⌫' }));
		await user.click(screen.getByRole('button', { name: '−' }));

		expect(onKeyPress.mock.calls.map((call) => call[0])).toEqual([
			'7',
			'backspace',
			'-'
		]);
	});
});
