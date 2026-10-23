// Loaded by both content.js and options.html. A preference is one of a fixed set of values, or a list of names.
var PMA_TOOLS_PREFERENCES = (() => {
    const extensionApi = globalThis.browser ?? globalThis.chrome;

    const DEFINITIONS = {
        theme: { values: ['system', 'light', 'dark'], fallback: 'system' },
        searchOperator: { values: ['LIKE %...%', 'LIKE'], fallback: 'LIKE %...%' },
        // MySQL base types, without a length: varchar covers varchar(255).
        likeColumnTypes: { list: true, fallback: ['char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext'] },
    };

    function normalize(key, value) {
        const definition = DEFINITIONS[key];
        if (definition.list) {
            return Array.isArray(value) ? [...new Set(value.map(normalizeName).filter((name) => name !== null))] : definition.fallback;
        }
        return definition.values.includes(value) ? value : definition.fallback;
    }

    function normalizeName(name) {
        const normalized = String(name).trim().toLowerCase();
        return /^[a-z][a-z0-9_]*$/.test(normalized) ? normalized : null;
    }

    // The type as phpMyAdmin writes it, lowercased, with its length and attributes: "int(11) unsigned" → "int".
    function baseColumnType(type) {
        return String(type).trim().toLowerCase().match(/^[a-z][a-z0-9_]*/)?.[0] ?? '';
    }

    async function load(key) {
        try {
            const stored = await extensionApi.storage.sync.get(key);
            return normalize(key, stored[key]);
        } catch {
            return DEFINITIONS[key].fallback;
        }
    }

    function save(key, value) {
        return extensionApi.storage.sync.set({ [key]: normalize(key, value) });
    }

    function reset(key) {
        return extensionApi.storage.sync.remove(key);
    }

    function onChange(key, callback) {
        extensionApi.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && key in changes) {
                callback(normalize(key, changes[key].newValue));
            }
        });
    }

    // "system" leaves the choice to prefers-color-scheme; the stylesheets only react to an explicit data-theme.
    function applyTheme(element, theme) {
        if (theme === 'system') {
            element.removeAttribute('data-theme');
        } else {
            element.setAttribute('data-theme', theme);
        }
    }

    return { DEFINITIONS, load, save, reset, onChange, normalizeName, baseColumnType, applyTheme };
})();
