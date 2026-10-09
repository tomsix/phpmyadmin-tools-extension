// Loaded before content.js; both share the content-script scope.
var PMA_TOOLS_PALETTE_CSS = `
:host {
    --bg: #ffffff;
    --fg: #1f2328;
    --muted: #656d76;
    --border: #d0d7de;
    --hover: #f3f4f6;
    --active: #e7f0ff;
    --accent: #0b5cd5;
    --backdrop: rgb(15 23 42 / 0.35);
    --shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 12px 40px rgb(0 0 0 / 0.18);
    all: initial;
}

@media (prefers-color-scheme: dark) {
    :host {
        --bg: #1c2128;
        --fg: #e6edf3;
        --muted: #8d96a0;
        --border: #373e47;
        --hover: #262c36;
        --active: #1f3a5f;
        --accent: #6cb6ff;
        --backdrop: rgb(0 0 0 / 0.5);
        --shadow: 0 12px 40px rgb(0 0 0 / 0.5);
    }
}

.backdrop {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 12vh 16px 16px;
    background: var(--backdrop);
    font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: var(--fg);
}

.dialog {
    width: min(640px, 100%);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    overflow: hidden;
}

.search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    border-bottom: 1px solid var(--border);
}

.search input {
    flex: 1;
    min-width: 0;
    padding: 14px 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--fg);
    font: inherit;
    font-size: 16px;
}

.status {
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
}

.results {
    margin: 0;
    padding: 6px;
    list-style: none;
    overflow-y: auto;
}

.item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border-radius: 6px;
    cursor: pointer;
}

.item:hover {
    background: var(--hover);
}

.item[aria-selected="true"] {
    background: var(--active);
}

.badge {
    flex: none;
    width: 34px;
    padding: 1px 0;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 600;
    text-align: center;
    text-transform: uppercase;
}

.label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.label .db {
    color: var(--muted);
}

.label mark {
    background: none;
    color: var(--accent);
    font-weight: 600;
}

.current {
    flex: none;
    color: var(--muted);
    font-size: 11px;
}

.empty {
    padding: 18px 10px;
    color: var(--muted);
    text-align: center;
}

.footer {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    padding: 8px 14px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 11px;
}

kbd {
    padding: 0 4px;
    border: 1px solid var(--border);
    border-radius: 3px;
    font: inherit;
}
`;
