import * as vscode from 'vscode';
import { getNonce } from './utils';

export class NoteInputProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'niview';

	private _view?: vscode.WebviewView;

    private _extensionUri: vscode.Uri;

    private _noteData: string = '';

	constructor(
		private _context: vscode.ExtensionContext,
        public currentFile: string | undefined,
    ) {
        this._extensionUri = _context.extensionUri;
        this._updateNoteData(currentFile);
    }

    public switchFile(file: string | undefined) {
        this._updateNoteData(file);
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

	public resolveWebviewView(
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

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch(data.type) {
                case 'updateNote':
                    {
                        let currentFile = vscode.window.activeTextEditor?.document.fileName;
                        if (currentFile) {
                            this._context.globalState.update(
                                currentFile,
                                data.content === '' ? undefined : data.content
                            );
                        }
                        break;
                    }
            }
		});
	}

    private _updateNoteData(currentFile: string | undefined) {
        if (currentFile) {
            let existingContent: string | undefined = this._context.globalState.get(currentFile);
            if (existingContent) {
                this._noteData = existingContent;
            }
            else {
                this._noteData = '';
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'noteinput.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				
				<title>Notes</title>
			</head>
			<body>
				<textarea class="noteInput" placeholder="Enter your note here....">${this._noteData}</textarea>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}
