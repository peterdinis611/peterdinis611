/**
 * Builds activity-aware profile SVGs from the public GitHub contributions calendar.
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
      label: 'IDLE',
      lines: [
        'keeping the toolchain sharp',
        'small fixes between bigger builds',
        'reading docs and cleaning edges',
        'ready when velocity picks up',
      ],
    }
  }
  if (recentDays <= 6 || recentLevelSum <= 8) {
    return {
      id: 'warming',
      label: 'WARMING UP',
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
      label: 'STEADY PACE',
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
      label: 'ACTIVE SPRINT',
      lines: [
        'high commit velocity this month',
        'refactors that stay boringly safe',
        'features from sketch to production',
        'pairing when it beats async',
      ],
    }
  }
  return {
    id: 'storm',
    label: 'COMMIT STORM',
    lines: [
      'multiple repos in parallel',
      'deep refactors under time pressure',
      'shipping features end to end',
      'tests before the victory lap',
    ],
  }
}

const tier = getPaceTier(recentFilled.length, recentIntensity)

const CELL = 14
const GAP = 4
const STEP = CELL + GAP
const HEADER_H = 58
const FOOTER_H = 36
const GRID_ROWS = 7
const GRID_H = GRID_ROWS * STEP - GAP
const SHIP_H = 28
const PAD_X = 28
const PAD_TOP = HEADER_H + 14
const PAD_BOTTOM = FOOTER_H + SHIP_H + 18

const minWeek = Math.max(0, Math.min(...filled.map((c) => c.week)) - 1)
const maxWeek = Math.max(...filled.map((c) => c.week))
const weekCount = maxWeek - minWeek + 1
const gridW = weekCount * STEP - GAP
const W = Math.max(640, gridW + PAD_X * 2)
const H = PAD_TOP + GRID_H + PAD_BOTTOM
const gridOriginX = Math.round((W - gridW) / 2)
const PAD_Y = PAD_TOP
const SHIP_Y = PAD_TOP + GRID_H + 18
const FOOTER_Y = H - 14

const levelFill: Record<ContributionLevel, string> = {
  0: '#1a1a1a',
  1: '#2a4570',
  2: '#3d66a8',
  3: '#4c8bff',
  4: '#7cabff',
}

const paceBoost = Math.min(1, recentIntensity / 36)
let HIT = 0.72 - paceBoost * 0.34
const SETUP = Math.max(0.55, 0.95 - paceBoost * 0.25)
const visible = cells.filter((c) => c.week >= minWeek && c.week <= maxWeek)
const targets = [...filled]
  .filter((c) => c.week >= minWeek)
  .sort((a, b) => a.week - b.week || b.dow - a.dow)

const maxLoop = tier.id === 'storm' ? 28 : tier.id === 'active' ? 30 : 34
let totalDur = SETUP + targets.length * HIT + 1.2
if (totalDur > maxLoop) {
  HIT = Math.max(0.28, (maxLoop - SETUP - 1.2) / targets.length)
  totalDur = SETUP + targets.length * HIT + 1.2
}
totalDur = Math.round(totalDur * 100) / 100

const cellX = (week: number): number => gridOriginX + (week - minWeek) * STEP
const cellY = (dow: number): number => PAD_Y + dow * STEP

let css = ''
let lasers = ''
const shipKeys = [`0%{transform:translate(${gridOriginX}px,${SHIP_Y}px)}`]

targets.forEach((t, i) => {
  const start = SETUP + i * HIT
  const hitAt = start + HIT * 0.62
  const goneAt = hitAt + 0.18
  const endPct = (hitAt / totalDur) * 100
  const startPct = (start / totalDur) * 100
  const gonePct = Math.min(99.4, (goneAt / totalDur) * 100)
  const cx = cellX(t.week) + CELL / 2
  const cy = cellY(t.dow) + CELL / 2
  const shipX = cx - 10
  const laserWidth = t.level >= 3 ? 3 : 2
  const laserColor = levelFill[t.level] || '#4c8bff'
  const holdPct = Math.max(0, endPct - 0.08).toFixed(2)
  const glowPct = endPct.toFixed(2)
  const vanishPct = gonePct.toFixed(2)
  const firePct = (((start + HIT * 0.25) / totalDur) * 100).toFixed(2)
  const fadePct = (((hitAt + 0.15) / totalDur) * 100).toFixed(2)
  css += `.t${i}{animation:die${i} ${totalDur}s linear infinite;transform-box:fill-box;transform-origin:center}
@keyframes die${i}{0%,${holdPct}%{opacity:1;transform:scale(1)}${glowPct}%{opacity:.35;transform:scale(1.7)}${vanishPct}%,100%{opacity:0;transform:scale(0)}}
.l${i}{opacity:0;transform-origin:${cx}px ${SHIP_Y}px;animation:shoot${i} ${totalDur}s linear infinite}
@keyframes shoot${i}{0%,${startPct.toFixed(2)}%{transform:scaleY(0);opacity:0}${firePct}%{transform:scaleY(1);opacity:1}${glowPct}%{transform:scaleY(1);opacity:1}${fadePct}%,100%{transform:scaleY(0);opacity:0}}`
  lasers += `<rect class="l${i}" x="${(cx - laserWidth / 2).toFixed(1)}" y="${cy.toFixed(1)}" width="${laserWidth}" height="${Math.max(8, SHIP_Y - cy).toFixed(1)}" fill="${laserColor}"/>`
  shipKeys.push(
    `${(((start + HIT * 0.15) / totalDur) * 100).toFixed(2)}%{transform:translate(${shipX.toFixed(1)}px,${SHIP_Y}px)}`,
  )
})
shipKeys.push(`100%{transform:translate(${gridOriginX}px,${SHIP_Y}px)}`)
css += `.ship{animation:cruise ${totalDur}s linear infinite}@keyframes cruise{${shipKeys.join('')}}`

if (tier.id === 'storm' || tier.id === 'active') {
  css += `.ship-core{animation:pulse ${Math.max(0.8, totalDur / 6).toFixed(2)}s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:.7}50%{opacity:1}}`
}

let grid = ''
for (const c of visible) {
  const x = cellX(c.week)
  const y = cellY(c.dow)
  const fill = levelFill[c.level] || levelFill[0]
  if (c.level === 0) {
    grid += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}"/>`
  } else {
    const idx = targets.findIndex((t) => t.date === c.date)
    grid += `<rect class="t${idx}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}"/>`
  }
}

const contribCount =
  totalContributions != null ? String(totalContributions) : String(intensityScore)
const statsLine = `${contribCount} commits / yr   ·   ${targets.length} active days   ·   ${recentFilled.length} last ${recentWindowDays}d`
const footerLeft = streak > 1 ? `streak ${streak}d` : 'no streak'
const footerRight = 'brighter = more commits'

const invadersSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Shoot filled GitHub contribution days">
  <defs><style><![CDATA[
    .bg{fill:#111111}
    .hud{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;letter-spacing:.18em;fill:#4c8bff}
    .pace{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.14em;fill:#4c8bff}
    .meta{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.04em;fill:#888888}
    ${css}
  ]]></style></defs>
  <rect width="${W}" height="${H}" class="bg"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#2a2a2a" stroke-width="2"/>
  <rect x="2" y="2" width="${W - 4}" height="${HEADER_H}" fill="#111111"/>
  <text x="24" y="28" class="hud">CONTRIB INVASION</text>
  <text x="${W - 24}" y="28" class="pace" text-anchor="end">${tier.label}</text>
  <text x="24" y="48" class="meta">${statsLine}</text>
  ${grid}
  ${lasers}
  <g class="ship" transform="translate(${gridOriginX},${SHIP_Y})">
    <g class="ship-core">
      <rect x="8" y="0" width="4" height="4" fill="#4c8bff"/>
      <rect x="4" y="4" width="12" height="4" fill="#4c8bff"/>
      <rect x="0" y="8" width="20" height="4" fill="#4c8bff"/>
      <rect x="0" y="12" width="4" height="4" fill="#4c8bff"/>
      <rect x="16" y="12" width="4" height="4" fill="#4c8bff"/>
    </g>
  </g>
  <rect x="2" y="${H - FOOTER_H}" width="${W - 4}" height="${FOOTER_H - 2}" fill="#111111"/>
  <text x="24" y="${FOOTER_Y}" class="meta">${footerLeft}</text>
  <text x="${W - 24}" y="${FOOTER_Y}" class="meta" text-anchor="end">${footerRight}</text>
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
    <rect x="408" y="${y - 12}" width="2" height="18" fill="#4c8bff"/>
    <text x="428" y="${y}" class="focus">${escapeXml(line)}</text>
    <line x1="428" y1="${y + 14}" x2="884" y2="${y + 14}" stroke="#2a2a2a" stroke-width="1"/>
  </g>`
  })
  .join('\n  ')

const tunedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 290" role="img" aria-label="Currently tuned for ${tier.label}">
  <defs>
    <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.8" fill="#242424"/>
    </pattern>
    <style>
      <![CDATA[
        .eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.28em;fill:#4c8bff}
        .pace{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:-.04em;fill:#eeeeee}
        .label{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;letter-spacing:.18em;fill:#888888}
        .mega{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:44px;font-weight:700;letter-spacing:-.05em;fill:#eeeeee}
        .metric{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:18px;font-weight:700;letter-spacing:-.03em;fill:#eeeeee}
        .unit{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.06em;fill:#888888}
        .pct{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.08em;fill:#4c8bff}
        .idx{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;fill:#4c8bff}
        .focus{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:15px;fill:#eeeeee}
        .live{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;letter-spacing:.22em;fill:#4c8bff}
        .blink{animation:blink 1.6s ease-in-out infinite}
        .bar{transform-box:fill-box;transform-origin:left center;animation:fill 1s cubic-bezier(.22,1,.36,1) .2s both}
        @keyframes fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}
      ]]>
    </style>
  </defs>

  <rect width="920" height="290" fill="#111111"/>
  <rect width="920" height="290" fill="url(#dots)" opacity="0.65"/>
  <rect x="16" y="16" width="888" height="258" fill="#181818" stroke="#2a2a2a" stroke-width="1"/>
  <rect x="16" y="16" width="4" height="258" fill="#4c8bff"/>

  <!-- LEFT COLUMN: fixed y bands, no overlap -->
  <text x="44" y="46" class="eyebrow">TUNING SIGNAL</text>
  <circle class="blink" cx="198" cy="42" r="4" fill="#4c8bff"/>
  <text x="210" y="46" class="live">LIVE</text>
  <text x="44" y="84" class="pace">${escapeXml(tier.label)}</text>

  <text x="44" y="148" class="mega">${commitValue}</text>
  <text x="44" y="170" class="label">COMMITS / 12 MONTHS</text>

  <text x="44" y="200" class="label">INTENSITY</text>
  <text x="324" y="200" class="pct" text-anchor="end">${intensityPct}%</text>
  <rect x="44" y="208" width="280" height="6" fill="#111111"/>
  <rect class="bar" x="44" y="208" width="${barWidth}" height="6" fill="#4c8bff"/>

  <line x1="44" y1="230" x2="324" y2="230" stroke="#2a2a2a" stroke-width="1"/>
  <text x="44" y="256" class="metric">${recentFilled.length}</text>
  <text x="78" y="256" class="unit">active / 28d</text>
  <line x1="188" y1="244" x2="188" y2="260" stroke="#2a2a2a" stroke-width="1"/>
  <text x="204" y="256" class="metric">${streak}</text>
  <text x="236" y="256" class="unit">day streak</text>

  <line x1="352" y1="36" x2="352" y2="254" stroke="#2a2a2a" stroke-width="1"/>

  <text x="372" y="46" class="eyebrow">FOCUSED ON</text>
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
  `Wrote ${invadersOut} (${targets.length} targets, ${totalDur.toFixed(1)}s loop, pace ${tier.label})`,
)
console.log(`Also wrote ${invadersLegacyOut}`)
console.log(
  `Wrote ${tunedOut} (${totalContributions ?? intensityScore} contributions, ${recentFilled.length} recent days)`,
)
