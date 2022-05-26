import * as vscode from 'vscode';
import { getNonce } from './utils';

export class NoteInputProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'niview';

	private _view?: vscode.WebviewView;

	private _extensionUri: vscode.Uri;

	constructor(
		private _context: vscode.ExtensionContext,
		public currentFile: string | undefined,
	) {
		this._extensionUri = _context.extensionUri;
	}

	public async switchFile(file: string | undefined) {
		if (this._view) {
			this._view.webview.html = await this._getHtmlForWebview(this._view.webview);
		}
	}

	public async deleteSticky(file: string) {
		this._context.globalState.update(file, undefined);
		if (this._view) {
			this._view.webview.html = await this._getHtmlForWebview(this._view.webview);
		}
	}

	public async resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async data => {
			switch (data.type) {
				case 'updateNote':
					{
						let currentFile = vscode.window.activeTextEditor?.document.fileName;
						if (currentFile) {
							this._context.globalState.update(
								currentFile,
								JSON.stringify({
									content: data.content === '' ? undefined : data.content,
									color: data.color,
								})
							);
						}
						break;
					}
				case 'render':
					{
						let parsed = await vscode.commands.executeCommand(
							'markdown.api.render', data.content
						);
						webviewView.webview.postMessage({
							type: 'rendered',
							content: parsed
						});
						break;
					}
			}
		});
	}

	private async _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'noteinput.css'));

		let currentFile = vscode.window.activeTextEditor?.document.fileName;
		let existingContent, parsedContent, color;
		if (currentFile) {
			const noteObj: string | undefined = this._context.globalState.get(currentFile);
			if (noteObj) {
				(
					{ content: existingContent, color } = JSON.parse(noteObj)
				);
			}
			if (existingContent) {
				parsedContent = await vscode.commands.executeCommand(
					'markdown.api.render', existingContent
				);
			}
		}
		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		let extensionSettings = vscode.workspace.getConfiguration('vssticky');
		let autosaveInterval = extensionSettings.get('autosaveInterval');

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource + ` 'nonce-${nonce}'`}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				
				<title>Notes</title>
				${
					color ? `<style nonce=${nonce}>
						.noteInput,
						.rendered {
							border-top-color: ${color};
						}
					</style>` : '' 
				}
			</head>
			<body>
				<input id="colorPicker" type="color" class="colorPicker" ${color ? `value="${color}"` : ''}>
				</input>
				<textarea
					class="noteInput${existingContent ? ' hide' : ''}"
					placeholder="Enter your note here (Markdown supported)...."
					nonce="${nonce}"
				>${existingContent || ''}</textarea>
				<div
					id="renderHolder"
					class="rendered${existingContent ? '' : ' hide'}"
					nonce="${nonce}"
				>${parsedContent || ''}</div>
				<div class="btnContainer">
					<button id="renderer" class="renderBtn" ${existingContent ? 'data-rendered="true"' : ''} ${existingContent ? "" : "disabled"}>${existingContent ? 'Raw' : 'Render'}</button>
				</div>
				<script nonce="${nonce}">
					let autosaveInterval = ${autosaveInterval};
				</script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}
