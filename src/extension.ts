import * as vscode from 'vscode';
// import * as path from 'path';
import './utils';
import { NoteInputProvider } from './NoteInputProvider';

export function activate(context: vscode.ExtensionContext) {
	const provider = new NoteInputProvider(
		context,
		vscode.window.activeTextEditor?.document.fileName
	);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			NoteInputProvider.viewType, provider
		)
	);

	openNote(vscode.window.activeTextEditor);

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			openNote(editor);
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
			vscode.commands.executeCommand('niview.focus');
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
			provider.deleteSticky(filepath);
		})
	);

	function openNote(editor?: vscode.TextEditor) {
		let currFile = editor?.document.fileName;
		if (currFile) {
			provider.switchFile(currFile);
			vscode.commands.executeCommand('niview.focus');
		}
	}
}

export function deactivate() {}
