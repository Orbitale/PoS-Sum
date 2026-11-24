import { fireEvent, render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#lib/api.ts', () => ({
	api_call: vi.fn()
}));

import { api_call } from '#lib/api.ts';
import DatabaseSavesModal from './DatabaseSavesModal.svelte';

const FIRST_SAVE = 'pos_sum_2026-11-23_18_30_00.db';
const SECOND_SAVE = 'pos_sum_2026-11-24_09_00_00_jour-2.db';

let saves: string[];
let restoreError: string | null;

async function fakeBackend(command: string, params: Record<string, unknown> = {}) {
	switch (command) {
		case 'list_database_saves':
			return [...saves];
		case 'create_database_save': {
			const fileName = `pos_sum_2026-11-24_14_29_03${params.label ? `_${params.label}` : ''}.db`;
			saves = [...saves, fileName].sort();
			return fileName;
		}
		case 'restore_database_save':
			if (restoreError) {
				throw restoreError;
			}
	}
}

function renderModal() {
	const onClose = vi.fn();
	const onRestored = vi.fn();
	render(DatabaseSavesModal, { props: { onClose, onRestored } });
	return { onClose, onRestored };
}

async function openRestoreDialog(user: ReturnType<typeof userEvent.setup>, fileName: string) {
	const item = (await screen.findByText(fileName)).closest('li') as HTMLElement;
	await user.click(within(item).getByRole('button', { name: 'Restaurer cette base de données' }));
	return screen.getByRole('alertdialog');
}

describe('DatabaseSavesModal', () => {
	beforeEach(() => {
		saves = [FIRST_SAVE, SECOND_SAVE];
		restoreError = null;
		vi.mocked(api_call)
			.mockReset()
			.mockImplementation(fakeBackend as typeof api_call);
	});

	it('lists the saves, each with a restore button', async () => {
		renderModal();

		expect(await screen.findByText(FIRST_SAVE)).toBeInTheDocument();
		expect(screen.getByText(SECOND_SAVE)).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: 'Restaurer cette base de données' })).toHaveLength(
			2
		);
	});

	it('tells when there is no save yet', async () => {
		saves = [];
		renderModal();

		expect(await screen.findByText('Aucune sauvegarde pour le moment.')).toBeInTheDocument();
	});

	it('saves the current database under an urlized custom name', async () => {
		const user = userEvent.setup();
		renderModal();
		const input = screen.getByLabelText('Nom personnalisé (optionnel)');

		expect(screen.getByText('pos_sum_AAAA-MM-JJ_HH_MM_SS.db')).toBeInTheDocument();
		await user.type(input, 'Fin de journée');
		expect(screen.getByText('pos_sum_AAAA-MM-JJ_HH_MM_SS_fin-de-journee.db')).toBeInTheDocument();

		await user.click(
			screen.getByRole('button', { name: 'Sauvegarder la base de données actuelle' })
		);

		expect(api_call).toHaveBeenCalledWith('create_database_save', { label: 'fin-de-journee' });
		expect(
			await screen.findByText('pos_sum_2026-11-24_14_29_03_fin-de-journee.db')
		).toBeInTheDocument();
		expect(input).toHaveValue('');
	});

	it('backs up the current state before restoring when asked to', async () => {
		const user = userEvent.setup();
		const { onRestored } = renderModal();

		const dialog = await openRestoreDialog(user, FIRST_SAVE);
		expect(dialog).toHaveTextContent(FIRST_SAVE);
		await user.click(within(dialog).getByRole('button', { name: 'Sauvegarder, puis restaurer' }));

		expect(vi.mocked(api_call).mock.calls).toEqual([
			['list_database_saves'],
			['create_database_save', { label: 'avant-restauration' }],
			['restore_database_save', { fileName: FIRST_SAVE }]
		]);
		expect(onRestored).toHaveBeenCalledOnce();
	});

	it('restores without backup when asked to', async () => {
		const user = userEvent.setup();
		const { onRestored } = renderModal();

		const dialog = await openRestoreDialog(user, SECOND_SAVE);
		await user.click(within(dialog).getByRole('button', { name: 'Restaurer sans sauvegarder' }));

		expect(vi.mocked(api_call).mock.calls).toEqual([
			['list_database_saves'],
			['restore_database_save', { fileName: SECOND_SAVE }]
		]);
		expect(onRestored).toHaveBeenCalledOnce();
	});

	it('cancels the restoration from the button and with Escape', async () => {
		const user = userEvent.setup();
		const { onClose } = renderModal();

		let dialog = await openRestoreDialog(user, FIRST_SAVE);
		await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

		dialog = await openRestoreDialog(user, FIRST_SAVE);
		await fireEvent.keyDown(dialog, { key: 'Escape' });
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(onClose).not.toHaveBeenCalled();
		expect(api_call).toHaveBeenCalledTimes(1);
	});

	it('keeps the modal open with the error when the restoration fails', async () => {
		const user = userEvent.setup();
		restoreError = 'Invalid save';
		const { onRestored } = renderModal();

		const dialog = await openRestoreDialog(user, FIRST_SAVE);
		await user.click(within(dialog).getByRole('button', { name: 'Restaurer sans sauvegarder' }));

		expect(await screen.findByText('Échec de la restauration : Invalid save')).toBeInTheDocument();
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
		expect(onRestored).not.toHaveBeenCalled();
	});

	it('closes from the button and with Escape', async () => {
		const user = userEvent.setup();
		const { onClose } = renderModal();

		await user.click(screen.getByRole('button', { name: 'Fermer' }));
		await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

		expect(onClose).toHaveBeenCalledTimes(2);
	});
});
