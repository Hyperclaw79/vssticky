import * as vscode from 'vscode';
import './utils';
import { NoteInputProvider } from './NoteInputProvider';
import { AllNotesProvider } from './AllNotesProvider';

export async function activate(context: vscode.ExtensionContext) {
	const anProvider = new AllNotesProvider(context);
	const niProvider = new NoteInputProvider(
		context,
		vscode.window.activeTextEditor?.document.fileName,
		anProvider
	);
	
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			NoteInputProvider.viewType, niProvider
		)
	);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			AllNotesProvider.viewType, anProvider
		)
	);

	await openNote(vscode.window.activeTextEditor);

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(async editor => {
			await openNote(editor);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vssticky.addStickyNote', async () => {
			let filepath = vscode.window.activeTextEditor?.document.fileName;
			if (!filepath) {
				vscode.window.showErrorMessage(
					'You need to use this command when editing a file.'
				);
				return;
			}
			await niProvider.resetView();
			vscode.commands.executeCommand('niview.focus');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vssticky.addEphemeralNote', async () => {
			let filepath = vscode.window.activeTextEditor?.document.fileName;
			if (!filepath) {
				vscode.window.showErrorMessage(
					'You need to use this command when editing a file.'
				);
				return;
			}
			if (context.globalState.get(filepath)) {
				vscode.window.showErrorMessage(
					`This file already has a sticky note.
					Please delete it before adding an ephemeral note.`
				);
			}
			else {
				await niProvider.resetView();
				niProvider.ephemeralMode = true;
				vscode.commands.executeCommand('niview.focus');
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vssticky.deleteStickyNote', async () => {
			let filepath = vscode.window.activeTextEditor?.document.fileName;
			if (!filepath) {
				vscode.window.showErrorMessage(
					'You need to use this command when editing a file.'
				);
				return;
			}
			await niProvider.deleteSticky(filepath);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vssticky.deleteAllNotes', async () => {
			for (let file of context.globalState.keys()) {
				context.globalState.update(file, undefined);
			}
			let editor = vscode.window.activeTextEditor;
			if (editor) {
				await openNote(editor);
			}
		})
	);

	async function openNote(editor?: vscode.TextEditor) {
		let currFile = editor?.document.fileName;
		await niProvider.switchFile(currFile);
		if (currFile && context.globalState.get(currFile)) {
			vscode.commands.executeCommand('niview.focus');
		}
	}

	return {
		extendMarkdownIt(md: any) {
			return md.use(
				require('markdown-it-checkbox')
			).use(
				require('markdown-it-emoji')
			);
		}
	};
}

export function deactivate() { }
