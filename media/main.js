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

const sendMessage = debounce((text, color) => {
    vscode.postMessage({
        type: 'updateNote',
        content: text,
        color: color
    });
}, autosaveInterval);

const rgbToHex = (r, g, b) => {
    const toHex = (r_, g_, b_) => {
        return '#' + [r_, g_, b_].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    };
    if (typeof r === 'string') {
        let patt = new RegExp(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/, 'g');
        let matches = Array.from(r.matchAll(patt));
        if (matches.length < 1 || matches[0].length < 4) {
            throw new Error('Invalid rgb string');
        }
        let [r_, g_, b_] = matches[0].splice(1).map(x => parseInt(x, 10));
        return toHex(r_, g_, b_);
    }
    else if (g && b) {
        return toHex(r, g, b);
    }
    throw new Error('Invalid arguments');
};

(function () {
    const noteInput = document.querySelector('textarea.noteInput');
    const renderButton = document.querySelector('#renderer');
    const renderHolder = document.querySelector('#renderHolder');
    const colorPicker = document.querySelector('#colorPicker');

    const checkChanged = (event) => {
        let checkbox = event.target;
        let enabled = checkbox.checked;
        let labelText = checkbox.labels[0].textContent;
        let noteText = noteInput.value;
        let patt = new RegExp(`(\\[[xX\\s]\\])\\s${labelText}`);
        let replacedText = noteText.replace(
            patt, `[${enabled ? 'X': ' '}] ${labelText}`
        );
        noteInput.value = replacedText;
        sendMessage(noteInput.value, colorPicker.value);
    };

    renderHolder.querySelectorAll('input[type=checkbox]').forEach(
        cb => cb.addEventListener('input', checkChanged)
    );

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

    if (!colorPicker.getAttribute('value')) {
        colorPicker.setAttribute(
            'value',
            rgbToHex(
                getComputedStyle(noteInput).getPropertyValue('border-top-color')
            )
        );
    }

    colorPicker.addEventListener('input', (e) => {
        noteInput.style.borderTopColor = e.target.value;
        renderHolder.style.borderTopColor = e.target.value;
    });

    colorPicker.addEventListener('change', (e) => {
        const text = noteInput.value;
        const color = e.target.value;
        sendMessage(text, color);
    });

    noteInput.addEventListener('input', (e) => {
        const text = e.target.value;
        const color = colorPicker.value;
        if (text.length > 0) {
            renderButton.disabled = false;
        }
        else {
            renderButton.disabled = true;
        }
        sendMessage(text, color);
    });

    noteInput.addEventListener('focusout', (e) => {
        e.preventDefault();
        modifyState();
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
            renderHolder.querySelectorAll('input[type=checkbox]').forEach(
                cb => cb.addEventListener('input', checkChanged)
            );
            renderButton.innerText = 'Raw';
            renderButton.dataset['rendered'] = "true";
        }
    });

}());
