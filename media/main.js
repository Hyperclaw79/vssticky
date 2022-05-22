// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

const vscode = acquireVsCodeApi();

const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

const postMessage = debounce((text) => {
    vscode.postMessage({
        type: 'updateNote',
        content: text
    });
}, 500);

(function () {
    const noteInput = document.querySelector('textarea.noteInput');

    noteInput.addEventListener('input', (e) => {
        const text = e.target.value;
        postMessage(text);
    });
}());

