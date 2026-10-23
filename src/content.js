(() => {
    const SYSTEM_SCHEMAS = new Set(['information_schema', 'mysql', 'performance_schema', 'sys']);
    const CACHE_TTL = 5 * 60 * 1000;
    const CONCURRENCY = 6;
    const MAX_RESULTS = 50;
    // Overflowing tabs move into a "More" dropdown, whose own toggle is not a tab.
    const TAB_LINK_SELECTOR = '#topmenu > li:not(.dropdown) > a.nav-link, #topmenu .dropdown-menu > li > a.nav-link';

    const params = readCommonParams();
    if (params === null || document.getElementById('pma_navigation') === null) {
        return;
    }

    const isMac = PMA_TOOLS_SHORTCUTS.isMac;
    let shortcuts = PMA_TOOLS_SHORTCUTS.DEFAULTS;
    let theme = 'system';
    let snippets = [];
    const columnCache = new Map();
    const primaryKeyCache = new Map();
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
    const tabCache = new Map();
    // False while the focused field was focused by the page itself (the SQL tab's editor), not by the user.
    let isFocusUserDriven = false;
    let lastUserGestureAt = 0;

    restoreIndex();
    addIndicator();

    PMA_TOOLS_SHORTCUTS.load().then((loaded) => {
        shortcuts = loaded;
    });
    PMA_TOOLS_SHORTCUTS.onChange((changed) => {
        shortcuts = changed;
    });
    PMA_TOOLS_PREFERENCES.load('theme').then((loaded) => {
        theme = loaded;
    });
    PMA_TOOLS_PREFERENCES.onChange('theme', (changed) => {
        theme = changed;
        if (palette !== null) {
            PMA_TOOLS_PREFERENCES.applyTheme(palette.host, theme);
        }
    });
    PMA_TOOLS_SNIPPETS.load().then((loaded) => {
        snippets = loaded;
        render();
    });
    PMA_TOOLS_SNIPPETS.onChange((changed) => {
        snippets = changed;
        render();
    });

    prepareSearchPage();
    window.addEventListener('hashchange', prepareSearchPage);

    window.addEventListener('pointerdown', () => {
        lastUserGestureAt = Date.now();
        isFocusUserDriven = true;
    }, true);

    window.addEventListener('focusin', () => {
        isFocusUserDriven = Date.now() - lastUserGestureAt < 1000;
    }, true);

    // Registered before the other key listeners, which stop the events they handle.
    const doubleTap = PMA_TOOLS_SHORTCUTS.createDoubleTapDetector((key, event) => {
        const isDoubleTap = (item) => item.double && item.code === key;
        if (shortcuts.openPalette.some(isDoubleTap)) {
            togglePalette();
            return;
        }
        // Switching tabs leaves the page, so it waits until the user isn't typing, as the key shortcuts do.
        const direction = shortcuts.previousTab.some(isDoubleTap) ? -1 : shortcuts.nextTab.some(isDoubleTap) ? 1 : null;
        if (direction !== null && palette === null && !isTyping(event)) {
            goToTab(direction);
        }
    });
    window.addEventListener('keydown', (event) => doubleTap.keydown(event), true);
    window.addEventListener('keyup', (event) => doubleTap.keyup(event), true);

    window.addEventListener('keydown', (event) => {
        const shortcut = shortcuts.openPalette.find((item) => PMA_TOOLS_SHORTCUTS.matches(item, event));
        // A shortcut without Ctrl, Alt or Cmd would otherwise fire while typing, in a field or in the palette.
        if (shortcut === undefined
            || (!PMA_TOOLS_SHORTCUTS.hasModifier(shortcut) && (palette !== null || isTyping(event)))) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        togglePalette();
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
        if (event.repeat || palette !== null || isTyping(event)) {
            return;
        }
        if (goToTab(direction)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    function togglePalette() {
        if (palette === null) {
            openPalette();
        } else {
            closePalette();
        }
    }

    function goToTab(direction) {
        const tabs = [...document.querySelectorAll(TAB_LINK_SELECTOR)];
        if (tabs.length < 2) {
            return false;
        }
        const active = tabs.findIndex((tab) => tab.parentElement.classList.contains('active'));
        const next = active === -1
            ? (direction === 1 ? 0 : tabs.length - 1)
            : (active + direction + tabs.length) % tabs.length;
        location.assign(tabs[next].href);
        return true;
    }

    function addIndicator() {
        const icons = document.getElementById('page_nav_icons');
        if (icons === null || document.getElementById('pma-tools-indicator') !== null) {
            return;
        }
        const extensionApi = globalThis.browser ?? globalThis.chrome;

        const link = document.createElement('a');
        link.id = 'pma-tools-indicator';
        link.href = '#';
        link.title = 'phpMyAdmin Tools — settings';
        link.addEventListener('click', (event) => {
            event.preventDefault();
            extensionApi.runtime.sendMessage({ type: 'open-options' });
        });

        const image = document.createElement('img');
        image.src = extensionApi.runtime.getURL('icons/icon-32.png');
        image.alt = 'phpMyAdmin Tools settings';
        image.width = 16;
        image.height = 16;
        link.append(image);
        // A white backing keeps the logo legible on phpMyAdmin's grey top bar.
        link.style.backgroundColor = '#fff';

        // phpMyAdmin 6 shows its icons as small outlined buttons in a Bootstrap row; 5 as bare inline icons.
        if (icons.classList.contains('row')) {
            link.className = 'btn btn-sm btn-outline-secondary';
            const column = document.createElement('div');
            column.className = 'col-12';
            column.append(link);
            icons.prepend(column);
        } else {
            Object.assign(link.style, {
                display: 'inline-flex',
                alignItems: 'center',
                verticalAlign: 'middle',
                marginRight: '6px',
                padding: '2px',
                borderRadius: '4px',
            });
            icons.prepend(link);
        }
    }

    async function prepareSearchPage() {
        if (new URLSearchParams(location.search).get('route') !== '/table/search') {
            return;
        }
        const operator = await PMA_TOOLS_PREFERENCES.load('searchOperator');
        const likeColumnTypes = new Set(await PMA_TOOLS_PREFERENCES.load('likeColumnTypes'));
        const columnInputs = [...document.querySelectorAll('input[name^="criteriaColumnNames["]')];
        columnInputs.forEach((input, i) => {
            const select = document.querySelector(`select[name="criteriaColumnOperators[${i}]"]`);
            const type = document.querySelector(`input[name="criteriaColumnTypes[${i}]"]`)?.value ?? '';
            // Only replace phpMyAdmin's own default, and only on the configured column types: number columns offer LIKE too.
            if (select !== null && likeColumnTypes.has(PMA_TOOLS_PREFERENCES.baseColumnType(type)) && select.selectedIndex === 0 && select.value !== operator
                && [...select.options].some((option) => option.value === operator)) {
                select.value = operator;
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        const match = location.hash.match(/^#pma-tools-column=(.*)$/);
        if (match === null) {
            return;
        }
        history.replaceState(null, '', location.pathname + location.search);
        const column = decodeURIComponent(match[1]);
        const columnIndex = columnInputs.findIndex((input) => input.value === column);
        const field = document.querySelector(`[name="criteriaValues[${columnIndex}]"]`);
        if (columnIndex !== -1 && field !== null) {
            field.scrollIntoView({ block: 'center' });
            field.focus();
            isFocusUserDriven = true;
        }
    }

    function getTabDirection(event) {
        if (shortcuts.previousTab.some((item) => PMA_TOOLS_SHORTCUTS.matches(item, event))) {
            return -1;
        }
        if (shortcuts.nextTab.some((item) => PMA_TOOLS_SHORTCUTS.matches(item, event))) {
            return 1;
        }
        return null;
    }

    function isTyping(event) {
        return isFocusUserDriven && isEditable(event.composedPath()[0]);
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
            const body = extractObjectLiteral(source, start + 'CommonParams.setAll('.length);
            const result = parseJsonParams(body) ?? parseLegacyParams(body);
            if (result.server === undefined || result.server === null) {
                return null;
            }
            return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, String(value)]));
        }
        return null;
    }

    function extractObjectLiteral(source, openBrace) {
        let depth = 0;
        let quote = null;
        for (let i = openBrace; i < source.length; i++) {
            const character = source[i];
            if (quote !== null) {
                if (character === '\\') {
                    i++;
                } else if (character === quote) {
                    quote = null;
                }
            } else if (character === '"' || character === "'") {
                quote = character;
            } else if (character === '{') {
                depth++;
            } else if (character === '}' && --depth === 0) {
                return source.slice(openBrace, i + 1);
            }
        }
        return '';
    }

    // phpMyAdmin 6 writes the parameters as JSON.
    function parseJsonParams(body) {
        try {
            return JSON.parse(body);
        } catch {
            return null;
        }
    }

    // phpMyAdmin 5 writes them as a JavaScript object literal with unquoted keys: {server:"1",db:""}.
    function parseLegacyParams(body) {
        const result = {};
        for (const match of body.matchAll(/(\w+):"((?:[^"\\]|\\.)*)"/g)) {
            result[match[1]] = match[2].replace(/\\n/g, '\n').replace(/\\(.)/g, '$1');
        }
        return result;
    }

    function getToken() {
        return document.querySelector('input[name="token"]')?.value || params.token;
    }

    function getCurrentDatabase() {
        return new URLSearchParams(location.search).get('db') || params.db || '';
    }

    function getCurrentTable() {
        const query = new URLSearchParams(location.search);
        // A url naming a db without a table is a database page, whatever the page parameters still say.
        return query.has('db') ? query.get('table') ?? '' : params.table || '';
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
        // A DOMParser document is inert: no scripts run and no images load while it is parsed.
        return new DOMParser().parseFromString(String(html), 'text/html').body.textContent.trim();
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
        const parts = rawQuery.split('/');
        if (parts.length >= 3) {
            return searchColumns(parts[0].trim(), parts[1].trim().toLowerCase(), parts.slice(2).join('/').trim().toLowerCase());
        }
        if (parts.length === 2) {
            return searchTabs(parts[0].trim(), parts[1].trim().toLowerCase());
        }
        const query = rawQuery.trim().toLowerCase();
        // Snippets only join the list once something is typed, so the empty palette still lists this database's tables.
        const results = query === '' ? searchItems(rawQuery) : [...searchItems(rawQuery), ...searchSnippets(findTarget('').target, query)]
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_RESULTS);
        return { results, message: null };
    }

    function searchSnippets(target, query) {
        const results = [];
        snippets.forEach((snippet, position) => {
            const needs = PMA_TOOLS_SNIPPETS.needs(snippet);
            if ((needs.db && target.db === '') || (needs.table && target.table === '')) {
                return;
            }
            const label = PMA_TOOLS_SNIPPETS.label(snippet);
            const match = score(label, query);
            if (match === null) {
                return;
            }
            if (needs.pk) {
                // Fetched now, so choosing the snippet doesn't wait for it.
                getPrimaryKey(target).catch(() => {});
            }
            results.push({ type: 'snippet', ...target, snippet, label, position, score: match.score, snippetPositions: match.positions });
        });
        return results.sort((a, b) => b.score - a.score || a.position - b.position);
    }

    function getPrimaryKey(target) {
        const key = `${target.db}\u0000${target.table}`;
        if (!primaryKeyCache.has(key)) {
            const url = new URL(baseUrl);
            url.search = new URLSearchParams({ route: '/table/structure', server: params.server, db: target.db, table: target.table, ajax_request: 'true' });
            const request = pageFetch(url.href, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
                .then((response) => response.json())
                .catch(() => {
                    throw new Error('Couldn\'t load the primary key — has the session expired?');
                })
                .then((response) => {
                    if (response.success !== true) {
                        throw new Error(stripTags(response.error || response.message || 'Couldn\'t load the primary key'));
                    }
                    const page = new DOMParser().parseFromString(String(response.message ?? ''), 'text/html');
                    // The Structure tab marks each primary key column with the b_primary icon, in every language and theme.
                    return [...page.querySelectorAll('input[name="selected_fld[]"]')]
                        .filter((input) => page.querySelector(`label[for="${CSS.escape(input.id)}"] .ic_b_primary`) !== null)
                        .map((input) => input.value);
                });
            // A failed request is tried again the next time.
            request.catch(() => primaryKeyCache.delete(key));
            primaryKeyCache.set(key, request);
        }
        return primaryKeyCache.get(key);
    }

    function searchColumns(targetQuery, tabQuery, columnQuery) {
        const found = findTarget(targetQuery);
        if (found.target === null) {
            return { results: [], message: found.message };
        }
        const target = found.target;
        if (target.table === '') {
            return { results: [], message: 'Columns can only be searched on a table\'s Search tab' };
        }
        const tabs = target.current ? { status: 'done', tabs: readTabs(document) } : getTabs(target);
        if (tabs.status !== 'done') {
            return { results: [], message: tabs.status === 'loading' ? 'Loading tabs…' : tabs.error };
        }
        const searchTab = tabs.tabs.find((tab) => getRoute(tab.url) === '/table/search');
        if (searchTab === undefined || score(searchTab.label, tabQuery) === null) {
            return {
                results: [],
                message: searchTab === undefined
                    ? 'This table has no Search tab'
                    : `Columns are listed after the Search tab: ${getTargetText(target)}/${searchTab.label}/`,
            };
        }

        const columns = getColumns(target, searchTab.url);
        if (columns.status !== 'done') {
            return { results: [], message: columns.status === 'loading' ? 'Loading columns…' : columns.error };
        }
        const results = [];
        columns.columns.forEach((column, position) => {
            const match = score(column, columnQuery);
            if (match !== null) {
                results.push({
                    type: 'column',
                    ...target,
                    column,
                    tabLabel: searchTab.label,
                    url: searchTab.url,
                    position,
                    score: match.score,
                    columnPositions: match.positions,
                });
            }
        });
        results.sort((a, b) => b.score - a.score || a.position - b.position);
        return { results: results.slice(0, MAX_RESULTS), message: results.length === 0 ? 'No matching columns' : null };
    }

    function findTarget(targetQuery) {
        if (targetQuery === '') {
            return { target: { db: getCurrentDatabase(), table: getCurrentTable(), current: true }, message: null };
        }
        const target = resolveTarget(targetQuery);
        return {
            target,
            message: target !== null ? null
                : index.loading !== null ? 'Loading…' : `No database or table matches "${targetQuery}"`,
        };
    }

    function getRoute(url) {
        return new URL(url).searchParams.get('route');
    }

    function getColumns(target, searchUrl) {
        const key = `${target.db}\u0000${target.table}`;
        if (!columnCache.has(key)) {
            columnCache.set(key, { status: 'loading', columns: [], error: '' });
            const url = new URL(searchUrl);
            url.searchParams.set('ajax_request', 'true');
            pageFetch(url.href, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
                .then((response) => response.json())
                .then((response) => {
                    const page = new DOMParser().parseFromString(String(response.message ?? ''), 'text/html');
                    const columns = [...page.querySelectorAll('input[name^="criteriaColumnNames["]')].map((input) => input.value);
                    columnCache.set(key, { status: 'done', columns, error: '' });
                })
                .catch(() => {
                    columnCache.set(key, { status: 'error', columns: [], error: 'Couldn\'t load the columns — has the session expired?' });
                })
                .finally(render);
        }
        return columnCache.get(key);
    }

    function searchTabs(targetQuery, tabQuery) {
        const { target, message } = findTarget(targetQuery);
        if (target === null) {
            return { results: [], message };
        }
        const tabs = target.current ? { status: 'done', tabs: readTabs(document) } : getTabs(target);
        if (tabs.status !== 'done') {
            return { results: [], message: tabs.status === 'loading' ? 'Loading tabs…' : tabs.error };
        }

        const results = [];
        tabs.tabs.forEach((tab, position) => {
            const match = score(tab.label, tabQuery);
            if (match !== null) {
                results.push({ type: 'tab', ...target, ...tab, position, score: match.score, tabPositions: match.positions });
            }
        });
        results.sort((a, b) => b.score - a.score || a.position - b.position);
        // Sorting is stable, so on an equal score the tabs stay ahead of the snippets.
        results.push(...searchSnippets(target, tabQuery));
        results.sort((a, b) => b.score - a.score);
        return { results, message: results.length === 0 ? `No matching tabs${snippets.length === 0 ? '' : ' or snippets'}` : null };
    }

    function resolveTarget(targetQuery) {
        const query = targetQuery.toLowerCase();
        if (query === '') {
            return null;
        }
        const separator = query.indexOf('.');
        if (separator === -1) {
            const database = index.databases.find((name) => name.toLowerCase() === query)
                ?? searchItems(query).find((result) => result.type === 'db')?.db;
            return database === undefined ? null : { db: database, table: '' };
        }
        const exact = index.tables.find((entry) => entry.db.toLowerCase() === query.slice(0, separator)
            && entry.table.toLowerCase() === query.slice(separator + 1));
        const entry = exact ?? searchItems(query).find((result) => result.type === 'table');
        return entry === undefined ? null : { db: entry.db, table: entry.table };
    }

    function getTabs(target) {
        const key = `${target.db}\u0000${target.table}`;
        if (!tabCache.has(key)) {
            tabCache.set(key, { status: 'loading', tabs: [], error: '' });
            // Every phpMyAdmin AJAX response carries the tab bar of the db and table it was asked about.
            post('/tables', target.table === '' ? { db: target.db } : { db: target.db, table: target.table })
                .then((response) => {
                    tabCache.set(key, { status: 'done', tabs: parseTabs(response.menu), error: '' });
                })
                .catch((error) => {
                    tabCache.set(key, { status: 'error', tabs: [], error: error.message });
                })
                .finally(render);
        }
        return tabCache.get(key);
    }

    function parseTabs(menuHtml) {
        return readTabs(new DOMParser().parseFromString(String(menuHtml ?? ''), 'text/html'));
    }

    function readTabs(root) {
        return [...root.querySelectorAll(TAB_LINK_SELECTOR)].map((link) => {
            const text = link.cloneNode(true);
            text.querySelectorAll('.visually-hidden, .sr-only').forEach((element) => element.remove());
            return {
                label: text.textContent.replace(/\s+/g, ' ').trim(),
                url: new URL(link.getAttribute('href'), baseUrl).href,
            };
        });
    }

    function getTargetText(result) {
        if (result.db === '') {
            return 'server';
        }
        return (result.table ?? '') === '' ? result.db : `${result.db}.${result.table}`;
    }

    function searchItems(rawQuery) {
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
        if (result.type === 'tab') {
            return result.url;
        }
        if (result.type === 'column') {
            return `${result.url}#pma-tools-column=${encodeURIComponent(result.column)}`;
        }
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

    // The alternate action (Alt+Enter) opens a table's structure, or runs a snippet instead of filling the SQL tab.
    function go(result, { alternate = false, newTab = false } = {}) {
        if (result.type === 'snippet') {
            openSnippet(result, { run: alternate, newTab });
            return;
        }
        const url = urlFor(result, alternate);
        closePalette();
        if (newTab) {
            window.open(url, '_blank', 'noopener');
        } else {
            location.href = url;
        }
    }

    async function openSnippet(result, { run, newTab }) {
        const opened = palette;
        let pk = [];
        if (PMA_TOOLS_SNIPPETS.needs(result.snippet).pk) {
            try {
                pk = await getPrimaryKey(result);
            } catch (error) {
                showNotice(error.message);
                return;
            }
            if (pk.length === 0) {
                showNotice(`${getTargetText(result)} has no primary key`);
                return;
            }
        }
        if (palette !== opened) {
            return;
        }
        // Running skips the SQL tab where the user would see the query, so a name that could change it is refused.
        if (run) {
            const unsafe = getNamesToFill(result.snippet, { db: result.db, table: result.table, pk }).find((name) => !isPlainIdentifier(name));
            if (unsafe !== undefined) {
                showNotice(`Not run: the name "${unsafe}" could change the query. Press Enter to check it in the SQL tab first.`);
                return;
            }
        }
        const target = result.db === '' ? {} : result.table === '' ? { db: result.db } : { db: result.db, table: result.table };
        // SQL tabs only take a query by POST: phpMyAdmin ignores an unsigned sql_query in the url.
        const route = run ? '/sql' : result.table !== '' ? '/table/sql' : result.db !== '' ? '/database/sql' : '/server/sql';
        const action = `${baseUrl}?${new URLSearchParams({ route, server: params.server, ...target })}`;
        closePalette();
        submitForm(action, {
            server: params.server,
            ...target,
            token: getToken(),
            sql_query: PMA_TOOLS_SNIPPETS.fill(result.snippet, { db: result.db, table: result.table, pk }),
        }, newTab);
    }

    // Only the names the query actually contains: {table} alone never puts the database name in it.
    function getNamesToFill(snippet, { db, table, pk }) {
        const used = PMA_TOOLS_SNIPPETS.placeholders(snippet);
        return [...(used.has('db') ? [db] : []), ...(used.has('table') ? [table] : []), ...(used.has('pk') ? pk : [])];
    }

    // Letters, digits, _, $ and single dashes (my-db): nothing that ends a quote, starts a comment or adds a statement.
    function isPlainIdentifier(name) {
        return /^[\p{L}\p{N}_$-]+$/u.test(name) && !name.includes('--');
    }

    function submitForm(action, fields, newTab) {
        const form = document.createElement('form');
        form.method = 'post';
        form.action = action;
        form.hidden = true;
        if (newTab) {
            form.target = '_blank';
            form.rel = 'noopener';
        }
        for (const [name, value] of Object.entries(fields)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = value;
            form.append(input);
        }
        document.body.append(form);
        form.submit();
        form.remove();
    }

    function showNotice(message) {
        if (palette !== null) {
            palette.notice = message;
            render();
        }
    }

    function openPalette() {
        const host = document.createElement('div');
        host.id = 'pma-tools-palette';
        PMA_TOOLS_PREFERENCES.applyTheme(host, theme);
        const root = host.attachShadow({ mode: 'closed' });

        // Keep keystrokes away from phpMyAdmin's single-key shortcuts on document.
        for (const type of ['keydown', 'keyup', 'keypress']) {
            host.addEventListener(type, (event) => event.stopPropagation());
        }

        const style = document.createElement('style');
        style.textContent = PMA_TOOLS_PALETTE_CSS;
        root.innerHTML = `
            <div class="backdrop">
                <div class="dialog" role="dialog" aria-modal="true" aria-label="Jump to database or table">
                    <div class="search">
                        <input type="text" placeholder="Jump to table, database or snippet… (db.table to narrow, / for tabs)"
                               role="combobox" aria-expanded="true" aria-controls="pma-tools-results"
                               aria-autocomplete="list" autocomplete="off" spellcheck="false">
                        <button type="button" class="status" hidden></button>
                    </div>
                    <ul class="results" id="pma-tools-results" role="listbox"></ul>
                    <div class="footer">
                        <span><kbd>↵</kbd> <span data-hint="open">browse</span></span>
                        <span><kbd data-key="structure"></kbd> <span data-hint="alternate">structure</span></span>
                        <span><kbd data-key="new-tab"></kbd> new tab</span>
                        <span><kbd>⇥</kbd> complete</span>
                        <span><kbd>/</kbd> tabs</span>
                        <span><kbd>esc</kbd> close</span>
                    </div>
                </div>
            </div>`;
        root.prepend(style);
        root.querySelector('[data-key="structure"]').textContent = `${isMac ? '⌥' : 'Alt'}↵`;
        root.querySelector('[data-key="new-tab"]').textContent = `${isMac ? '⌘' : 'Ctrl'}↵`;

        const input = root.querySelector('input');
        const status = root.querySelector('.status');
        status.style.cssText = 'border:0;background:none;cursor:pointer;font:inherit;';

        palette = {
            host,
            input,
            list: root.querySelector('.results'),
            footer: root.querySelector('.footer'),
            status,
            results: [],
            selected: 0,
            notice: null,
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
            palette.notice = null;
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
                palette.input.value = getCompletion(result, palette.input.value);
                palette.selected = 0;
                render();
            }
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const result = palette.results[palette.selected];
            if (result !== undefined) {
                go(result, {
                    alternate: event.altKey,
                    newTab: isMac ? event.metaKey : event.ctrlKey,
                });
            }
        }
    }

    function getCompletion(result, currentValue) {
        const prefix = result.current ? '' : getTargetText(result);
        if (result.type === 'snippet') {
            return `${prefix}/${result.label}`;
        }
        if (result.type === 'column') {
            return `${prefix}/${result.tabLabel}/${result.column}`;
        }
        if (result.type === 'tab') {
            // A second Tab on the Search tab moves on to its columns.
            const completion = `${prefix}/${result.label}`;
            return currentValue === completion && getRoute(result.url) === '/table/search' ? `${completion}/` : completion;
        }
        // A database completes to "db." so the table can be typed after it; a second Tab opens the tab list.
        const completion = result.type === 'table' ? `${result.db}.${result.table}` : `${result.db}.`;
        return currentValue === completion ? `${getTargetText(result)}/` : completion;
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
        const { results, message } = search(palette.input.value);
        palette.results = results;
        palette.selected = Math.min(palette.selected, Math.max(palette.results.length - 1, 0));

        const currentDatabase = getCurrentDatabase();
        const items = palette.results.map((result, i) => {
            const item = document.createElement('li');
            item.className = 'item';
            item.id = `pma-tools-result-${i}`;
            item.setAttribute('role', 'option');

            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = { db: 'db', table: 'tbl', tab: 'tab', column: 'col', snippet: 'sql' }[result.type];

            const label = document.createElement('span');
            label.className = 'label';
            if (result.type === 'column') {
                const prefix = document.createElement('span');
                prefix.className = 'db';
                prefix.textContent = `${getTargetText(result)} / ${result.tabLabel} / `;
                label.append(prefix, highlight(result.column, result.columnPositions));
            } else if (result.type === 'snippet') {
                const target = document.createElement('span');
                target.className = 'db';
                target.textContent = `${getTargetText(result)} / `;
                label.append(target, highlight(result.label, result.snippetPositions));
                item.title = result.snippet.sql;
            } else if (result.type === 'tab') {
                const target = document.createElement('span');
                target.className = 'db';
                target.textContent = `${getTargetText(result)} / `;
                label.append(target, highlight(result.label, result.tabPositions));
            } else if (result.type === 'table') {
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
                    alternate: event.altKey,
                    newTab: isMac ? event.metaKey : event.ctrlKey,
                });
            });
            return item;
        });

        if (palette.notice !== null) {
            const notice = document.createElement('li');
            notice.className = 'empty';
            notice.setAttribute('role', 'alert');
            notice.textContent = palette.notice;
            items.unshift(notice);
        } else if (items.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'empty';
            empty.textContent = message ?? (index.error !== ''
                ? index.error
                : index.loading !== null ? 'Loading…' : 'No matching databases or tables');
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
        const isSnippet = palette.results[palette.selected]?.type === 'snippet';
        palette.footer.querySelector('[data-hint="open"]').textContent = isSnippet ? 'fill SQL tab' : 'browse';
        palette.footer.querySelector('[data-hint="alternate"]').textContent = isSnippet ? 'run' : 'structure';
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

    console.debug('[phpMyAdmin Tools] loaded; shortcuts are set on the extension\'s options page.');
})();
