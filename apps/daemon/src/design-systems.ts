// @ts-nocheck
// Design-system registry. Scans <projectRoot>/design-systems/* for DESIGN.md
// files. Title comes from the first H1. Category comes from a
// `> Category: <name>` blockquote line beneath the H1. Summary is the first
// paragraph between the H1 and the next heading (Category line stripped).

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function listDesignSystems(root) {
  const out = [];
  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const designPath = path.join(root, entry.name, 'DESIGN.md');
    try {
      const stats = await stat(designPath);
      if (!stats.isFile()) continue;
      const raw = await readFile(designPath, 'utf8');
      const titleMatch = /^#\s+(.+?)\s*$/m.exec(raw);
      const title = cleanTitle(titleMatch?.[1] ?? entry.name);
      out.push({
        id: entry.name,
        title,
        category: extractCategory(raw) ?? 'Uncategorized',
        summary: summarize(raw),
        swatches: extractSwatches(raw),
        surface: extractSurface(raw),
        body: raw,
      });
    } catch {
      // Skip.
    }
  }
  return out;
}

export async function readDesignSystem(root, id) {
  const file = path.join(root, id, 'DESIGN.md');
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

export async function writeDesignSystem(root, id, content) {
  const dir = path.join(root, id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'DESIGN.md'), content, 'utf8');
}

export async function deleteDesignSystem(root, id) {
  const dir = path.join(root, id);
  await rm(dir, { recursive: true, force: true });
}

export async function readTokens(root, id) {
  const file = path.join(root, id, 'tokens.json');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

export async function writeTokens(root, id, tokens) {
  const dir = path.join(root, id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'tokens.json'), JSON.stringify(tokens, null, 2), 'utf8');
  await writeFile(path.join(dir, 'DESIGN.md'), tokensToDesignMd(tokens), 'utf8');
}

function tokensToDesignMd(tokens) {
  const c = tokens.colors ?? {};
  const typo = tokens.typography ?? {};
  const spacing = tokens.spacing ?? [];
  const radii = tokens.radii ?? {};
  const shadows = tokens.shadows ?? {};
  const meta = tokens.meta ?? {};
  const name = meta.name ?? 'Design System';

  const colorRows = Object.entries(c)
    .map(([k, v]) => `- **${camelToLabel(k)}** (\`${v}\`)`)
    .join('\n');

  const scaleRows = (typo.scale ?? [])
    .map((s) => `| ${s.role} | ${s.mono ? 'Mono' : 'Primary'} | ${s.size}px | ${s.weight} | ${s.lineHeight}px |`)
    .join('\n');

  const spacingList = spacing.map((n) => `- \`${n}px\``).join('\n');

  const radiiRows = Object.entries(radii)
    .map(([k, v]) => `- **${camelToLabel(k)}:** \`${v}px\``)
    .join('\n');

  const shadowRows = Object.entries(shadows)
    .map(([k, v]) => `- **${camelToLabel(k)}:** \`${v}\``)
    .join('\n');

  return `# ${name}

## 1. Visual Theme & Atmosphere

${meta.description ?? name + ' design system.'}

## 2. Color Palette & Roles

${colorRows}

## 3. Typography Rules

### Font Family
**Primary:** ${typo.fontFamily ?? 'sans-serif'}

**Monospace:** ${typo.fontFamilyMono ?? 'monospace'}

### Hierarchy

| Role | Font | Size | Weight | Line Height |
|------|------|------|--------|-------------|
${scaleRows}

## 4. Component Stylings

Refer to color and typography tokens above for all component styling decisions.

- **Primary button background:** \`${c.primary ?? '#000'}\`, text \`${c.white ?? '#fff'}\`, radius \`${radii.button ?? 40}px\`
- **Secondary button:** transparent bg, border \`1px solid ${c.border ?? '#ccc'}\`, radius \`${radii.button ?? 40}px\`
- **Input:** bg \`${c.background ?? '#fff'}\`, border \`1px solid ${c.border ?? '#ccc'}\`, radius \`${radii.input ?? 8}px\`, height 44px
- **Card:** bg \`${c.background ?? '#fff'}\`, border \`1px solid ${c.border ?? '#ccc'}\`, radius \`${radii.card ?? 16}px\`, padding 24px 32px
- **Elevated card:** shadow \`${shadows.raised ?? 'none'}\`, radius \`${radii.card ?? 16}px\`

## 5. Layout Principles

### Spacing Scale

**Base Unit:** \`4px\`

${spacingList}

### Border Radius Scale

${radiiRows}

## 6. Depth & Elevation

${shadowRows}

## 7. Do's and Don'ts

### Do
- Use \`${c.primary ?? '#000'}\` for all primary CTAs and key interactive elements
- Apply \`${c.secondary ?? '#000'}\` to secondary actions that support—not compete with—primary
- Use \`${c.success ?? '#000'}\` for success states and confirmation feedback
- Maintain at least \`48px\` height for all clickable elements

### Don't
- Introduce new accent colors outside the defined palette
- Use \`${c.error ?? '#f00'}\` for anything other than errors and warnings
- Vary spacing arbitrarily; always reference the defined spacing scale

## 8. Responsive Behavior

- Mobile (375px–599px): 4-column grid, 16px padding, stack all sections
- Tablet (600px–1023px): 8-column grid, 24px padding
- Desktop (1024px+): 12-column grid, max-width 1440px

## 9. Agent Prompt Guide

### Quick Color Reference

${Object.entries(c).map(([k, v]) => `- **${camelToLabel(k)}:** \`${v}\``).join('\n')}

### Typography

- Primary font: ${(typo.fontFamily ?? '').split(',')[0]}
- Mono font: ${(typo.fontFamilyMono ?? '').split(',')[0]}
- Body text: \`${(typo.scale ?? []).find((s) => s.role === 'Body')?.size ?? 16}px\` weight \`${(typo.scale ?? []).find((s) => s.role === 'Body')?.weight ?? 400}\`
- Heading H1: \`${(typo.scale ?? [])[0]?.size ?? 56}px\` weight \`${(typo.scale ?? [])[0]?.weight ?? 700}\`
`;
}

function camelToLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function summarize(raw) {
  const lines = raw.split(/\r?\n/);
  const firstH1 = lines.findIndex((l) => /^#\s+/.test(l));
  if (firstH1 === -1) return '';
  const afterH1 = lines.slice(firstH1 + 1);
  const nextHeading = afterH1.findIndex((l) => /^#{1,6}\s+/.test(l));
  const window = (nextHeading === -1 ? afterH1 : afterH1.slice(0, nextHeading))
    .join('\n')
    // Drop the Category metadata line — it's surfaced separately.
    .replace(/^>\s*Category:.*$/gim, '')
    .replace(/^>\s*/gm, '')
    .trim();
  return window.split(/\n\n/)[0]?.slice(0, 240) ?? '';
}

function extractCategory(raw) {
  const m = /^>\s*Category:\s*(.+?)\s*$/im.exec(raw);
  return m?.[1];
}

const KNOWN_SURFACES = new Set(['web', 'image', 'video', 'audio']);
function extractSurface(raw) {
  const m = /^>\s*Surface:\s*(.+?)\s*$/im.exec(raw);
  if (!m) return 'web';
  const v = m[1].trim().toLowerCase();
  return KNOWN_SURFACES.has(v) ? v : 'web';
}

// Strip boilerplate like "Design System Inspired by Cohere" → "Cohere" so
// the picker dropdown reads cleanly. Hand-authored titles that don't match
// the pattern (e.g. "Neutral Modern") pass through unchanged.
function cleanTitle(raw) {
  return raw
    .replace(/^Design System (Inspired by|for)\s+/i, '')
    .trim();
}

/**
 * Pull 4 representative colors from a DESIGN.md so the picker can render
 * a tiny swatch row next to each system. Order: [bg, support, fg, accent].
 *
 * The shape is deliberately compact — one accent + one background + one
 * fg + one supporting tone — so the row reads like a brand mark even at
 * thumbnail scale. Picked greedily by token-name hints (matches the
 * heuristics in design-system-preview.js so the strip and the showcase
 * agree on which colors the system "is").
 *
 * @param {string} raw  Markdown body of DESIGN.md
 * @returns {string[]}  Up to 4 hex strings; [] if extraction fails.
 */
function extractSwatches(raw) {
  const colors = [];
  const seen = new Set();
  function push(name, value) {
    const cleanName = name.replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const v = normalizeHex(value);
    if (!v || cleanName.length > 60) return;
    const key = `${cleanName}|${v}`;
    if (seen.has(key)) return;
    seen.add(key);
    colors.push({ name: cleanName, value: v });
  }
  // Form A: "- **Background:** `#FAFAFA`" — the colon may sit inside the
  // bold markers (`**Name:**`) or outside them (`**Name**:`). Both variants
  // are common in hand-authored DESIGN.md files, so we allow the colon in
  // either position around the closing `**`.
  const reA = /^[\s>*-]*\**\s*([A-Za-z][A-Za-z0-9 /&()+_-]{1,40}?)\s*[:：]?\s*\**\s*[:：]?\s*`?(#[0-9a-fA-F]{3,8})/gm;
  let m;
  while ((m = reA.exec(raw)) !== null) push(m[1], m[2]);
  // Form B: "**Stripe Purple** (`#533afd`)"
  const reB = /\*\*([A-Za-z][A-Za-z0-9 /&()+_-]{1,40}?)\*\*\s*\(?\s*`?(#[0-9a-fA-F]{3,8})/g;
  while ((m = reB.exec(raw)) !== null) push(m[1], m[2]);
  if (colors.length === 0) return [];

  function pick(hints) {
    for (const h of hints) {
      const found = colors.find((c) => c.name.includes(h));
      if (found) return found.value;
    }
    return null;
  }
  function isNeutral(hex) {
    if (!/^#[0-9a-f]{6}$/.test(hex)) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return Math.max(r, g, b) - Math.min(r, g, b) < 10;
  }

  const bg =
    pick(['page background', 'background', 'canvas', 'paper', 'surface'])
    ?? '#ffffff';
  const fg =
    pick(['heading', 'foreground', 'ink', 'fg', 'text', 'navy', 'graphite'])
    ?? '#111111';
  const accent =
    pick(['primary brand', 'brand primary', 'accent', 'brand', 'primary'])
    ?? colors.find((c) => !isNeutral(c.value))?.value
    ?? colors[0]?.value
    ?? '#888888';
  const support =
    pick(['border', 'divider', 'rule', 'muted', 'secondary', 'subtle'])
    ?? colors.find(
      (c) => isNeutral(c.value) && c.value !== bg && c.value !== fg,
    )?.value
    ?? '#cccccc';

  return [bg, support, fg, accent];
}

function normalizeHex(raw) {
  if (typeof raw !== 'string') return null;
  const m = /^#([0-9a-fA-F]{3,8})$/.exec(raw.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length === 4) hex = hex.split('').map((c) => c + c).join('').slice(0, 8);
  return '#' + hex.toLowerCase();
}
