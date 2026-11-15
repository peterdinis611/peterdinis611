/**
 * Builds activity-aware profile SVGs from the public GitHub contributions calendar.
 * The match kernel is an isometric night stadium: commits extrude as 3D pitch
 * blocks, a football is passed through active days, HUD reads like a compiler.
 * Usage: npm run generate -- [username]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

type ContributionLevel = 0 | 1 | 2 | 3 | 4

type ContributionCell = {
  date: string
  dow: number
  week: number
  level: ContributionLevel
}

type PaceTierId = 'idle' | 'warming' | 'steady' | 'active' | 'storm'

type PaceTier = {
  id: PaceTierId
  label: string
  lines: [string, string, string, string]
}

type Point = { x: number; y: number }

const username = process.argv[2] || 'peterdinis611'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const invadersOut = join(root, 'assets', 'contrib-invasion.svg')
const invadersLegacyOut = join(root, 'assets', 'contrib-invaders.svg')
const contribGraphOut = join(root, 'assets', 'contrib-graph.svg')
const tunedOut = join(root, 'assets', 'tuned.svg')
const tunedSignalOut = join(root, 'assets', 'tuned-signal.svg')
const tuningPanelOut = join(root, 'assets', 'tuning-panel.svg')

const res = await fetch(`https://github.com/users/${username}/contributions`, {
  headers: { 'User-Agent': 'contrib-invaders-generator' },
})
if (!res.ok) throw new Error(`Failed to fetch contributions: ${res.status}`)
const html = await res.text()

const totalMatch = html.match(
  /js-contribution-activity-description[\s\S]*?(\d[\d,]*)\s*contributions/i,
)
const totalContributions = totalMatch?.[1] ? Number(totalMatch[1].replace(/,/g, '')) : null

const cells: ContributionCell[] = []
const re =
  /data-date="([^"]+)"[^>]*id="contribution-day-component-(\d+)-(\d+)"[^>]*data-level="(\d+)"/g
for (const match of html.matchAll(re)) {
  const [, date, dow, week, level] = match
  if (!date || !dow || !week || !level) continue
  cells.push({
    date,
    dow: Number(dow),
    week: Number(week),
    level: Number(level) as ContributionLevel,
  })
}
if (cells.length < 50) {
  const re2 =
    /id="contribution-day-component-(\d+)-(\d+)"[^>]*data-date="([^"]+)"[^>]*data-level="(\d+)"/g
  cells.length = 0
  for (const match of html.matchAll(re2)) {
    const [, dow, week, date, level] = match
    if (!date || !dow || !week || !level) continue
    cells.push({
      dow: Number(dow),
      week: Number(week),
      date,
      level: Number(level) as ContributionLevel,
    })
  }
}

const filled = cells.filter((c) => c.level > 0)
if (!filled.length) throw new Error('No filled contribution days found')

const today = new Date()
today.setHours(0, 0, 0, 0)
const daysAgo = (n: number): Date => {
  const d = new Date(today)
  d.setDate(d.getDate() - n)
  return d
}

const recentWindowDays = 28
const recentCutoff = daysAgo(recentWindowDays)
const recentFilled = filled.filter((c) => new Date(`${c.date}T00:00:00`) >= recentCutoff)
const recentIntensity = recentFilled.reduce((sum, c) => sum + c.level, 0)
const intensityScore = filled.reduce((sum, c) => sum + c.level, 0)

const sortedDates = [...new Set(filled.map((c) => c.date))].sort()
let streak = 0
for (let offset = 0; offset < 400; offset += 1) {
  const expected = daysAgo(offset).toISOString().slice(0, 10)
  if (sortedDates.includes(expected)) streak += 1
  else if (offset === 0) continue
  else break
}

function getPaceTier(recentDays: number, recentLevelSum: number): PaceTier {
  if (recentDays === 0) {
    return {
      id: 'idle',
      label: 'BENCH',
      lines: [
        'keeping the toolchain sharp',
        'small fixes between bigger builds',
        'reading docs and cleaning edges',
        'ready when the press starts',
      ],
    }
  }
  if (recentDays <= 6 || recentLevelSum <= 8) {
    return {
      id: 'warming',
      label: 'WARM-UP',
      lines: [
        'product UIs that feel intentional',
        'steady commits on focused scopes',
        'APIs that stay boringly reliable',
        'collaboration over ceremony',
      ],
    }
  }
  if (recentDays <= 14 || recentLevelSum <= 24) {
    return {
      id: 'steady',
      label: 'MID-BLOCK',
      lines: [
        'shipping in small, safe slices',
        'product UIs that feel intentional',
        'APIs that stay boringly reliable',
        'mobile with React Native when needed',
      ],
    }
  }
  if (recentDays <= 22 || recentLevelSum <= 40) {
    return {
      id: 'active',
      label: 'HIGH PRESS',
      lines: [
        'high commit velocity this month',
        'refactors that stay onside',
        'features from sketch to the box',
        'overlap when pairing beats async',
      ],
    }
  }
  return {
    id: 'storm',
    label: 'COUNTER',
    lines: [
      'multiple repos in parallel',
      'deep refactors under time pressure',
      'shipping features end to end',
      'tests before the victory lap',
    ],
  }
}

const matchMeta: Record<PaceTierId, { tempo: string; formation: string }> = {
  idle: { tempo: 'BENCH', formation: '5-4-1' },
  warming: { tempo: 'WARM-UP', formation: '4-4-2' },
  steady: { tempo: 'MID-BLOCK', formation: '4-3-3' },
  active: { tempo: 'HIGH PRESS', formation: '4-3-3' },
  storm: { tempo: 'COUNTER', formation: '3-4-3' },
}

const tier = getPaceTier(recentFilled.length, recentIntensity)
const match = matchMeta[tier.id]

const minWeek = Math.max(0, Math.min(...filled.map((c) => c.week)) - 1)
const maxWeek = Math.max(...filled.map((c) => c.week))
const weekCount = maxWeek - minWeek + 1
const visible = cells.filter((c) => c.week >= minWeek && c.week <= maxWeek)
const targets = [...filled]
  .filter((c) => c.week >= minWeek)
  .sort((a, b) => a.week - b.week || b.dow - a.dow)

const paceBoost = Math.min(1, recentIntensity / 36)
let HIT = 0.72 - paceBoost * 0.34
const SETUP = Math.max(0.55, 0.95 - paceBoost * 0.25)
const maxLoop = tier.id === 'storm' ? 28 : tier.id === 'active' ? 30 : 34
let totalDur = SETUP + targets.length * HIT + 1.2
if (totalDur > maxLoop) {
  HIT = Math.max(0.28, (maxLoop - SETUP - 1.2) / targets.length)
  totalDur = SETUP + targets.length * HIT + 1.2
}
totalDur = Math.round(totalDur * 100) / 100

const TW = Math.max(16, Math.min(30, 1500 / (weekCount + 8)))
const TH = TW / 2
const UNIT = Math.max(5, TW * 0.32)
const PLATFORM_Z = 16

const topFill: Record<ContributionLevel, string> = {
  0: '#14351d',
  1: '#1e6a33',
  2: '#2f9a48',
  3: '#4c8bff',
  4: '#d8ff4a',
}
const leftFill: Record<ContributionLevel, string> = {
  0: '#0d2414',
  1: '#154a24',
  2: '#1f6d34',
  3: '#2d5cb0',
  4: '#8aaa22',
}
const rightFill: Record<ContributionLevel, string> = {
  0: '#08180d',
  1: '#0e3218',
  2: '#164a24',
  3: '#1d3f7a',
  4: '#5c7414',
}

function iso(col: number, row: number, z = 0): Point {
  return {
    x: (col - row) * (TW / 2),
    y: (col + row) * (TH / 2) - z,
  }
}

function n(v: number): string {
  return v.toFixed(1)
}

function poly(points: Point[], fill: string, extra = ''): string {
  const d = `${points.map((p, i) => `${i === 0 ? 'M' : 'L'}${n(p.x)},${n(p.y)}`).join('')}Z`
  return `<path d="${d}" fill="${fill}"${extra}/>`
}

function tileTop(col: number, row: number, z: number): [Point, Point, Point, Point] {
  const c = iso(col, row, z)
  return [
    { x: c.x, y: c.y - TH / 2 },
    { x: c.x + TW / 2, y: c.y },
    { x: c.x, y: c.y + TH / 2 },
    { x: c.x - TW / 2, y: c.y },
  ]
}

function box(
  col: number,
  row: number,
  height: number,
  level: ContributionLevel,
  className?: string,
  baseZ = PLATFORM_Z,
  palette?: { top: string; left: string; right: string },
): string {
  const roof = tileTop(col, row, baseZ + height)
  if (height <= 0.5) {
    const grass = (col + row) % 2 === 0 ? '#1a4a28' : '#153d22'
    const node = poly(roof, grass)
    return className ? `<g class="${className}">${node}</g>` : node
  }
  const ground = tileTop(col, row, baseZ)
  const leftFace = [roof[3], roof[2], ground[2], ground[3]]
  const rightFace = [roof[1], roof[2], ground[2], ground[1]]
  const top = palette?.top ?? topFill[level]
  const left = palette?.left ?? leftFill[level]
  const right = palette?.right ?? rightFill[level]
  const inner = poly(leftFace, left) + poly(rightFace, right) + poly(roof, top)
  return className ? `<g class="${className}">${inner}</g>` : inner
}

function isoLine(colsRows: Array<[number, number]>, z: number): string {
  return colsRows
    .map(([c, r], i) => {
      const p = iso(c, r, z)
      return `${i === 0 ? 'M' : 'L'}${n(p.x)},${n(p.y)}`
    })
    .join('')
}

const col0 = minWeek
const col1 = maxWeek
const row0 = 0
const row1 = 6
const pad = 0.85
const pNW = iso(col0 - pad, row0 - pad, PLATFORM_Z)
const pNE = iso(col1 + pad, row0 - pad, PLATFORM_Z)
const pSE = iso(col1 + pad, row1 + pad, PLATFORM_Z)
const pSW = iso(col0 - pad, row1 + pad, PLATFORM_Z)
const gNW = iso(col0 - pad, row0 - pad, 0)
const gNE = iso(col1 + pad, row0 - pad, 0)
const gSE = iso(col1 + pad, row1 + pad, 0)
const gSW = iso(col0 - pad, row1 + pad, 0)

const platform =
  poly([pSW, pSE, gSE, gSW], '#161a16') +
  poly([pNE, pSE, gSE, gNE], '#0c0e0c') +
  poly([pNW, pNE, pSE, pSW], '#102616')

const midCol = (col0 + col1) / 2
const markings = `
  <path d="${isoLine(
    [
      [midCol, row0],
      [midCol, row1],
    ],
    PLATFORM_Z + 0.4,
  )}" fill="none" stroke="#c6ff3d" stroke-width="1.1" opacity="0.45"/>
  <path d="${isoLine(
    [
      [col0, row0],
      [col1, row0],
      [col1, row1],
      [col0, row1],
      [col0, row0],
    ],
    PLATFORM_Z + 0.4,
  )}" fill="none" stroke="#c6ff3d" stroke-width="1.2" opacity="0.4"/>
  <ellipse cx="${n(iso(midCol, 3, PLATFORM_Z + 0.4).x)}" cy="${n(iso(midCol, 3, PLATFORM_Z + 0.4).y)}" rx="${n(TW * 1.55)}" ry="${n(TH * 1.55)}" fill="none" stroke="#c6ff3d" stroke-width="1.1" opacity="0.4"/>
  <circle cx="${n(iso(midCol, 3, PLATFORM_Z + 0.4).x)}" cy="${n(iso(midCol, 3, PLATFORM_Z + 0.4).y)}" r="2.2" fill="#c6ff3d" opacity="0.7"/>
`

const box18Left = isoLine(
  [
    [col0 + weekCount * 0.18, 1],
    [col0, 1],
    [col0, 5],
    [col0 + weekCount * 0.18, 5],
  ],
  PLATFORM_Z + 0.4,
)
const box18Right = isoLine(
  [
    [col1 - weekCount * 0.18, 1],
    [col1, 1],
    [col1, 5],
    [col1 - weekCount * 0.18, 5],
  ],
  PLATFORM_Z + 0.4,
)
const penaltyBoxes = `
  <path d="${box18Left}" fill="none" stroke="#c6ff3d" stroke-width="0.9" opacity="0.32"/>
  <path d="${box18Right}" fill="none" stroke="#c6ff3d" stroke-width="0.9" opacity="0.32"/>
`

const postCol = col1 + 1.15
const postH = UNIT * 4.6
const metal = { top: '#eef2ea', left: '#8b9286', right: '#4a5048' }
const goal =
  box(postCol, 2.15, postH, 3, undefined, PLATFORM_Z, metal) +
  box(postCol, 4.85, postH, 3, undefined, PLATFORM_Z, metal) +
  `<path d="${isoLine(
    [
      [postCol, 2.15],
      [postCol, 4.85],
    ],
    PLATFORM_Z + postH,
  )}" fill="none" stroke="#eef2ea" stroke-width="2.1" opacity="0.95"/>`

const painted = [...visible].sort((a, b) => a.week + a.dow - (b.week + b.dow) || a.week - b.week)

let tiles = ''
for (const c of painted) {
  const col = c.week
  const row = c.dow
  if (c.level === 0) {
    tiles += box(col, row, 0.4, 0)
    continue
  }
  const idx = targets.findIndex((t) => t.date === c.date)
  tiles += box(col, row, c.level * UNIT, c.level, idx >= 0 ? `t${idx}` : undefined)
}

let css = ''
const kickoff = iso(col0, 3, PLATFORM_Z + 12)
const ballKeys = [`0%{transform:translate(${n(kickoff.x)}px,${n(kickoff.y)}px)}`]

targets.forEach((t, i) => {
  const start = SETUP + i * HIT
  const hitAt = start + HIT * 0.62
  const goneAt = hitAt + 0.18
  const endPct = (hitAt / totalDur) * 100
  const gonePct = Math.min(99.4, (goneAt / totalDur) * 100)
  const holdPct = Math.max(0, endPct - 0.08).toFixed(2)
  const glowPct = endPct.toFixed(2)
  const vanishPct = gonePct.toFixed(2)
  const pos = iso(t.week, t.dow, PLATFORM_Z + t.level * UNIT + 12)
  css += `.t${i}{animation:die${i} ${totalDur}s linear infinite;transform-box:fill-box;transform-origin:center}
@keyframes die${i}{0%,${holdPct}%{opacity:1;transform:scale(1)}${glowPct}%{opacity:.4;transform:scale(1.18)}${vanishPct}%,100%{opacity:0;transform:scale(0)}}`
  ballKeys.push(
    `${(((start + HIT * 0.18) / totalDur) * 100).toFixed(2)}%{transform:translate(${n(pos.x)}px,${n(pos.y)}px)}`,
  )
})
ballKeys.push(`100%{transform:translate(${n(kickoff.x)}px,${n(kickoff.y)}px)}`)
css += `.ball{animation:cruise ${totalDur}s linear infinite}@keyframes cruise{${ballKeys.join('')}}
.ball-core{animation:spin 1.1s linear infinite;transform-origin:0 0}
@keyframes spin{to{transform:rotate(360deg)}}
.hop{animation:hop .55s ease-in-out infinite}
@keyframes hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.live{animation:blink 1.5s ease-in-out infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}`

const allPts: Point[] = [pNW, pNE, pSE, pSW, gNW, gNE, gSE, gSW]
for (const c of visible) {
  const top = tileTop(c.week, c.dow, PLATFORM_Z + c.level * UNIT)
  allPts.push(...top)
}
allPts.push(iso(postCol, 2.15, PLATFORM_Z + postH), iso(postCol, 4.85, PLATFORM_Z), kickoff)

let minX = Infinity
let maxX = -Infinity
let minY = Infinity
let maxY = -Infinity
for (const p of allPts) {
  minX = Math.min(minX, p.x)
  maxX = Math.max(maxX, p.x)
  minY = Math.min(minY, p.y)
  maxY = Math.max(maxY, p.y)
}

const W = 920
const H = 488
const HEADER_H = 70
const FOOTER_H = 42
const STAGE_X = 28
const STAGE_Y = HEADER_H + 6
const STAGE_W = W - 56
const STAGE_H = H - HEADER_H - FOOTER_H - 14
const bboxW = Math.max(1, maxX - minX)
const bboxH = Math.max(1, maxY - minY)
const scale = Math.min(STAGE_W / bboxW, STAGE_H / bboxH) * 0.92
const bboxCx = (minX + maxX) / 2
const bboxCy = (minY + maxY) / 2
const stageTx = STAGE_X + STAGE_W / 2
const stageTy = STAGE_Y + STAGE_H / 2 + 6

const contribCount =
  totalContributions != null ? String(totalContributions) : String(intensityScore)
const statsLine = `${contribCount} goals   ·   ${targets.length} appearances   ·   ${recentFilled.length} last ${recentWindowDays}d`
const footerLeft = streak > 1 ? `unbeaten ${streak}d` : 'unbeaten run reset'
const footerRight = 'height = commit volume'

const invadersSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Isometric football stadium compiled from GitHub commits">
  <defs>
    <pattern id="grain" width="120" height="120" patternUnits="userSpaceOnUse">
      <circle cx="8" cy="14" r="0.6" fill="#c6ff3d" opacity="0.05"/>
      <circle cx="41" cy="63" r="0.5" fill="#4c8bff" opacity="0.06"/>
      <circle cx="97" cy="28" r="0.7" fill="#ffffff" opacity="0.03"/>
      <circle cx="72" cy="101" r="0.5" fill="#c6ff3d" opacity="0.04"/>
    </pattern>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c6ff3d" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#c6ff3d" stop-opacity="0"/>
    </linearGradient>
    <style><![CDATA[
      .bg{fill:#070908}
      .hud{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;letter-spacing:.2em;fill:#c6ff3d}
      .pace{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;letter-spacing:.16em;fill:#4c8bff}
      .meta{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.04em;fill:#7a8878}
      .code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;letter-spacing:.06em;fill:#4c8bff}
      ${css}
    ]]></style>
  </defs>
  <rect width="${W}" height="${H}" class="bg"/>
  <rect width="${W}" height="${H}" fill="url(#grain)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#1c241c" stroke-width="2"/>
  <path d="M18 18 H46 V22 H22 V46 H18 Z" fill="#c6ff3d" opacity="0.55"/>
  <path d="M${W - 18} 18 H${W - 46} V22 H${W - 22} V46 H${W - 18} Z" fill="#4c8bff" opacity="0.55"/>
  <path d="M18 ${H - 18} H46 V${H - 22} H22 V${H - 46} H18 Z" fill="#4c8bff" opacity="0.4"/>
  <path d="M${W - 18} ${H - 18} H${W - 46} V${H - 22} H${W - 22} V${H - 46} H${W - 18} Z" fill="#c6ff3d" opacity="0.4"/>
  <text x="28" y="32" class="hud">MATCH KERNEL</text>
  <circle class="live" cx="${W - 168}" cy="27" r="3.5" fill="#c6ff3d"/>
  <text x="${W - 28}" y="32" class="pace" text-anchor="end">${match.tempo}</text>
  <text x="28" y="52" class="meta">${statsLine}</text>
  <text x="${W - 28}" y="52" class="code" text-anchor="end">iso 2:1  //  ${match.formation}  //  git</text>
  <polygon points="70,${HEADER_H - 4} 210,${HEADER_H - 4} 250,${H - FOOTER_H} 20,${H - FOOTER_H}" fill="url(#beam)"/>
  <polygon points="${W - 90},${HEADER_H - 4} ${W - 230},${HEADER_H - 4} ${W - 270},${H - FOOTER_H} ${W - 40},${H - FOOTER_H}" fill="url(#beam)"/>
  <g transform="translate(${n(stageTx)},${n(stageTy)}) scale(${scale.toFixed(4)}) translate(${n(-bboxCx)},${n(-bboxCy)})">
    ${platform}
    ${markings}
    ${penaltyBoxes}
    ${tiles}
    ${goal}
    <g class="ball" transform="translate(${n(kickoff.x)},${n(kickoff.y)})">
      <g transform="scale(1.85)">
        <ellipse cx="0" cy="9" rx="8" ry="3.4" fill="#000000" opacity="0.38"/>
        <g class="hop">
          <g class="ball-core">
            <circle cx="0" cy="0" r="6.6" fill="#f3efe4"/>
            <circle cx="-1.8" cy="-2.2" r="2.1" fill="#ffffff" opacity="0.8"/>
            <path d="M-3.4,-1.1 Q0,-4.4 3.4,-1.1 Q1.5,2.9 0,5.6 Q-1.5,2.9 -3.4,-1.1Z" fill="none" stroke="#1a1a1a" stroke-width="0.9"/>
            <path d="M-5.2,1.3 Q0,0.2 5.2,1.3" fill="none" stroke="#1a1a1a" stroke-width="0.75"/>
          </g>
        </g>
      </g>
    </g>
  </g>
  <rect x="2" y="${H - FOOTER_H}" width="${W - 4}" height="${FOOTER_H - 2}" fill="#070908"/>
  <text x="28" y="${H - 16}" class="meta">${footerLeft}</text>
  <text x="${W / 2}" y="${H - 16}" class="code" text-anchor="middle">// compile(git_log) -&gt; stadium</text>
  <text x="${W - 28}" y="${H - 16}" class="meta" text-anchor="end">${footerRight}</text>
</svg>`

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const intensityPct = Math.max(8, Math.min(100, Math.round((recentIntensity / 40) * 100)))
const barWidth = Math.round(280 * (intensityPct / 100))
const commitValue = totalContributions != null ? String(totalContributions) : String(intensityScore)

const focusItems = tier.lines
  .map((line, index) => {
    const y = 86 + index * 44
    const num = String(index + 1).padStart(2, '0')
    return `<g>
    <text x="372" y="${y}" class="idx">${num}</text>
    <rect x="408" y="${y - 12}" width="2" height="18" fill="#c6ff3d"/>
    <text x="428" y="${y}" class="focus">${escapeXml(line)}</text>
    <line x1="428" y1="${y + 14}" x2="884" y2="${y + 14}" stroke="#1c241c" stroke-width="1"/>
  </g>`
  })
  .join('\n  ')

const tunedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 290" role="img" aria-label="Tactical board ${tier.label}">
  <defs>
    <pattern id="grain" width="120" height="120" patternUnits="userSpaceOnUse">
      <circle cx="8" cy="14" r="0.6" fill="#c6ff3d" opacity="0.05"/>
      <circle cx="41" cy="63" r="0.5" fill="#4c8bff" opacity="0.06"/>
      <circle cx="97" cy="28" r="0.7" fill="#ffffff" opacity="0.03"/>
    </pattern>
    <style>
      <![CDATA[
        .eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.22em;fill:#c6ff3d}
        .pace{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:-.04em;fill:#e8eee4}
        .label{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;letter-spacing:.18em;fill:#7a8878}
        .mega{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:44px;font-weight:700;letter-spacing:-.05em;fill:#e8eee4}
        .metric{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:18px;font-weight:700;letter-spacing:-.03em;fill:#e8eee4}
        .unit{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.06em;fill:#7a8878}
        .pct{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.08em;fill:#c6ff3d}
        .idx{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;fill:#c6ff3d}
        .focus{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:15px;fill:#e8eee4}
        .live{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;letter-spacing:.22em;fill:#4c8bff}
        .blink{animation:blink 1.6s ease-in-out infinite}
        .bar{animation:glow 1.8s ease-in-out infinite}
        @keyframes glow{0%,100%{opacity:1}50%{opacity:.65}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}
      ]]>
    </style>
  </defs>
  <rect width="920" height="290" fill="#070908"/>
  <rect width="920" height="290" fill="url(#grain)"/>
  <rect x="1" y="1" width="918" height="288" fill="none" stroke="#1c241c" stroke-width="2"/>
  <path d="M16 16 H44 V20 H20 V44 H16 Z" fill="#c6ff3d" opacity="0.55"/>
  <path d="M904 16 H876 V20 H900 V44 H904 Z" fill="#4c8bff" opacity="0.55"/>

  <text x="44" y="46" class="eyebrow">TACTICAL BOARD</text>
  <circle class="blink" cx="214" cy="42" r="4" fill="#c6ff3d"/>
  <text x="226" y="46" class="live">LIVE  //  ${escapeXml(match.formation)}</text>
  <text x="44" y="84" class="pace">${escapeXml(tier.label)}</text>

  <text x="44" y="148" class="mega">${commitValue}</text>
  <text x="44" y="170" class="label">GOALS / 12 MONTHS</text>

  <text x="44" y="200" class="label">PRESS</text>
  <text x="324" y="200" class="pct" text-anchor="end">${intensityPct}%</text>
  <rect x="44" y="208" width="280" height="6" fill="#101411"/>
  <rect class="bar" x="44" y="208" width="${barWidth}" height="6" fill="#c6ff3d"/>

  <line x1="44" y1="230" x2="324" y2="230" stroke="#1c241c" stroke-width="1"/>
  <text x="44" y="256" class="metric">${recentFilled.length}</text>
  <text x="78" y="256" class="unit">apps / 28d</text>
  <line x1="188" y1="244" x2="188" y2="260" stroke="#1c241c" stroke-width="1"/>
  <text x="204" y="256" class="metric">${streak}</text>
  <text x="236" y="256" class="unit">unbeaten</text>

  <line x1="352" y1="36" x2="352" y2="254" stroke="#1c241c" stroke-width="1"/>

  <text x="372" y="46" class="eyebrow">GAME PLAN</text>
  ${focusItems}
</svg>`

mkdirSync(dirname(invadersOut), { recursive: true })
writeFileSync(invadersOut, invadersSvg)
writeFileSync(invadersLegacyOut, invadersSvg)
writeFileSync(contribGraphOut, invadersSvg)
writeFileSync(tunedOut, tunedSvg)
writeFileSync(tunedSignalOut, tunedSvg)
writeFileSync(tuningPanelOut, tunedSvg)

console.log(
  `Wrote ${invadersOut} (${targets.length} blocks, ${totalDur.toFixed(1)}s loop, tempo ${match.tempo})`,
)
console.log(`Also wrote ${invadersLegacyOut}`)
console.log(
  `Wrote ${tunedOut} (${totalContributions ?? intensityScore} contributions, ${recentFilled.length} recent days)`,
)
