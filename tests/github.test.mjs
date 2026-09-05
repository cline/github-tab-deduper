import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseThreadUrl,
  canonicalKey,
  duplicateTabIds,
  DEFAULT_SETTINGS,
} from '../lib/github.js';

test('parses a pull request URL', () => {
  const parsed = parseThreadUrl('https://github.com/cline/cline/pull/1234');
  assert.deepEqual(parsed, {
    key: 'cline/cline/thread/1234',
    subview: '',
    hash: '',
    href: 'https://github.com/cline/cline/pull/1234',
  });
});

test('issues and pull requests share a key (same number space)', () => {
  const issue = parseThreadUrl('https://github.com/o/r/issues/42');
  const pull = parseThreadUrl('https://github.com/o/r/pull/42');
  assert.equal(issue.key, pull.key);
});

test('discussions get their own key', () => {
  const discussion = parseThreadUrl('https://github.com/o/r/discussions/42');
  const issue = parseThreadUrl('https://github.com/o/r/issues/42');
  assert.notEqual(discussion.key, issue.key);
});

test('owner and repo are case-insensitive', () => {
  const a = parseThreadUrl('https://github.com/Cline/Cline/pull/7');
  const b = parseThreadUrl('https://github.com/cline/cline/pull/7');
  assert.equal(a.key, b.key);
});

test('captures PR subviews, including nested paths', () => {
  assert.equal(parseThreadUrl('https://github.com/o/r/pull/1/files').subview, 'files');
  assert.equal(parseThreadUrl('https://github.com/o/r/pull/1/commits/abc123').subview, 'commits');
  assert.equal(parseThreadUrl('https://github.com/o/r/pull/1/checks').subview, 'checks');
  assert.equal(parseThreadUrl('https://github.com/o/r/pull/1').subview, '');
});

test('ignores unknown subviews and subviews on issues', () => {
  assert.equal(parseThreadUrl('https://github.com/o/r/pull/1/bogus').subview, '');
  assert.equal(parseThreadUrl('https://github.com/o/r/issues/1/files').subview, '');
});

test('keeps the fragment and full href', () => {
  const parsed = parseThreadUrl(
    'https://github.com/o/r/pull/9/files#r123456789',
  );
  assert.equal(parsed.hash, '#r123456789');
  assert.equal(parsed.href, 'https://github.com/o/r/pull/9/files#r123456789');
});

test('query strings do not affect the key', () => {
  const a = parseThreadUrl('https://github.com/o/r/pull/5?notification_referrer_id=xyz');
  const b = parseThreadUrl('https://github.com/o/r/pull/5');
  assert.equal(a.key, b.key);
});

test('accepts www and http variants', () => {
  assert.ok(parseThreadUrl('https://www.github.com/o/r/pull/1'));
  assert.ok(parseThreadUrl('http://github.com/o/r/pull/1'));
});

test('rejects non-thread and non-GitHub URLs', () => {
  assert.equal(parseThreadUrl('https://github.com/o/r'), null);
  assert.equal(parseThreadUrl('https://github.com/o/r/pulls'), null);
  assert.equal(parseThreadUrl('https://github.com/o/r/pull/abc'), null);
  assert.equal(parseThreadUrl('https://github.com/o/r/commit/abc123'), null);
  assert.equal(parseThreadUrl('https://gist.github.com/o/abc'), null);
  assert.equal(parseThreadUrl('https://example.com/o/r/pull/1'), null);
  assert.equal(parseThreadUrl('chrome://newtab/'), null);
  assert.equal(parseThreadUrl('not a url'), null);
});

test('org-level discussions parse consistently', () => {
  const a = parseThreadUrl('https://github.com/orgs/community/discussions/50');
  const b = parseThreadUrl('https://github.com/orgs/community/discussions/50#discussioncomment-1');
  assert.equal(a.key, b.key);
});

test('canonicalKey collapses subviews only when asked', () => {
  const parsed = parseThreadUrl('https://github.com/o/r/pull/3/files');
  assert.equal(canonicalKey(parsed, true), 'o/r/thread/3');
  assert.equal(canonicalKey(parsed, false), 'o/r/thread/3/files');
});

test('duplicateTabIds keeps the most recently accessed tab per thread', () => {
  const tabs = [
    { id: 1, url: 'https://github.com/o/r/pull/1', lastAccessed: 100 },
    { id: 2, url: 'https://github.com/o/r/pull/1/files', lastAccessed: 300 },
    { id: 3, url: 'https://github.com/o/r/pull/1#issuecomment-9', lastAccessed: 200 },
    { id: 4, url: 'https://github.com/o/r/pull/2', lastAccessed: 50 },
  ];
  assert.deepEqual(duplicateTabIds(tabs, true).sort(), [1, 3]);
});

test('duplicateTabIds prefers an active tab over a more recent one', () => {
  const tabs = [
    { id: 1, url: 'https://github.com/o/r/issues/5', active: true, lastAccessed: 100 },
    { id: 2, url: 'https://github.com/o/r/issues/5', lastAccessed: 900 },
  ];
  assert.deepEqual(duplicateTabIds(tabs, true), [2]);
});

test('duplicateTabIds respects the subview setting', () => {
  const tabs = [
    { id: 1, url: 'https://github.com/o/r/pull/1', lastAccessed: 1 },
    { id: 2, url: 'https://github.com/o/r/pull/1/files', lastAccessed: 2 },
  ];
  assert.deepEqual(duplicateTabIds(tabs, true), [1]);
  assert.deepEqual(duplicateTabIds(tabs, false), []);
});

test('duplicateTabIds ignores non-thread tabs and singletons', () => {
  const tabs = [
    { id: 1, url: 'https://github.com/o/r' },
    { id: 2, url: 'https://github.com/o/r' },
    { id: 3, url: 'https://github.com/o/r/pull/1' },
    { id: 4, url: 'https://example.com/o/r/pull/1' },
    { id: 5 },
  ];
  assert.deepEqual(duplicateTabIds(tabs, true), []);
});

test('default settings ship enabled', () => {
  assert.equal(DEFAULT_SETTINGS.enabled, true);
  assert.equal(DEFAULT_SETTINGS.jumpToFragment, true);
  assert.equal(DEFAULT_SETTINGS.collapseSubviews, true);
});
