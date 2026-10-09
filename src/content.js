(() => {
    const SYSTEM_SCHEMAS = new Set(['information_schema', 'mysql', 'performance_schema', 'sys']);
    const CACHE_TTL = 5 * 60 * 1000;
    const CONCURRENCY = 6;
    const MAX_RESULTS = 50;

    const params = readCommonParams();
    if (params === null || document.getElementById('pma_navigation') === null) {
        return;
    }

    const isMac = /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform ?? navigator.platform);
    const shortcutLabel = isMac ? '⌘K' : 'Alt+K';
    const baseUrl = new URL('index.php', location.href).href;
    const cacheKey = `pma-tools:index:${location.host}:${params.server}`;
    // Firefox runs content-script fetch() under the extension's origin; content.fetch() uses the page's.
    const pageFetch = typeof content === 'object' && content !== null && typeof content.fetch === 'function'
        ? content.fetch.bind(content)
        : fetch.bind(window);

    const index = {
        databases: [],
        tables: [],
        loadedAt: 0,
        loading: null,
        progress: '',
        error: '',
    };

    let palette = null;
    // False while the focused field was focused by the page itself (the SQL tab's editor), not by the user.
    let isFocusUserDriven = false;
    let lastUserGestureAt = 0;

    restoreIndex();

    window.addEventListener('pointerdown', () => {
        lastUserGestureAt = Date.now();
        isFocusUserDriven = true;
    }, true);

    window.addEventListener('focusin', () => {
        isFocusUserDriven = Date.now() - lastUserGestureAt < 1000;
    }, true);

    window.addEventListener('keydown', (event) => {
        const isShortcut = event.code === 'KeyK' && (isMac
            ? event.metaKey && !event.ctrlKey && !event.altKey
            : event.altKey && !event.ctrlKey && !event.metaKey);
        if (!isShortcut) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (palette === null) {
            openPalette();
        } else {
            closePalette();
        }
    }, true);

    window.addEventListener('keydown', (event) => {
        const direction = getTabDirection(event);
        if (direction === null) {
            if (!['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) {
                lastUserGestureAt = Date.now();
                isFocusUserDriven = true;
            }
            return;
        }
        if (event.repeat || palette !== null || (isFocusUserDriven && isEditable(event.composedPath()[0]))) {
            return;
        }
        const tabs = [...document.querySelectorAll(
            '#topmenu > li:not(.dropdown) > a.nav-link, #topmenu .dropdown-menu > li > a.nav-link',
        )];
        if (tabs.length < 2) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        const active = tabs.findIndex((tab) => tab.parentElement.classList.contains('active'));
        const next = active === -1
            ? (direction === 1 ? 0 : tabs.length - 1)
            : (active + direction + tabs.length) % tabs.length;
        location.assign(tabs[next].href);
    }, true);

    function getTabDirection(event) {
        const hasModifier = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

        // Physical key positions: [ / ] on QWERTY, ^ / $ on AZERTY.
        const bareKeyDirection = { BracketLeft: -1, BracketRight: 1 }[event.code];
        if (bareKeyDirection !== undefined && !hasModifier) {
            return bareKeyDirection;
        }

        // Alt+←/→ is browser back/forward on Windows and Linux, hence the extra Shift there.
        const arrowDirection = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
        if (arrowDirection !== undefined && event.altKey && !event.ctrlKey && !event.metaKey && event.shiftKey === !isMac) {
            return arrowDirection;
        }

        return null;
    }

    function isEditable(element) {
        return element instanceof Element
            && (element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null);
    }

    function readCommonParams() {
        for (const script of document.querySelectorAll('script:not([src])')) {
            const source = script.textContent;
            const start = source.indexOf('CommonParams.setAll({');
            if (start === -1) {
                continue;
            }
            const result = {};
            const pattern = /(\w+):"((?:[^"\\]|\\.)*)"/g;
            const body = source.slice(start, source.indexOf('});', start));
            for (const match of body.matchAll(pattern)) {
                result[match[1]] = match[2].replace(/\\n/g, '\n').replace(/\\(.)/g, '$1');
            }
            return typeof result.server === 'string' ? result : null;
        }
        return null;
    }

    function getToken() {
        return document.querySelector('input[name="token"]')?.value || params.token;
    }

    function getCurrentDatabase() {
        return new URLSearchParams(location.search).get('db') || params.db || '';
    }

    async function post(route, data = {}) {
        const body = new URLSearchParams({
            ...data,
            ajax_request: 'true',
            server: params.server,
            token: getToken(),
        });
        const response = await pageFetch(`${baseUrl}?route=${route}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body,
        });
        let json;
        try {
            json = await response.json();
        } catch {
            throw new Error('Unexpected response — has the session expired?');
        }
        if (json.success !== true) {
            throw new Error(stripTags(json.error || json.message || 'Request failed'));
        }
        return json;
    }

    function stripTags(html) {
        const element = document.createElement('div');
        element.innerHTML = String(html);
        return element.textContent.trim();
    }

    function asList(value) {
        if (Array.isArray(value)) {
            return value;
        }
        return value !== null && typeof value === 'object' ? Object.values(value) : [];
    }

    function restoreIndex() {
        try {
            const cached = JSON.parse(sessionStorage.getItem(cacheKey) ?? 'null');
            if (cached !== null && Array.isArray(cached.databases) && Array.isArray(cached.tables)) {
                Object.assign(index, {
                    databases: cached.databases,
                    tables: cached.tables,
                    loadedAt: cached.loadedAt,
                });
            }
        } catch {
            // Storage unavailable or corrupt: the index is rebuilt on open.
        }
    }

    function storeIndex() {
        try {
            sessionStorage.setItem(cacheKey, JSON.stringify({
                databases: index.databases,
                tables: index.tables,
                loadedAt: index.loadedAt,
            }));
        } catch {
            // Quota exceeded on huge servers: keep the in-memory index only.
        }
    }

    function loadIndex() {
        if (index.loading !== null) {
            return index.loading;
        }
        index.error = '';
        index.loading = (async () => {
            try {
                index.progress = 'Loading databases…';
                render();
                const databases = asList((await post('/databases')).databases).map(String);
                const currentDatabase = getCurrentDatabase();
                const queue = databases
                    .filter((database) => !SYSTEM_SCHEMAS.has(database))
                    .sort((a, b) => (b === currentDatabase) - (a === currentDatabase));
                const tables = [];
                let done = 0;

                index.databases = databases;
                const worker = async () => {
                    while (queue.length !== 0) {
                        const database = queue.shift();
                        try {
                            const response = await post('/tables', { db: database });
                            for (const table of asList(response.tables)) {
                                tables.push({ db: database, table: String(table) });
                            }
                        } catch {
                            // A database without access rights is skipped, not fatal.
                        }
                        done++;
                        index.progress = `Loading tables ${done}/${databases.length}…`;
                        index.tables = tables;
                        render();
                    }
                };
                await Promise.all(Array.from({ length: CONCURRENCY }, worker));

                index.tables = tables;
                index.loadedAt = Date.now();
                storeIndex();
            } catch (error) {
                index.error = error.message;
            } finally {
                index.progress = '';
                index.loading = null;
                render();
            }
        })();
        return index.loading;
    }

    function score(text, query) {
        if (query === '') {
            return { score: 0, positions: [] };
        }
        const haystack = text.toLowerCase();
        const position = haystack.indexOf(query);
        if (position !== -1) {
            const positions = Array.from({ length: query.length }, (_, i) => position + i);
            if (haystack === query) {
                return { score: 1000, positions };
            }
            const atBoundary = position === 0 || /[_\-.\s]/.test(haystack[position - 1]);
            return { score: (position === 0 ? 800 : atBoundary ? 700 : 600) - haystack.length, positions };
        }

        const positions = [];
        let total = 300 - haystack.length;
        let from = 0;
        for (const character of query) {
            const found = haystack.indexOf(character, from);
            if (found === -1) {
                return null;
            }
            if (found === 0 || /[_\-.\s]/.test(haystack[found - 1])) {
                total += 10;
            }
            if (positions.length !== 0 && found === positions[positions.length - 1] + 1) {
                total += 5;
            } else {
                total -= found - from;
            }
            positions.push(found);
            from = found + 1;
        }
        return { score: total, positions };
    }

    function search(rawQuery) {
        const query = rawQuery.trim().toLowerCase();
        const currentDatabase = getCurrentDatabase();
        const results = [];

        if (query === '') {
            for (const entry of index.tables) {
                if (entry.db === currentDatabase) {
                    results.push({ type: 'table', ...entry, score: 0, dbPositions: [], tablePositions: [] });
                }
            }
            for (const database of index.databases) {
                results.push({ type: 'db', db: database, score: 0, dbPositions: [] });
            }
            return results.slice(0, MAX_RESULTS);
        }

        const separator = query.indexOf('.');
        const dbQuery = separator === -1 ? null : query.slice(0, separator);
        const tableQuery = separator === -1 ? query : query.slice(separator + 1);

        for (const entry of index.tables) {
            let dbMatch = { score: 0, positions: [] };
            if (dbQuery !== null) {
                dbMatch = score(entry.db, dbQuery);
                if (dbMatch === null) {
                    continue;
                }
            }
            const tableMatch = score(entry.table, tableQuery);
            if (tableMatch === null) {
                continue;
            }
            results.push({
                type: 'table',
                ...entry,
                score: tableMatch.score + dbMatch.score / 4 + (entry.db === currentDatabase ? 50 : 0),
                dbPositions: dbMatch.positions,
                tablePositions: tableMatch.positions,
            });
        }

        if (dbQuery === null || tableQuery === '') {
            for (const database of index.databases) {
                const dbMatch = score(database, dbQuery ?? query);
                if (dbMatch !== null) {
                    results.push({
                        type: 'db',
                        db: database,
                        score: dbMatch.score + 25 - (SYSTEM_SCHEMAS.has(database) ? 200 : 0),
                        dbPositions: dbMatch.positions,
                    });
                }
            }
        }

        return results
            .sort((a, b) => b.score - a.score || (a.table ?? a.db).localeCompare(b.table ?? b.db))
            .slice(0, MAX_RESULTS);
    }

    function urlFor(result, structure) {
        const url = new URL(baseUrl);
        url.searchParams.set('server', params.server);
        url.searchParams.set('db', result.db);
        if (result.type === 'db') {
            url.searchParams.set('route', '/database/structure');
        } else if (structure) {
            url.searchParams.set('route', '/table/structure');
            url.searchParams.set('table', result.table);
        } else {
            url.searchParams.set('route', '/sql');
            url.searchParams.set('table', result.table);
            url.searchParams.set('pos', '0');
        }
        return url.href;
    }

    function go(result, { structure = false, newTab = false } = {}) {
        const url = urlFor(result, structure);
        closePalette();
        if (newTab) {
            window.open(url, '_blank', 'noopener');
        } else {
            location.href = url;
        }
    }

    function openPalette() {
        const host = document.createElement('div');
        host.id = 'pma-tools-palette';
        const root = host.attachShadow({ mode: 'closed' });

        // Keep keystrokes away from phpMyAdmin's single-key shortcuts on document.
        for (const type of ['keydown', 'keyup', 'keypress']) {
            host.addEventListener(type, (event) => event.stopPropagation());
        }

        root.innerHTML = `
            <style>${PMA_TOOLS_PALETTE_CSS}</style>
            <div class="backdrop">
                <div class="dialog" role="dialog" aria-modal="true" aria-label="Jump to database or table">
                    <div class="search">
                        <input type="text" placeholder="Jump to table or database… (db.table to narrow)"
                               role="combobox" aria-expanded="true" aria-controls="pma-tools-results"
                               aria-autocomplete="list" autocomplete="off" spellcheck="false">
                        <button type="button" class="status" hidden></button>
                    </div>
                    <ul class="results" id="pma-tools-results" role="listbox"></ul>
                    <div class="footer">
                        <span><kbd>↵</kbd> browse</span>
                        <span><kbd>${isMac ? '⌥' : 'Alt'}↵</kbd> structure</span>
                        <span><kbd>${isMac ? '⌘' : 'Ctrl'}↵</kbd> new tab</span>
                        <span><kbd>⇥</kbd> complete</span>
                        <span><kbd>esc</kbd> close</span>
                    </div>
                </div>
            </div>`;

        const input = root.querySelector('input');
        const status = root.querySelector('.status');
        status.style.cssText = 'border:0;background:none;cursor:pointer;font:inherit;';

        palette = {
            host,
            input,
            list: root.querySelector('.results'),
            status,
            results: [],
            selected: 0,
            previousFocus: document.activeElement,
        };

        root.querySelector('.backdrop').addEventListener('mousedown', (event) => {
            if (event.target === event.currentTarget) {
                closePalette();
            }
        });
        status.addEventListener('click', () => {
            if (index.loading === null) {
                loadIndex();
            }
            input.focus();
        });
        input.addEventListener('input', () => {
            palette.selected = 0;
            render();
        });
        input.addEventListener('keydown', onKeydown);

        document.documentElement.append(host);
        input.focus();
        render();

        if (index.loadedAt === 0 || Date.now() - index.loadedAt > CACHE_TTL) {
            loadIndex();
        }
    }

    function closePalette() {
        if (palette === null) {
            return;
        }
        palette.host.remove();
        palette.previousFocus?.focus?.();
        palette = null;
    }

    function onKeydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            closePalette();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const count = palette.results.length;
            if (count !== 0) {
                palette.selected = (palette.selected + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
                renderSelection();
            }
        } else if (event.key === 'Tab') {
            event.preventDefault();
            const result = palette.results[palette.selected];
            if (result !== undefined) {
                // A database completes to "db." so the table can be typed straight after it.
                palette.input.value = result.type === 'table' ? `${result.db}.${result.table}` : `${result.db}.`;
                palette.selected = 0;
                render();
            }
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const result = palette.results[palette.selected];
            if (result !== undefined) {
                go(result, {
                    structure: event.altKey,
                    newTab: isMac ? event.metaKey : event.ctrlKey,
                });
            }
        }
    }

    function highlight(text, positions) {
        const fragment = document.createDocumentFragment();
        const marked = new Set(positions);
        let buffer = '';
        let bufferMarked = false;
        const flush = () => {
            if (buffer === '') {
                return;
            }
            if (bufferMarked) {
                const mark = document.createElement('mark');
                mark.textContent = buffer;
                fragment.append(mark);
            } else {
                fragment.append(buffer);
            }
            buffer = '';
        };
        [...text].forEach((character, i) => {
            if (marked.has(i) !== bufferMarked) {
                flush();
                bufferMarked = marked.has(i);
            }
            buffer += character;
        });
        flush();
        return fragment;
    }

    function render() {
        if (palette === null) {
            return;
        }
        palette.results = search(palette.input.value);
        palette.selected = Math.min(palette.selected, Math.max(palette.results.length - 1, 0));

        const currentDatabase = getCurrentDatabase();
        const items = palette.results.map((result, i) => {
            const item = document.createElement('li');
            item.className = 'item';
            item.id = `pma-tools-result-${i}`;
            item.setAttribute('role', 'option');

            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = result.type === 'db' ? 'db' : 'tbl';

            const label = document.createElement('span');
            label.className = 'label';
            if (result.type === 'table') {
                const database = document.createElement('span');
                database.className = 'db';
                database.append(highlight(result.db, result.dbPositions), '.');
                label.append(database, highlight(result.table, result.tablePositions));
            } else {
                label.append(highlight(result.db, result.dbPositions));
            }

            item.append(badge, label);
            if (result.db === currentDatabase && result.type === 'db') {
                const current = document.createElement('span');
                current.className = 'current';
                current.textContent = 'current';
                item.append(current);
            }

            item.addEventListener('mousemove', () => {
                if (palette.selected !== i) {
                    palette.selected = i;
                    renderSelection();
                }
            });
            item.addEventListener('click', (event) => {
                go(result, {
                    structure: event.altKey,
                    newTab: isMac ? event.metaKey : event.ctrlKey,
                });
            });
            return item;
        });

        if (items.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'empty';
            empty.textContent = index.error !== ''
                ? index.error
                : index.loading !== null ? 'Loading…' : 'No matching databases or tables';
            items.push(empty);
        }
        palette.list.replaceChildren(...items);

        palette.status.hidden = false;
        if (index.progress !== '') {
            palette.status.textContent = index.progress;
            palette.status.title = '';
        } else if (index.error !== '') {
            palette.status.textContent = 'Retry';
            palette.status.title = index.error;
        } else {
            palette.status.textContent = `${index.tables.length} tables · refresh`;
            palette.status.title = `Indexed ${new Date(index.loadedAt).toLocaleTimeString()} — click to reload`;
        }

        renderSelection();
    }

    function renderSelection() {
        const items = palette.list.querySelectorAll('.item');
        items.forEach((item, i) => item.setAttribute('aria-selected', String(i === palette.selected)));
        const selected = items[palette.selected];
        if (selected !== undefined) {
            palette.input.setAttribute('aria-activedescendant', selected.id);
            selected.scrollIntoView({ block: 'nearest' });
        } else {
            palette.input.removeAttribute('aria-activedescendant');
        }
    }

    console.debug(`[phpMyAdmin Tools] ${shortcutLabel} opens the quick jump palette.`);
})();
