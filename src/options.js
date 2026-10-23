(async () => {
    const container = document.getElementById('shortcut-actions');
    const status = document.getElementById('shortcuts-status');
    const layoutMap = await navigator.keyboard?.getLayoutMap?.().catch(() => null) ?? null;

    let shortcuts = await PMA_TOOLS_SHORTCUTS.load();
    let recordingFor = null;

    PMA_TOOLS_SHORTCUTS.onChange((changed) => {
        shortcuts = changed;
        render();
    });

    document.getElementById('reset-shortcuts').addEventListener('click', async () => {
        await PMA_TOOLS_SHORTCUTS.reset();
        shortcuts = PMA_TOOLS_SHORTCUTS.normalize(null);
        stopRecording();
        showStatus('Shortcuts reset to the defaults');
    });

    window.addEventListener('keydown', (event) => {
        if (recordingFor === null) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Escape') {
            stopRecording();
            showStatus('');
            return;
        }
        const recorded = PMA_TOOLS_SHORTCUTS.fromEvent(event);
        if (recorded === null) {
            return;
        }
        addBinding(recordingFor, recorded);
    }, true);

    const doubleTap = PMA_TOOLS_SHORTCUTS.createDoubleTapDetector((key) => {
        if (recordingFor !== null) {
            addBinding(recordingFor, { code: key, double: true, alt: false, ctrl: false, meta: false, shift: false });
        }
    });
    window.addEventListener('keydown', (event) => doubleTap.keydown(event), true);
    window.addEventListener('keyup', (event) => doubleTap.keyup(event), true);

    render();

    async function addBinding(actionId, recorded) {
        const owner = PMA_TOOLS_SHORTCUTS.ACTIONS.find((action) => shortcuts[action.id]
            .some((existing) => PMA_TOOLS_SHORTCUTS.isSame(existing, recorded)));
        if (owner !== undefined) {
            stopRecording();
            showStatus(`${PMA_TOOLS_SHORTCUTS.format(recorded, layoutMap)} is already used for "${owner.label}".`, true);
            return;
        }
        shortcuts = { ...shortcuts, [actionId]: [...shortcuts[actionId], recorded] };
        stopRecording();
        await save(`Added ${PMA_TOOLS_SHORTCUTS.format(recorded, layoutMap)}`);
    }

    async function removeBinding(actionId, index) {
        const removed = shortcuts[actionId][index];
        shortcuts = { ...shortcuts, [actionId]: shortcuts[actionId].filter((_, i) => i !== index) };
        await save(`Removed ${PMA_TOOLS_SHORTCUTS.format(removed, layoutMap)}`);
    }

    async function save(message) {
        try {
            await PMA_TOOLS_SHORTCUTS.save(shortcuts);
            showStatus(message);
        } catch (error) {
            showStatus(`Couldn't save: ${error.message}`, true);
        }
        render();
    }

    function stopRecording() {
        recordingFor = null;
        render();
    }

    function showStatus(message, isError = false) {
        status.textContent = message;
        status.classList.toggle('error', isError);
    }

    function render() {
        container.replaceChildren(...PMA_TOOLS_SHORTCUTS.ACTIONS.map((action) => {
            const row = document.createElement('div');
            row.className = 'action';

            const label = document.createElement('span');
            label.className = 'action-label';
            label.textContent = action.label;

            const bindings = document.createElement('div');
            bindings.className = 'bindings';
            shortcuts[action.id].forEach((shortcut, index) => {
                const chip = document.createElement('span');
                chip.className = 'chip';
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.textContent = '×';
                remove.setAttribute('aria-label', `Remove ${PMA_TOOLS_SHORTCUTS.format(shortcut, layoutMap)}`);
                remove.addEventListener('click', () => removeBinding(action.id, index));
                chip.append(PMA_TOOLS_SHORTCUTS.format(shortcut, layoutMap), remove);
                bindings.append(chip);
            });

            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'add';
            const isRecording = recordingFor === action.id;
            add.classList.toggle('recording', isRecording);
            add.textContent = isRecording ? 'Press keys… (Esc to cancel)' : 'Add';
            add.addEventListener('click', () => {
                recordingFor = isRecording ? null : action.id;
                showStatus('');
                render();
            });
            bindings.append(add);

            row.append(label, bindings);
            return row;
        }));
        container.querySelector('.add.recording')?.focus();
    }
})();

for (const [key, fieldsetId, statusId, apply] of [
    ['theme', 'theme-choices', 'appearance-status', (theme) => PMA_TOOLS_PREFERENCES.applyTheme(document.documentElement, theme)],
    ['searchOperator', 'search-operator-choices', 'search-status', () => {}],
]) {
    (async () => {
        const choices = document.getElementById(fieldsetId);
        const status = document.getElementById(statusId);

        const select = (value) => {
            apply(value);
            choices.querySelector(`input[value="${CSS.escape(value)}"]`).checked = true;
        };

        select(await PMA_TOOLS_PREFERENCES.load(key));
        PMA_TOOLS_PREFERENCES.onChange(key, select);

        choices.addEventListener('change', async (event) => {
            apply(event.target.value);
            try {
                await PMA_TOOLS_PREFERENCES.save(key, event.target.value);
                status.textContent = 'Saved';
                status.classList.remove('error');
            } catch (error) {
                status.textContent = `Couldn't save: ${error.message}`;
                status.classList.add('error');
            }
        });
    })();
}

(async () => {
    const list = document.getElementById('like-column-types');
    const form = document.getElementById('add-like-column-type');
    const input = document.getElementById('like-column-type');
    const status = document.getElementById('like-column-types-status');
    let types = await PMA_TOOLS_PREFERENCES.load('likeColumnTypes');

    const showStatus = (message, isError = false) => {
        status.textContent = message;
        status.classList.toggle('error', isError);
    };

    const save = async (next, message) => {
        try {
            await PMA_TOOLS_PREFERENCES.save('likeColumnTypes', next);
            types = next;
            render();
            showStatus(message);
        } catch (error) {
            showStatus(`Couldn't save: ${error.message}`, true);
        }
    };

    const render = () => {
        list.replaceChildren(...types.map((type) => {
            const chip = document.createElement('span');
            chip.className = 'chip';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = '×';
            remove.setAttribute('aria-label', `Remove ${type}`);
            remove.addEventListener('click', () => save(types.filter((item) => item !== type), `Removed ${type}`));
            chip.append(type, remove);
            return chip;
        }));
        if (types.length === 0) {
            list.textContent = 'No types: every column keeps phpMyAdmin\'s default.';
        }
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        // Accepts a type as phpMyAdmin shows it, so varchar(255) adds varchar.
        const type = PMA_TOOLS_PREFERENCES.normalizeName(PMA_TOOLS_PREFERENCES.baseColumnType(input.value));
        if (type === null) {
            showStatus('Enter a column type such as enum or json.', true);
            return;
        }
        if (types.includes(type)) {
            showStatus(`${type} is already in the list.`, true);
            return;
        }
        input.value = '';
        save([...types, type], `Added ${type}`);
    });

    document.getElementById('reset-like-column-types').addEventListener('click', async () => {
        await PMA_TOOLS_PREFERENCES.reset('likeColumnTypes');
        types = PMA_TOOLS_PREFERENCES.DEFINITIONS.likeColumnTypes.fallback;
        render();
        showStatus('Types reset to the defaults');
    });

    PMA_TOOLS_PREFERENCES.onChange('likeColumnTypes', (changed) => {
        types = changed;
        render();
    });

    render();
})();
