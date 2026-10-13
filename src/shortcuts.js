// Loaded by both content.js and options.html; shortcuts are matched on the key's position (event.code),
// so the same binding works on QWERTY and AZERTY.
var PMA_TOOLS_SHORTCUTS = (() => {
    const extensionApi = globalThis.browser ?? globalThis.chrome;
    const isMac = /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform ?? navigator.platform);
    const STORAGE_KEY = 'shortcuts';
    const MODIFIER_KEYS = ['Alt', 'AltGraph', 'CapsLock', 'Control', 'Meta', 'Shift', 'Fn'];

    const ACTIONS = [
        { id: 'openPalette', label: 'Open the quick jump palette' },
        { id: 'previousTab', label: 'Go to the previous tab' },
        { id: 'nextTab', label: 'Go to the next tab' },
    ];

    const binding = (code, modifiers = {}) => ({ code, alt: false, ctrl: false, meta: false, shift: false, ...modifiers });

    // Alt+←/→ is browser back/forward on Windows and Linux, hence the extra Shift there.
    const DEFAULTS = {
        openPalette: [isMac ? binding('KeyK', { meta: true }) : binding('KeyK', { alt: true })],
        previousTab: [binding('ArrowLeft', { alt: true, shift: !isMac })],
        nextTab: [binding('ArrowRight', { alt: true, shift: !isMac })],
    };

    const CODE_LABELS = {
        ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
        BracketLeft: '[', BracketRight: ']', Backslash: '\\', Backquote: '`', Quote: "'",
        Semicolon: ';', Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '=',
        Space: 'Space', Enter: '↵', Tab: '⇥', Backspace: '⌫', Delete: 'Del',
        PageUp: 'PgUp', PageDown: 'PgDn', Home: 'Home', End: 'End', IntlBackslash: '<',
    };

    function fromEvent(event) {
        if (MODIFIER_KEYS.includes(event.key) || event.code === '') {
            return null;
        }
        const recorded = binding(event.code, {
            alt: event.altKey,
            ctrl: event.ctrlKey,
            meta: event.metaKey,
            shift: event.shiftKey,
        });
        // The typed character names the key on the user's own layout (^ or $ on AZERTY); a dead key types none.
        if (event.key.length === 1 && event.key !== ' ' && !event.altKey) {
            recorded.key = event.key.toUpperCase();
        }
        return recorded;
    }

    function matches(shortcut, event) {
        return shortcut.code === event.code
            && shortcut.alt === event.altKey
            && shortcut.ctrl === event.ctrlKey
            && shortcut.meta === event.metaKey
            && shortcut.shift === event.shiftKey;
    }

    function isSame(a, b) {
        return a.code === b.code && a.alt === b.alt && a.ctrl === b.ctrl && a.meta === b.meta && a.shift === b.shift;
    }

    function hasModifier(shortcut) {
        return shortcut.alt || shortcut.ctrl || shortcut.meta;
    }

    function format(shortcut, layoutMap = null) {
        const key = shortcut.key
            ?? layoutMap?.get(shortcut.code)?.toUpperCase()
            ?? CODE_LABELS[shortcut.code]
            ?? shortcut.code.replace(/^(Key|Digit|Numpad)/, '');
        const modifiers = isMac
            ? [shortcut.ctrl && '⌃', shortcut.alt && '⌥', shortcut.shift && '⇧', shortcut.meta && '⌘']
            : [shortcut.ctrl && 'Ctrl', shortcut.alt && 'Alt', shortcut.shift && 'Shift', shortcut.meta && 'Meta'];
        return [...modifiers.filter(Boolean), key].join(isMac ? '' : '+');
    }

    function normalize(stored) {
        const shortcuts = {};
        for (const action of ACTIONS) {
            const list = stored?.[action.id];
            shortcuts[action.id] = Array.isArray(list)
                ? list.filter((item) => typeof item?.code === 'string').map((item) => ({ ...binding(item.code), ...item }))
                : DEFAULTS[action.id];
        }
        return shortcuts;
    }

    async function load() {
        try {
            const stored = await extensionApi.storage.sync.get(STORAGE_KEY);
            return normalize(stored[STORAGE_KEY]);
        } catch {
            return normalize(null);
        }
    }

    function save(shortcuts) {
        return extensionApi.storage.sync.set({ [STORAGE_KEY]: shortcuts });
    }

    function reset() {
        return extensionApi.storage.sync.remove(STORAGE_KEY);
    }

    function onChange(callback) {
        extensionApi.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && STORAGE_KEY in changes) {
                callback(normalize(changes[STORAGE_KEY].newValue));
            }
        });
    }

    return { ACTIONS, DEFAULTS, isMac, fromEvent, matches, isSame, hasModifier, format, normalize, load, save, reset, onChange };
})();
