<div align="center">
  <img src="icons/icon128.png" width="96" alt="GitHub Tab De-duper icon">
  <h1>GitHub Tab De-duper</h1>
  <p><strong>One tab per pull request. No more duplicates.</strong></p>
  <p>
    A Chrome extension that stops GitHub tabs from piling up: opening a pull
    request, issue, or discussion you already have open focuses your existing
    tab instead of creating another one.
  </p>
</div>

<!-- TODO: drop a screenshot of the panel at docs/screenshot.png -->
<img width="338" height="584" alt="image" src="https://github.com/user-attachments/assets/5b5b87c5-f37a-4bd6-8418-6b376a3d14bf" />

Built for workflows where GitHub links keep arriving from outside the
browser — coding agents, terminals, Slack — and every click is another tab.

## Features

- **Automatic de-dupe** — a new tab that duplicates an open PR, issue, or
  discussion closes itself, and you land on the tab you already had.
- **De-dupe open tabs now** — one button to clean up duplicates you've
  already accumulated. Keeps the best tab per thread (active, then most
  recently used) and closes the rest.
- **Comment links still work** — a link to a specific comment
  (`#issuecomment-…`, `#discussion_r…`) jumps straight to it in your
  existing tab.
- **Lifetime counter** — "Saved you from N duplicate tabs," persisted from
  install.

## Why a generic duplicate-tab blocker doesn't cut it

These are all the same pull request, and exact-URL matching treats them as
five different pages:

```
github.com/owner/repo/pull/123
github.com/owner/repo/pull/123/files
github.com/owner/repo/pull/123#issuecomment-98765
github.com/owner/repo/pull/123/files#r456789
github.com/owner/repo/pull/123?notification_referrer_id=...
```

This extension canonicalizes GitHub URLs before comparing:

- Query strings and fragments are ignored for identity.
- A PR's Conversation, Files changed, Commits, and Checks views count as one
  tab (configurable).
- `/issues/N` and `/pull/N` match each other — they share one number space
  per repo, and GitHub redirects between them.

Only *newly created* tabs are deduplicated automatically. Navigating an
existing tab you're already using never closes anything out from under you.

## Install

**Chrome Web Store** — coming soon.

**From source:**

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. **Load unpacked** → select the repo directory

## Settings

Everything lives in one panel — click the toolbar icon:

- **Automatically de-dupe new tabs** — the always-on behavior; on by default.
- **Jump to linked comment** — navigate the existing tab to the linked
  comment, or just focus it and stay put.
- **One tab per pull request** — treat PR sub-pages as one tab, or
  deduplicate each view separately.

## Permissions

- `storage` — saves your settings (synced) and the saved-tabs counter.
- Host access to `https://github.com/*` — lets the extension see which
  GitHub tabs are open and their URLs. It cannot read tabs on any other
  site, injects no content scripts anywhere, and sends nothing over the
  network.

## Development

No dependencies, no build step. Node 22+ for the dev scripts.

```sh
npm test           # unit tests for URL canonicalization and dedupe logic
npm run icons      # regenerate icons/*.png
npm run package    # build dist/github-tab-deduper.zip for the Web Store
```

Layout:

- `background.js` — service worker: watches tab creation, deduplicates.
- `lib/github.js` — pure URL canonicalization and dedupe logic (the tested
  core).
- `panel/` — the popup panel, also used as the options page.
- `scripts/` — icon generator and Web Store packager (pure Node).

---

<div align="center">
  Built by <a href="https://cline.bot">Cline</a>
</div>
