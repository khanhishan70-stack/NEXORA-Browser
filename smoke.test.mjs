import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const script = readFileSync(join(root, 'app.js'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');
const polish = readFileSync(join(root, 'polish.css'), 'utf8');

test('local styles, scripts, and all six slideshow screenshots exist', () => {
  for (const file of ['styles.css', 'polish.css', 'config.js', 'app.js']) {
    assert.match(html, new RegExp(`["']${file.replace('.', '\\.')}["']`));
    assert.ok(existsSync(join(root, file)), `${file} is missing`);
  }
  const screenshots = [...script.matchAll(/['"](assets\/screenshots\/[^'"]+\.png)['"]/g)].map((match) => match[1]);
  assert.equal(screenshots.length, 6);
  for (const file of screenshots) assert.ok(existsSync(join(root, file)), `${file} is missing`);
});

test('power, launch, feature monitors, and setup steps have matching hooks', () => {
  for (const id of ['monitorPower', 'monitorScreen', 'monitorOff', 'monitorBoot', 'monitorDesktop',
    'launchBrowser', 'monitorBrowser', 'slidePrev', 'slideNext', 'setupShowcase', 'setupPrev', 'setupNext']) {
    assert.ok(html.includes(`id="${id}"`), `${id} is missing from the page`);
    assert.ok(script.includes(id), `${id} is not wired in app.js`);
  }
  assert.equal((html.match(/data-monitor-kind="feature"/g) || []).length, 3);
  assert.match(script, /\.setup-screen-content/);
  assert.match(script, /setPhase\('desktop'/);
  assert.match(script, /setPhase\('browser'/);
});

test('screen geometry and reduced-motion rules are present', () => {
  assert.match(css, /\.monitor-screen\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*10/);
  assert.match(polish, /\.monitor-wall \.showcase-screen\s*\{[^}]*aspect-ratio:/);
  assert.match(polish, /prefers-reduced-motion:\s*reduce/);
  for (const sheet of [css, polish]) {
    assert.equal((sheet.match(/\{/g) || []).length, (sheet.match(/\}/g) || []).length);
  }
});
