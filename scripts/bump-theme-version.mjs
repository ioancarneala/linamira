#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const version = (process.argv[2] || '').trim();

if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: node scripts/bump-theme-version.mjs 0.2.0');
  process.exit(1);
}

const stylePath = resolve('style.css');
const css = readFileSync(stylePath, 'utf8');

if (!/^Version:\s*.+$/m.test(css)) {
  console.error('Could not find a Version header in style.css');
  process.exit(1);
}

writeFileSync(stylePath, css.replace(/^Version:\s*.+$/m, `Version: ${version}`));
console.log(`Updated style.css to ${version}`);
