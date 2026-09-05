// URL canonicalization for GitHub "thread" pages: pull requests, issues,
// and discussions — the pages that accumulate duplicate tabs.

export const DEFAULT_SETTINGS = Object.freeze({
  // Master switch for the whole extension.
  enabled: true,
  // When a link targets a specific comment (#issuecomment-…, #discussion_r…),
  // navigate the existing tab there so it scrolls to the comment.
  jumpToFragment: true,
  // Treat a PR's Conversation / Files changed / Commits / Checks views as the
  // same tab. When off, each view deduplicates independently.
  collapseSubviews: true,
});

const THREAD_TYPES = new Set(['pull', 'issues', 'discussions']);
const PR_SUBVIEWS = new Set(['files', 'commits', 'checks']);

/**
 * Parse a URL into a GitHub thread reference, or null if it isn't one.
 *
 * Issues and pull requests share one number space per repo (and GitHub
 * redirects /issues/N to /pull/N when N is a PR), so both canonicalize to the
 * same key. Discussions are numbered independently and keep their own key.
 *
 * @param {string} rawUrl
 * @returns {{key: string, subview: string, hash: string, href: string} | null}
 */
export function parseThreadUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.hostname.replace(/^www\./, '') !== 'github.com') return null;

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 4) return null;
  const [owner, repo, type, number, maybeSubview] = segments;
  if (!THREAD_TYPES.has(type)) return null;
  if (!/^\d+$/.test(number)) return null;

  const kind = type === 'discussions' ? 'discussions' : 'thread';
  const subview =
    type === 'pull' && PR_SUBVIEWS.has(maybeSubview) ? maybeSubview : '';

  return {
    key: `${owner.toLowerCase()}/${repo.toLowerCase()}/${kind}/${number}`,
    subview,
    hash: url.hash,
    href: url.href,
  };
}

/**
 * The identity used to decide whether two tabs are "the same page".
 *
 * @param {{key: string, subview: string}} parsed
 * @param {boolean} collapseSubviews
 * @returns {string}
 */
export function canonicalKey(parsed, collapseSubviews) {
  if (collapseSubviews || !parsed.subview) return parsed.key;
  return `${parsed.key}/${parsed.subview}`;
}

/**
 * Given already-open tabs, pick the duplicates to close: for each group of
 * tabs showing the same thread, every tab except the best one to keep —
 * preferring the active tab, then the most recently accessed.
 *
 * @param {Array<{id?: number, url?: string, active?: boolean, lastAccessed?: number}>} tabs
 * @param {boolean} collapseSubviews
 * @returns {number[]} tab ids to close
 */
export function duplicateTabIds(tabs, collapseSubviews) {
  const groups = new Map();
  for (const tab of tabs) {
    if (tab.id === undefined || !tab.url) continue;
    const parsed = parseThreadUrl(tab.url);
    if (!parsed) continue;
    const key = canonicalKey(parsed, collapseSubviews);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tab);
  }

  const ids = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keep = group.reduce((best, tab) => {
      if (Boolean(tab.active) !== Boolean(best.active)) {
        return tab.active ? tab : best;
      }
      return (tab.lastAccessed ?? 0) > (best.lastAccessed ?? 0) ? tab : best;
    });
    for (const tab of group) {
      if (tab.id !== keep.id) ids.push(tab.id);
    }
  }
  return ids;
}
