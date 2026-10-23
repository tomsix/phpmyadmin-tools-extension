// Loaded by both content.js and options.html. A snippet is a query with an optional name and {db}, {table} and {pk} placeholders.
var PMA_TOOLS_SNIPPETS = (() => {
    const extensionApi = globalThis.browser ?? globalThis.chrome;
    const STORAGE_KEY = 'snippets';
    const PLACEHOLDER_PATTERN = /\{(db|table|pk)\}/g;
    // Letters, digits, spaces, - and _: a / would split the palette's query, other symbols only get in the way of typing it.
    const NAME_PATTERN = /^[\p{L}\p{N} _-]*$/u;

    function normalize(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        const ids = new Set();
        return value.flatMap((snippet) => {
            const sql = typeof snippet?.sql === 'string' ? snippet.sql.trim() : '';
            if (sql === '') {
                return [];
            }
            let id = typeof snippet.id === 'string' && snippet.id !== '' ? snippet.id : createId();
            if (ids.has(id)) {
                id = createId();
            }
            ids.add(id);
            return [{ id, name: cleanName(snippet.name), sql }];
        });
    }

    // randomUUID() only exists in secure contexts, and phpMyAdmin often runs on plain http.
    function isValidName(name) {
        return NAME_PATTERN.test(name.trim());
    }

    // Stored names are cleaned too, so one synced from elsewhere can't bring a / into the palette.
    function cleanName(name) {
        return typeof name === 'string' ? name.replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim() : '';
    }

    function createId() {
        return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }

    // The name, or the query's first line when the snippet has none.
    function label(snippet) {
        return snippet.name !== '' ? snippet.name : snippet.sql.split('\n')[0].replace(/\s+/g, ' ').trim();
    }

    function placeholders(snippet) {
        return new Set([...snippet.sql.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]));
    }

    // What the page has to name for every placeholder to be filled: {pk} is a table's, so it needs the table too.
    function needs(snippet) {
        const used = placeholders(snippet);
        return { db: used.size !== 0, table: used.has('table') || used.has('pk'), pk: used.has('pk') };
    }

    // Names are inserted as they are, so the snippet decides on backticks or quotes; a composite key becomes "a, b".
    function fill(snippet, { db = '', table = '', pk = [] }) {
        const values = { db, table, pk: pk.join(', ') };
        return snippet.sql.replace(PLACEHOLDER_PATTERN, (_, name) => values[name]);
    }

    async function load() {
        try {
            const stored = await extensionApi.storage.sync.get(STORAGE_KEY);
            return normalize(stored[STORAGE_KEY]);
        } catch {
            return [];
        }
    }

    function save(snippets) {
        return extensionApi.storage.sync.set({ [STORAGE_KEY]: normalize(snippets) });
    }

    function onChange(callback) {
        extensionApi.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && STORAGE_KEY in changes) {
                callback(normalize(changes[STORAGE_KEY].newValue));
            }
        });
    }

    return { normalize, isValidName, createId, label, placeholders, needs, fill, load, save, onChange };
})();
