// Loaded by both content.js and options.html. Every preference is one of a fixed list of values.
var PMA_TOOLS_PREFERENCES = (() => {
    const extensionApi = globalThis.browser ?? globalThis.chrome;

    const DEFINITIONS = {
        theme: { values: ['system', 'light', 'dark'], fallback: 'system' },
        searchOperator: { values: ['LIKE %...%', 'LIKE'], fallback: 'LIKE %...%' },
    };

    function normalize(key, value) {
        const definition = DEFINITIONS[key];
        return definition.values.includes(value) ? value : definition.fallback;
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

    return { DEFINITIONS, load, save, onChange, applyTheme };
})();
