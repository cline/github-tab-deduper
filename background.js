import {
  DEFAULT_SETTINGS,
  parseThreadUrl,
  canonicalKey,
} from './lib/github.js';

// Tabs created without a destination URL (about:blank, the new-tab page).
// Their first real navigation is still "opening a link in a new tab", so we
// deduplicate it; anything after that is the user browsing within the tab.
const freshTabs = new Set();

let cachedSettings = null;

async function getSettings() {
  if (!cachedSettings) {
    cachedSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  }
  return cachedSettings;
}

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'sync') cachedSettings = null;
});

function isBlank(url) {
  return (
    !url ||
    url === 'about:blank' ||
    url.startsWith('chrome://newtab') ||
    url.startsWith('chrome://new-tab-page')
  );
}

chrome.tabs.onCreated.addListener((tab) => {
  const url = tab.pendingUrl || tab.url;
  if (isBlank(url)) {
    freshTabs.add(tab.id);
    return;
  }
  void dedupe(tab, url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url || !freshTabs.has(tabId)) return;
  freshTabs.delete(tabId);
  void dedupe(tab, changeInfo.url);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  freshTabs.delete(tabId);
});

/**
 * If `url` is a GitHub thread that is already open in another tab, focus that
 * tab (navigating it when the link targets a specific comment) and close the
 * newly created duplicate.
 */
async function dedupe(newTab, url) {
  try {
    const settings = await getSettings();
    if (!settings.enabled) return;

    const incoming = parseThreadUrl(url);
    if (!incoming) return;
    const incomingKey = canonicalKey(incoming, settings.collapseSubviews);

    const githubTabs = await chrome.tabs.query({ url: 'https://github.com/*' });
    const existing = githubTabs
      .filter((tab) => {
        if (tab.id === newTab.id || !tab.url) return false;
        const parsed = parseThreadUrl(tab.url);
        return (
          parsed !== null &&
          canonicalKey(parsed, settings.collapseSubviews) === incomingKey
        );
      })
      .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
    if (!existing) return;

    // A fragment means the link points at a specific comment or review
    // thread; navigate the existing tab so the browser scrolls to it. A bare
    // thread link just focuses the tab without disturbing the user's place.
    const shouldNavigate =
      settings.jumpToFragment &&
      incoming.hash !== '' &&
      existing.url !== incoming.href;

    await chrome.tabs.update(existing.id, {
      active: true,
      ...(shouldNavigate ? { url: incoming.href } : {}),
    });
    if (existing.windowId !== undefined) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
    try {
      await chrome.tabs.remove(newTab.id);
    } catch {
      // The duplicate tab is already gone; nothing to clean up.
    }

    const { tabsDeduped = 0 } = await chrome.storage.local.get('tabsDeduped');
    await chrome.storage.local.set({ tabsDeduped: tabsDeduped + 1 });
  } catch (error) {
    console.error('One Tab for GitHub: dedupe failed', error);
  }
}
