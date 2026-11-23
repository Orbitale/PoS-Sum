import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AmountField from './AmountField.svelte';

describe('AmountField (money entry)', () => {
	it('shows validation state and can hide the numpad', () => {
		render(AmountField, {
			props: {
				id: 'amount',
				label: 'Prix',
				value: '1,00',
				invalid: true,
				hint: 'Trop bas',
				showNumpad: false,
				onValueChange: vi.fn()
			}
		});

		expect(screen.getByText('Prix')).toBeInTheDocument();
		expect(screen.getByText('Trop bas')).toBeInTheDocument();
		expect(screen.getByRole('textbox')).toHaveClass('is-invalid');
		expect(document.getElementById('amount')).toBe(screen.getByRole('textbox'));
		expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument();
	});

	it('sanitizes keyboard input to digits and one separator', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(AmountField, {
			props: {
				label: 'Montant',
				value: '',
				showNumpad: false,
				onValueChange
			}
		});

		await user.type(screen.getByRole('textbox'), '12a,5b');
		expect(onValueChange).toHaveBeenLastCalledWith('12,5');
	});

	it('builds an amount from the on-screen numpad', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(AmountField, {
			props: { value: '3', onValueChange }
		});

		await user.click(screen.getByRole('button', { name: '4' }));
		expect(onValueChange).toHaveBeenCalledWith('34');
		await user.click(screen.getByRole('button', { name: ',00' }));
		expect(onValueChange).toHaveBeenCalledWith('3,00');
	});

	it('blocks negative amounts when disallowed (cash / totals)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(AmountField, {
			props: {
				value: '10',
				allowNegative: false,
				onValueChange
			}
		});

		await user.click(screen.getByRole('button', { name: '−' }));
		expect(onValueChange).toHaveBeenCalledWith('10');
	});
});
