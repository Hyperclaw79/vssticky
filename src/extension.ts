import * as vscode from 'vscode';
import * as path from 'path';
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
	const mkdwnProvider = new class implements vscode.TextDocumentContentProvider {
		onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
		onDidChange = this.onDidChangeEmitter.event;

		provideTextDocumentContent(uri: vscode.Uri): string {
			let content = decodeURIComponent(uri.query);
			return content;
		}
	};

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
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(
			'markdown', mkdwnProvider
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
			anProvider.refreshNotes();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vssticky.exportStickyNotes', async () => {
			let notes = [...context.globalState.keys()].sort().map(key => {
				let note = JSON.parse(context.globalState.get(key)!);
				return {
					[key]: {
						content: note.content,
						color: note.color
					}
				};
			});
			let noteJson = JSON.stringify(notes, null, 3);
			let saveUri = await vscode.window.showSaveDialog({
				filters: {
					// eslint-disable-next-line @typescript-eslint/naming-convention
					'JSON': ['json']
				}
			});
			if (!saveUri) {
				vscode.window.showErrorMessage('No file selected.');
				return;
			}
			let uintArr = new Uint8Array(
				Array.from(noteJson).map(char => char.charCodeAt(0))
			);
			try {
				await vscode.workspace.fs.writeFile(saveUri, uintArr);
				vscode.window.showInformationMessage(
					`Sticky notes exported to ${saveUri.fsPath}`
				);
			}
			catch (e) {
				vscode.window.showErrorMessage((e as Error).message);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vssticky.importStickyNotes', async () => {
			let openUri = await vscode.window.showOpenDialog({
				filters: {
					// eslint-disable-next-line @typescript-eslint/naming-convention
					'JSON': ['json']
				}
			});
			if (!openUri) {
				vscode.window.showErrorMessage('No file selected.');
				return;
			}
			let noteJson = await vscode.workspace.fs.readFile(openUri[0]);
			let notes = JSON.parse(
				Array.from(noteJson).map(
					char => String.fromCharCode(char)
				).join('')
			);
			for (let note of notes) {
				for (let key in note) {
					context.globalState.update(key, JSON.stringify(note[key]));
				}
			}
			vscode.window.showInformationMessage(
				`Sticky notes imported from ${openUri[0].fsPath}`
			);
			let editor = vscode.window.activeTextEditor;
			if (editor) {
				await openNote(editor);
			}
			anProvider.refreshNotes();
		})
	);

	interface Node {
		key: string;
		content?: string;
		children?: Node[];
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('vssticky.createTodo', async () => {
			let uri;
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Creating todo list...'
			}, async (progress, token) => {
				let dataObj: Node[] = [...context.globalState.keys()].sort().map(key => (
					{
						key: key.replace(/\w:/, '').split(path.sep).join(path.posix.sep),
						content: JSON.parse(context.globalState.get(key)!).content,
						children: []
					}
				));
				let treeObj: Node = makeTree(dataObj);
				let mkdwn = toMarkdown(treeObj);
				uri = vscode.Uri.parse(
					`markdown:VSSticky-Todo.md?${encodeURIComponent(mkdwn)}`
				);
			});
			await vscode.commands.executeCommand(
				'markdown.showPreview',
				uri
			);
		})
	);

	async function openNote(editor?: vscode.TextEditor) {
		let currFile = editor?.document.fileName;
		await niProvider.switchFile(currFile);
		if (currFile && context.globalState.get(currFile)) {
			vscode.commands.executeCommand('niview.focus');
		}
	}

	const makeTree = (data: Node[]) => {
		const base: Node = {
			key: '',
			content: '',
			children: []
		};

		for (let node of data) {
			const matches = node.key.match(/\/[^\/]+/g);
			let curr = base;

			matches?.forEach((e, i) => {
				const currPath = matches.slice(0, i + 1).join("");
				const child = curr.children?.find(subPath => subPath.key === currPath);

				if (child) {
					curr = child;
				}
				else {
					if (curr.children) {
						curr.children?.push({
							key: currPath,
							content: node.content,
							children: []
						});
						delete curr.content;
						curr = curr.children[curr.children.length - 1];
					}
				}
			});
		}

		const delevel: any = (node: any) => {
			if (node.children) {
				if (node.children.length === 1) {
					let child = node.children[0];
					child.children = child.children.map(delevel);
					return delevel(child);
				}
				node.children = node.children.map(delevel);
				return node;
			}
			return node;
		};

		const cleanKey = (node: any, key: string) => {
			if (node.children.length === 0) {
				node.key = node.key.replace(key, '');
			}
			else {
				node.children.forEach((child: Node, i: number) => {
					cleanKey(child, node.key);
				});
			}
		};

		let deleveled = delevel(base);
		cleanKey(deleveled, deleveled.key);
		return deleveled;
	};

	const toMarkdown = (node: Node, level: number = 0) => {
		let str = '';
		let title = node.content ? `🗎 ${node.key}` : `📁 ${node.key}`;
		str += `${'#'.repeat(level + 1)} ${title}\n`;
		if (node.content) {
			let content = node.content.split('\n').join(`\n${' '.repeat(level + 1)}> `);
			let paddedContent = `\n${' '.repeat(level + 1)}> ${content}\n\n`;
			str += paddedContent;
		}
		if (node.children) {
			node.children.forEach(child => {
				str += toMarkdown(child, level + 1);
			});
		}
		return str;
	};

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
