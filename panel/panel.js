import { DEFAULT_SETTINGS, duplicateTabIds } from '../lib/github.js';

const statsEl = document.getElementById('stats');
const dedupeButton = document.getElementById('dedupe-now');
const dedupeStatus = document.getElementById('dedupe-status');

async function refreshStats() {
  const { tabsDeduped = 0 } = await chrome.storage.local.get('tabsDeduped');
  if (tabsDeduped === 0) {
    statsEl.textContent = 'Watching for duplicate tabs';
    return;
  }
  const count = document.createElement('span');
  count.className = 'stat-count';
  count.textContent = tabsDeduped.toLocaleString();
  statsEl.replaceChildren(
    'Saved you from ',
    count,
    ` duplicate ${tabsDeduped === 1 ? 'tab' : 'tabs'}`,
  );
}

async function dedupeNow() {
  dedupeButton.disabled = true;
  try {
    const { collapseSubviews } =
      await chrome.storage.sync.get(DEFAULT_SETTINGS);
    const tabs = await chrome.tabs.query({ url: 'https://github.com/*' });
    const ids = duplicateTabIds(tabs, collapseSubviews);

    await Promise.all(
      ids.map((id) => chrome.tabs.remove(id).catch(() => {})),
    );
    if (ids.length > 0) {
      const { tabsDeduped = 0 } =
        await chrome.storage.local.get('tabsDeduped');
      await chrome.storage.local.set({ tabsDeduped: tabsDeduped + ids.length });
      await refreshStats();
    }

    dedupeStatus.textContent =
      ids.length === 0
        ? 'No duplicates found ✨'
        : `Closed ${ids.length} duplicate ${ids.length === 1 ? 'tab' : 'tabs'}`;
  } finally {
    dedupeButton.disabled = false;
  }
}

dedupeButton.addEventListener('click', () => void dedupeNow());

async function init() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const input = document.getElementById(key);
    input.checked = settings[key];
    input.addEventListener('change', () => {
      chrome.storage.sync.set({ [key]: input.checked });
    });
  }
  await refreshStats();
}

void init();
