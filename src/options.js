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

    // Returns whether the change was stored, so the caller only clears its input on success.
    const save = async (next, message) => {
        try {
            await PMA_TOOLS_PREFERENCES.save('likeColumnTypes', next);
        } catch (error) {
            showStatus(`Couldn't save: ${error.message}`, true);
            return false;
        }
        types = next;
        render();
        showStatus(message);
        return true;
    };

    const render = () => {
        if (types.length === 0) {
            list.replaceChildren('No types: every column keeps phpMyAdmin\'s default.');
            return;
        }
        list.replaceChildren(...[...types].sort((a, b) => a.localeCompare(b)).map((type) => {
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
    };

    form.addEventListener('submit', async (event) => {
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
        if (await save([...types, type], `Added ${type}`)) {
            input.value = '';
        }
    });

    document.getElementById('reset-like-column-types').addEventListener('click', async () => {
        try {
            await PMA_TOOLS_PREFERENCES.reset('likeColumnTypes');
        } catch (error) {
            showStatus(`Couldn't reset: ${error.message}`, true);
            return;
        }
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

{
    const tabs = [...document.querySelectorAll('[role="tab"]')];

    // The page opens on the tab named in the address, so a reload keeps it: options.html#settings.
    const select = (tab, focus = false) => {
        for (const other of tabs) {
            const isSelected = other === tab;
            other.setAttribute('aria-selected', String(isSelected));
            other.tabIndex = isSelected ? 0 : -1;
            document.getElementById(other.getAttribute('aria-controls')).hidden = !isSelected;
        }
        history.replaceState(null, '', tab === tabs[0] ? location.pathname : `#${tab.id.replace(/^tab-/, '')}`);
        if (focus) {
            tab.focus();
        }
    };

    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(tab));
        tab.addEventListener('keydown', (event) => {
            const next = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: tabs.length - 1 }[event.key];
            if (next !== undefined) {
                event.preventDefault();
                select(tabs[(next + tabs.length) % tabs.length], true);
            }
        });
    });

    select(tabs.find((tab) => `#${tab.id.replace(/^tab-/, '')}` === location.hash) ?? tabs[0]);
}

(async () => {
    const list = document.getElementById('snippet-list');
    const form = document.getElementById('snippet-form');
    const heading = document.getElementById('snippet-form-heading');
    const nameInput = document.getElementById('snippet-name');
    const sqlInput = document.getElementById('snippet-sql');
    const submit = document.getElementById('snippet-submit');
    const cancel = document.getElementById('snippet-cancel');
    const status = document.getElementById('snippets-status');
    let snippets = await PMA_TOOLS_SNIPPETS.load();
    let editingId = null;

    const showStatus = (message, isError = false, undo = null) => {
        status.replaceChildren(message);
        status.classList.toggle('error', isError);
        if (undo !== null) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Undo';
            button.addEventListener('click', undo);
            status.append(button);
        }
    };

    const save = async (next, message, undo = null) => {
        try {
            await PMA_TOOLS_SNIPPETS.save(next);
            snippets = PMA_TOOLS_SNIPPETS.normalize(next);
            render();
            showStatus(message, false, undo);
            return true;
        } catch (error) {
            // storage.sync keeps about 8 KB per setting, which is where a long list of snippets ends.
            showStatus(/quota/i.test(error.message)
                ? 'Couldn\'t save: the snippets are too long for browser sync. Shorten or delete one.'
                : `Couldn't save: ${error.message}`, true);
            return false;
        }
    };

    const edit = (snippet) => {
        editingId = snippet?.id ?? null;
        nameInput.value = snippet?.name ?? '';
        sqlInput.value = snippet?.sql ?? '';
        heading.textContent = snippet === null ? 'Add a snippet' : 'Edit snippet';
        submit.textContent = snippet === null ? 'Add snippet' : 'Save changes';
        cancel.hidden = snippet === null;
        render();
        if (snippet !== null) {
            form.scrollIntoView({ block: 'nearest' });
            sqlInput.focus();
        }
    };

    const render = () => {
        list.replaceChildren(...snippets.map((snippet) => {
            const row = document.createElement('div');
            row.className = 'snippet';
            row.classList.toggle('editing', snippet.id === editingId);

            const body = document.createElement('div');
            body.className = 'snippet-body';
            const name = document.createElement('div');
            name.className = 'snippet-name';
            name.classList.toggle('untitled', snippet.name === '');
            name.textContent = snippet.name !== '' ? snippet.name : 'No name: found by its first line';
            const sql = document.createElement('pre');
            sql.textContent = snippet.sql;
            body.append(name, sql);

            const actions = document.createElement('div');
            actions.className = 'snippet-actions';
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.textContent = 'Edit';
            editButton.setAttribute('aria-label', `Edit ${PMA_TOOLS_SNIPPETS.label(snippet)}`);
            editButton.addEventListener('click', () => edit(snippet));
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.textContent = 'Delete';
            deleteButton.setAttribute('aria-label', `Delete ${PMA_TOOLS_SNIPPETS.label(snippet)}`);
            deleteButton.addEventListener('click', () => {
                const before = snippets;
                if (editingId === snippet.id) {
                    edit(null);
                }
                save(snippets.filter((item) => item.id !== snippet.id), `Deleted ${PMA_TOOLS_SNIPPETS.label(snippet)}`,
                    () => save(before, `Restored ${PMA_TOOLS_SNIPPETS.label(snippet)}`));
            });
            actions.append(editButton, deleteButton);

            row.append(body, actions);
            return row;
        }));
        if (snippets.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-list';
            empty.textContent = 'No snippets yet.';
            list.append(empty);
        }
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const snippet = { id: editingId ?? PMA_TOOLS_SNIPPETS.createId(), name: nameInput.value.trim(), sql: sqlInput.value.trim() };
        if (!PMA_TOOLS_SNIPPETS.isValidName(snippet.name)) {
            showStatus('A name can only contain letters, digits, spaces, - and _.', true);
            nameInput.focus();
            return;
        }
        if (snippet.sql === '') {
            showStatus('Enter a query.', true);
            sqlInput.focus();
            return;
        }
        const isNew = editingId === null || !snippets.some((item) => item.id === editingId);
        const next = isNew ? [...snippets, snippet] : snippets.map((item) => (item.id === snippet.id ? snippet : item));
        if (await save(next, `${isNew ? 'Added' : 'Saved'} ${PMA_TOOLS_SNIPPETS.label(snippet)}`)) {
            edit(null);
        }
    });

    cancel.addEventListener('click', () => {
        edit(null);
        showStatus('');
    });

    // Inserts at the cursor, replacing a selection, as typing would.
    document.getElementById('snippet-placeholders').addEventListener('click', (event) => {
        const placeholder = event.target.closest('[data-placeholder]')?.dataset.placeholder;
        if (placeholder !== undefined) {
            sqlInput.focus();
            sqlInput.setRangeText(placeholder, sqlInput.selectionStart, sqlInput.selectionEnd, 'end');
        }
    });

    PMA_TOOLS_SNIPPETS.onChange((changed) => {
        snippets = changed;
        render();
    });

    render();
})();

(async () => {
    const extensionApi = globalThis.browser ?? globalThis.chrome;
    const element = document.getElementById('version');
    element.textContent = `Version ${extensionApi.runtime.getManifest().version}`;

    // Only a local build (npm run build) ships build-info.json; a released version has none.
    let info;
    try {
        info = await (await fetch('build-info.json')).json();
    } catch {
        return;
    }
    const parts = [];
    if (info.branch) {
        const code = document.createElement('code');
        code.textContent = `${info.branch} @ ${info.commit}${info.dirty ? ' + uncommitted changes' : ''}`;
        parts.push(code);
    }
    const builtAt = new Date(info.builtAt);
    if (!Number.isNaN(builtAt.getTime())) {
        parts.push(`built ${builtAt.toLocaleString()}`);
    }
    element.append(' · local build', ...parts.flatMap((part) => [' · ', part]));
})();
