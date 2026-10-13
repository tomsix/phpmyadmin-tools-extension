const extensionApi = globalThis.browser ?? globalThis.chrome;

// Content scripts can't open the options page themselves.
extensionApi.runtime.onMessage.addListener((message) => {
    if (message?.type === 'open-options') {
        extensionApi.runtime.openOptionsPage();
    }
});
