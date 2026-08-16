#!/usr/bin/env node
/**
 * Builds assets/contrib-invaders.svg from the public GitHub contributions calendar.
 * Usage: node scripts/generate-contrib-invaders.mjs [username]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const username = process.argv[2] || 'peterdinis611'; 
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets', 'contrib-invaders.svg');

const res = await fetch(`https://github.com/users/${username}/contributions`, {
  headers: { 'User-Agent': 'contrib-invaders-generator' },
});
if (!res.ok) throw new Error(`Failed to fetch contributions: ${res.status}`);
const html = await res.text();

const cells = [];
const re =
  /data-date="([^"]+)"[^>]*id="contribution-day-component-(\d+)-(\d+)"[^>]*data-level="(\d+)"/g;
let m;
while ((m = re.exec(html))) {
  cells.push({ date: m[1], dow: +m[2], week: +m[3], level: +m[4] });
}
if (cells.length < 50) {
  const re2 =
    /id="contribution-day-component-(\d+)-(\d+)"[^>]*data-date="([^"]+)"[^>]*data-level="(\d+)"/g;
  cells.length = 0;
  while ((m = re2.exec(html))) {
    cells.push({ dow: +m[1], week: +m[2], date: m[3], level: +m[4] });
  }
}

const filled = cells.filter((c) => c.level > 0);
if (!filled.length) throw new Error('No filled contribution days found');

const CELL = 14;
const GAP = 4;
const STEP = CELL + GAP;
const PAD_X = 40;
const PAD_Y = 52;
const SHIP_Y = 220;
const minWeek = Math.max(0, Math.min(...filled.map((c) => c.week)) - 1);
const maxWeek = Math.max(...filled.map((c) => c.week));
const visible = cells.filter((c) => c.week >= minWeek && c.week <= maxWeek);
const W = PAD_X * 2 + (maxWeek - minWeek + 1) * STEP + 20;
const H = 280;
const levelFill = {
  0: '#1a1a1a',
  1: '#4c8bff',
  2: '#4c8bff',
  3: '#4c8bff',
  4: '#4c8bff',
};
const targets = [...filled]
  .filter((c) => c.week >= minWeek)
  .sort((a, b) => a.week - b.week || b.dow - a.dow);
const HIT = 0.48;
const SETUP = 0.9;
const totalDur = SETUP + targets.length * HIT + 1.2;
const cellX = (week) => PAD_X + (week - minWeek) * STEP;
const cellY = (dow) => PAD_Y + dow * STEP;

let css = '';
let lasers = '';
const shipKeys = [`0%{transform:translate(${PAD_X}px,${SHIP_Y}px)}`];

targets.forEach((t, i) => {
  const start = SETUP + i * HIT;
  const hitAt = start + HIT * 0.62;
  const endPct = (hitAt / totalDur) * 100;
  const startPct = (start / totalDur) * 100;
  const cx = cellX(t.week) + CELL / 2;
  const cy = cellY(t.dow) + CELL / 2;
  const shipX = cx - 10;
  css += `.t${i}{animation:die${i} ${totalDur}s linear infinite;transform-box:fill-box;transform-origin:center}
@keyframes die${i}{0%,${(endPct - 0.05).toFixed(2)}%{opacity:1;transform:scale(1)}${endPct.toFixed(2)}%{opacity:.2;transform:scale(1.8)}${(endPct + 0.8).toFixed(2)}%,100%{opacity:0;transform:scale(0)}}
.l${i}{transform-origin:${cx}px ${SHIP_Y}px;animation:shoot${i} ${totalDur}s linear infinite}
@keyframes shoot${i}{0%,${startPct.toFixed(2)}%{transform:scaleY(0);opacity:0}${((start + HIT * 0.25) / totalDur * 100).toFixed(2)}%{transform:scaleY(1);opacity:1}${endPct.toFixed(2)}%{transform:scaleY(1);opacity:1}${((hitAt + 0.15) / totalDur * 100).toFixed(2)}%,100%{transform:scaleY(0);opacity:0}}`;
  lasers += `<rect class="l${i}" x="${(cx - 1).toFixed(1)}" y="${cy.toFixed(1)}" width="2" height="${Math.max(8, SHIP_Y - cy).toFixed(1)}" fill="#4c8bff"/>`;
  shipKeys.push(
    `${((start + HIT * 0.15) / totalDur * 100).toFixed(2)}%{transform:translate(${shipX.toFixed(1)}px,${SHIP_Y}px)}`,
  );
});
shipKeys.push(`100%{transform:translate(${PAD_X}px,${SHIP_Y}px)}`);
css += `.ship{animation:cruise ${totalDur}s linear infinite}@keyframes cruise{${shipKeys.join('')}}`;

let grid = '';
for (const c of visible) {
  const x = cellX(c.week);
  const y = cellY(c.dow);
  const fill = levelFill[c.level] || levelFill[0];
  if (c.level === 0) {
    grid += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}"/>`;
  } else {
    const idx = targets.findIndex((t) => t.date === c.date);
    grid += `<rect class="t${idx}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}"/>`;
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Shoot filled GitHub contribution days">
  <defs><style><![CDATA[
    .bg{fill:#111111}
    .hud{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;letter-spacing:.16em;fill:#4c8bff}
    .score{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;letter-spacing:.1em;fill:#4c8bff}
    ${css}
  ]]></style></defs>
  <rect width="${W}" height="${H}" class="bg"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#2a2a2a" stroke-width="2"/>
  <text x="20" y="28" class="hud">CONTRIB INVASION</text>
  <text x="${W - 210}" y="28" class="score">HIT ${targets.length} FILLED DAYS</text>
  ${grid}
  ${lasers}
  <g class="ship">
    <rect x="8" y="0" width="4" height="4" fill="#4c8bff"/>
    <rect x="4" y="4" width="12" height="4" fill="#4c8bff"/>
    <rect x="0" y="8" width="20" height="4" fill="#4c8bff"/>
    <rect x="0" y="12" width="4" height="4" fill="#4c8bff"/>
    <rect x="16" y="12" width="4" height="4" fill="#4c8bff"/>
  </g>
  <text x="20" y="${H - 14}" class="hud">EMPTY CELLS STAY  /  FILLED CELLS FALL</text>
</svg>`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, svg);
console.log(`Wrote ${out} (${targets.length} targets, ${totalDur.toFixed(1)}s loop)`);
