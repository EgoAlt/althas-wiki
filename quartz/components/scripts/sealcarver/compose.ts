import { SIGILS, SigilAsset } from "./sigils.gen"
import { DaggerGroup, Seal } from "./types"

// Renders a Seal as a self-contained SVG string using rigid transforms only
// (translate, rotate, uniform scale), the same composition method the source
// author uses: sigil path data is embedded verbatim, never warped. Stroke
// widths are rescaled proportionally (orig / scale) so every sigil draws at a
// consistent apparent pen weight while keeping the artist's deliberate
// weight ratios within each sigil.

const C = 500
const R_OUTER = 482
const R_INNER = 424
const R_PLAIN = 453
const R_DAGGER = 300
const R_MOD = R_DAGGER + 88
const R_BAND = 453
const HEART_W = 210
const CASTER_HEART_W = 260
const WRAP_W = 330
const TARGET_W = 250
const QUAL_H = 52
const MOD_W = 56
const TRIGGER_W = 46
const RING_STROKE = 'style="fill:none;stroke:currentColor;stroke-width:5px;"'

function rescaleStrokes(body: string, s: number): string {
  return body.replace(
    /stroke-width:([\d.]+)px/g,
    (_, w) => `stroke-width:${(parseFloat(w) / s).toFixed(3)}px`,
  )
}

function place(
  key: string,
  cx: number,
  cy: number,
  target: number,
  rot = 0,
  fit: "w" | "h" = "w",
): string {
  const a: SigilAsset | undefined = SIGILS[key]
  if (!a) throw new Error(`unknown sigil ${key}`)
  const s = target / (fit === "w" ? a.w : a.h)
  const dw = a.w * s
  const dh = a.h * s
  return (
    `<g transform="translate(${cx.toFixed(2)},${cy.toFixed(2)}) rotate(${rot.toFixed(2)})">` +
    `<svg x="${(-dw / 2).toFixed(2)}" y="${(-dh / 2).toFixed(2)}" width="${dw.toFixed(2)}" height="${dh.toFixed(2)}" ` +
    `viewBox="0 0 ${a.w} ${a.h}" overflow="visible">${rescaleStrokes(a.body, s)}</svg></g>`
  )
}

function onRing(
  key: string,
  radius: number,
  angleDeg: number,
  target: number,
  fit: "w" | "h" = "w",
): string {
  const a = (angleDeg * Math.PI) / 180
  return place(key, C + radius * Math.sin(a), C - radius * Math.cos(a), target, angleDeg, fit)
}

function groupAngles(
  g: DaggerGroup,
  gi: number,
  nGroups: number,
  hasDirectional: boolean,
): number[] {
  if (g.placement === "directional") {
    // Keep the whole cluster inside ~120 degrees so a high count still reads
    // as one directed volley rather than a scatter.
    const spread = Math.min(38, 120 / Math.max(g.count - 1, 1))
    return Array.from({ length: g.count }, (_, i) => 90 + (i - (g.count - 1) / 2) * spread)
  }
  const step = 360 / Math.max(g.count, 1)
  // With a directional cluster at 90, anchor symmetric slots opposite it
  // (one slot at 270) so the two never collide; otherwise start at 0.
  const base = hasDirectional ? 270 % step : 0
  const offset = base + gi * (step / nGroups)
  return Array.from({ length: g.count }, (_, i) => offset + i * step)
}

// Sigils are placed with rot = ring angle, which points their authored "up"
// outward. Sigils authored sideways need a correction so their arrow points
// radially out instead of chasing the circle (expel's arrow points right in
// its own frame; G2 feedback caught the tangential drift).
const ORIENT: Partial<Record<string, number>> = { expel: -90 }

function heart(seal: Seal): string {
  const parts: string[] = []
  const { element, mode, wrap } = seal.heart
  if (wrap !== "none") parts.push(place(`modifiers/${wrap}`, C, C, WRAP_W))
  if (element === "caster-self") {
    // Blink Out's construction: the Caster target sigil serves as the Heart,
    // with the bare mode modifier beneath it (no pre-composed asset exists).
    parts.push(place("targets/caster", C, C - 14, CASTER_HEART_W))
    parts.push(place(`modifiers/${mode}`, C, C + 56, 80))
  } else {
    parts.push(place(`elements/${element}-${mode}`, C, C, HEART_W))
  }
  return parts.join("")
}

function daggers(seal: Seal): string {
  const parts: string[] = []
  const n = seal.daggers.length
  const hasDirectional = seal.daggers.some((g) => g.placement === "directional")
  seal.daggers.forEach((g, gi) => {
    for (const ang of groupAngles(g, gi, n, hasDirectional)) {
      const orient = ORIENT[g.dagger] ?? 0
      const a = (ang * Math.PI) / 180
      parts.push(
        place(
          `functions/${g.dagger}`,
          C + R_DAGGER * Math.sin(a),
          C - R_DAGGER * Math.cos(a),
          135,
          ang + orient,
        ),
      )
      if (g.mod === "none") continue
      if (g.mod === "senses") {
        // Senses sits adjacent to its sigil (Cloaking Blast's construction).
        parts.push(onRing(`modifiers/${g.mod}`, R_MOD, ang, MOD_W))
      } else {
        // Delay WRAPS its sigil (p8: "Expel with Delay" draws the brackets
        // around the arrow); Shape mods are set INTO the Shape sigil's slot.
        // Either way the mod shares the sigil's center AND final rotation so
        // the composite reads as one glyph.
        const cx = C + R_DAGGER * Math.sin(a)
        const cy = C - R_DAGGER * Math.cos(a)
        const w = g.mod === "delay" ? 205 : 40
        parts.push(place(`modifiers/${g.mod}`, cx, cy, w, ang + orient))
      }
    }
  })
  return parts.join("")
}

function ring(seal: Seal): string {
  if (seal.ring.plain) {
    return `<circle cx="${C}" cy="${C}" r="${R_PLAIN}" ${RING_STROKE}/>`
  }
  const parts = [
    `<circle cx="${C}" cy="${C}" r="${R_OUTER}" ${RING_STROKE}/>`,
    `<circle cx="${C}" cy="${C}" r="${R_INNER}" ${RING_STROKE}/>`,
  ]
  const targets = seal.ring.targets
  targets.forEach((t, i) => {
    const step = 360 / targets.length
    for (const base of [0, 180]) {
      // each target appears twice for symmetry (author's rings repeat strips)
      const ang = base + i * (step / 2)
      parts.push(onRing(`targets/${t}`, R_BAND, ang, TARGET_W))
    }
  })
  seal.ring.qualifiers.forEach((q, i) => {
    for (const k of [0, 1, 2, 3]) {
      parts.push(onRing(`elements/${q}`, R_BAND, 45 + i * 22.5 + k * 90, QUAL_H, "h"))
    }
  })
  if (seal.ring.trigger !== "none") {
    for (const k of [0, 1, 2, 3]) {
      parts.push(onRing(`triggers/${seal.ring.trigger}`, R_BAND, 22.5 + k * 90, TRIGGER_W))
    }
  }
  return parts.join("")
}

export function compose(seal: Seal): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">` +
    ring(seal) +
    heart(seal) +
    daggers(seal) +
    `</svg>`
  )
}

export function composeForSave(seal: Seal, bg: "white" | "transparent"): string {
  let svg = compose(seal).replace(/currentColor/g, "#000000")
  if (bg === "white") {
    svg = svg.replace(">", `><rect width="1000" height="1000" fill="#ffffff"/>`)
  }
  return svg
}
