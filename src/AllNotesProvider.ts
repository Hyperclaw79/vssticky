import path = require('path');
import * as vscode from 'vscode';
import { getNonce, getRandomInt } from './utils';

type Note = {
    title: string;
    content: string;
    color: string;
    path: string;
};

export class AllNotesProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'anview';

    private _view?: vscode.WebviewView;

    private _extensionUri: vscode.Uri;

    private _notes: Note[] = [];

    constructor(
        private _context: vscode.ExtensionContext
    ) {
        this._extensionUri = _context.extensionUri;
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
        this._createNotes();
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(
            async data => {
                switch (data.command) {
                    case 'open':
                        {
                            await vscode.commands.executeCommand(
                                'vscode.open',
                                vscode.Uri.parse(`file:${data.path}`)
                            );
                            break;
                        }
                }
            }
        );
    }

    private _createNotes() {
        this._notes = this._context.globalState.keys().map(key => {
            let noteObj: Note = JSON.parse(
                this._context.globalState.get(key)!
            );
            return {
                title: path.basename(key).toTitleCase(),
                content: noteObj.content || '',
                color: noteObj.color,
                path: key
            };
        });
    }

    public refreshNotes() {
        this._createNotes();
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const nonce = getNonce();

        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleAnUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'allnotes.css'));

        const notes = this._notes.map(note => {
            return `
            <li>
                <a
                    href="Double Click to Open:\n${note.path}"
                    data-fhash="${note.path.hashCode(true)}"
                    data-fpath="${note.path}"
                >
                    <h2>${note.title}</h2>
                    <p>${note.content}</p>
                </a>
            </li>`;
        });

        const styleMap = `
            <style nonce=${nonce}>
                ${
                    this._notes.map((note, idx) => {
                        const range = [0, 5 * Math.pow(-1, idx)].sort();
                        const randDeg = getRandomInt(...range as [number, number]);
                        return `
                            a[data-fhash="${note.path.hashCode(true)}"] {
                                position: relative;
                                background-color: ${note.color};
                                transform: rotate(${randDeg}deg);
                            }`;
                    }).join('\n')
                }

                ul li:not(:first-child) {
                    margin-top: -${5 + (0.2 * this._notes.length)}em;
                }
                
                @media screen and (min-width: 400px) {
                    ul li:not(:first-child) {
                        margin-left: -${5 + (0.2 * this._notes.length)}em;
                        margin-top: 1em;
                    }
                }                
            </style>`;

        return `<!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource + ` 'nonce-${nonce}'`}; script-src 'nonce-${nonce}';">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <link href="${styleResetUri}" rel="stylesheet">
                    <link href="${styleVSCodeUri}" rel="stylesheet">
                    <link href="${styleAnUri}" rel="stylesheet">
                    ${styleMap}
                </head>
                <body>
                    <ul>
                        ${notes.join('\n')}
                    </ul>
                </body>
                <script nonce=${nonce}>
                    vscode = acquireVsCodeApi();
                    document.querySelectorAll('a[data-fpath]').forEach(
                        a => a.addEventListener('dblclick', e => {
                            e.preventDefault();
                            const path = a.getAttribute('data-fpath');
                            vscode.postMessage({
                                command: 'open',
                                path: path
                            });
                        })
                    );
                </script>
            </html>`;
    }
}
