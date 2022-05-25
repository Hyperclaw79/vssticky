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
    const renderButton = document.querySelector('#renderer');
    const renderHolder = document.querySelector('#renderHolder');

    const modifyState = () => {
        if (renderButton.dataset['rendered'] === "true") {
            renderHolder.innerHTML = '';
            renderButton.dataset['rendered'] = "false";
            renderButton.innerText = 'Render';
            noteInput.classList.remove('hide');
            renderHolder.classList.add('hide');
        }
        else {
            const text = noteInput.value;
            vscode.postMessage({
                type: 'render',
                content: text
            });
        }
    };

    noteInput.addEventListener('input', (e) => {
        const text = e.target.value;
        if (text.length > 0) {
            renderButton.disabled = false;
        }
        else {
            renderButton.disabled = true;
        }
        postMessage(text);
    });

    renderButton.addEventListener('click', (e) => {
        e.preventDefault();
        modifyState();
    });

    renderHolder.addEventListener('dblclick', (e) => {
        e.preventDefault();
        modifyState();
        noteInput.focus();
    });

    window.addEventListener('message', (e) => {
        if (e.data.type === 'rendered') {
            noteInput.classList.add('hide');
            renderHolder.classList.remove('hide');
            renderHolder.innerHTML = e.data.content;
            renderButton.innerText = 'Raw';
            renderButton.dataset['rendered'] = "true";
        }
    });

}());

