// Sealcarver grammar model: the Codex of Arcane Arts magic-circle vocabulary
// (Heart / Daggers / Ring) as data. Single circles only; the compound-seal
// extension planned for later adds circle indices and link edges around this
// model rather than changing it.

export type ElementId =
  | "body"
  | "mind"
  | "space"
  | "time"
  | "magic"
  | "caster-self" // Blink Out's Heart uses the Caster sigil itself
  | "nature-blank"
  | "nature-air"
  | "nature-earth"
  | "nature-metal"
  | "nature-plant"
  | "nature-water"
  | "nature-light"
  | "nature-fire"
export type HeartMode = "create" | "manipulate"
export type HeartWrap = "none" | "loop" | "reset"
export type DaggerId =
  | "absorption"
  | "expel"
  | "surround"
  | "grasp"
  | "break"
  | "shape"
  | "disperse"
  | "fuse"
  | "transfer"
  | "movement-directional"
  | "movement-omnidirectional"
  | "movement-omnidirectional-surface"
  | "wall"
  | "solidify"
  | "seek"
  | "compress"
export type DaggerMod = "none" | "delay" | "senses" | "shape-sphere" | "shape-teardrop"
export type Placement = "symmetric" | "directional"
export interface DaggerGroup {
  dagger: DaggerId
  mod: DaggerMod
  count: number
  placement: Placement
}
export type TargetId = "caster" | "sensed" | "thought" | "touched" | "close"
export type TriggerId = "none" | "casters-will" | "targets-will"
export interface Ring {
  plain: boolean
  targets: TargetId[]
  qualifiers: ElementId[]
  trigger: TriggerId
}
export interface Seal {
  heart: { element: ElementId; mode: HeartMode; wrap: HeartWrap }
  daggers: DaggerGroup[]
  ring: Ring
}

export const ELEMENTS: ElementId[] = [
  "body",
  "mind",
  "space",
  "time",
  "magic",
  "caster-self",
  "nature-blank",
  "nature-air",
  "nature-earth",
  "nature-metal",
  "nature-plant",
  "nature-water",
  "nature-light",
  "nature-fire",
]
export const DAGGERS: DaggerId[] = [
  "absorption",
  "expel",
  "surround",
  "grasp",
  "break",
  "shape",
  "disperse",
  "fuse",
  "transfer",
  "movement-directional",
  "movement-omnidirectional",
  "movement-omnidirectional-surface",
  "wall",
  "solidify",
  "seek",
  "compress",
]
export const DAGGER_MODS: DaggerMod[] = [
  "none",
  "delay",
  "senses",
  "shape-sphere",
  "shape-teardrop",
]
export const TARGETS: TargetId[] = ["caster", "sensed", "thought", "touched", "close"]
export const TRIGGERS: TriggerId[] = ["none", "casters-will", "targets-will"]
export const MAX_DAGGER_GROUPS = 3
export const MAX_RING_TARGETS = 2
export const MAX_RING_QUALIFIERS = 2

function uniq<T>(xs: T[]): boolean {
  return new Set(xs).size === xs.length
}

export function isValidSeal(s: Seal): boolean {
  if (!ELEMENTS.includes(s.heart.element)) return false
  if (s.heart.mode !== "create" && s.heart.mode !== "manipulate") return false
  if (!["none", "loop", "reset"].includes(s.heart.wrap)) return false
  if (s.daggers.length < 1 || s.daggers.length > MAX_DAGGER_GROUPS) return false
  for (const g of s.daggers) {
    if (!DAGGERS.includes(g.dagger)) return false
    if (!DAGGER_MODS.includes(g.mod)) return false
    if (!Number.isInteger(g.count) || g.count < 1 || g.count > 8) return false
    if (g.placement !== "symmetric" && g.placement !== "directional") return false
  }
  const r = s.ring
  if (r.plain) {
    return r.targets.length === 0 && r.qualifiers.length === 0 && r.trigger === "none"
  }
  if (r.targets.length < 1 || r.targets.length > MAX_RING_TARGETS) return false
  if (!uniq(r.targets) || r.targets.some((t) => !TARGETS.includes(t))) return false
  if (r.qualifiers.length > MAX_RING_QUALIFIERS) return false
  if (!uniq(r.qualifiers)) return false
  if (r.qualifiers.some((q) => q === "caster-self" || !ELEMENTS.includes(q))) return false
  if (!TRIGGERS.includes(r.trigger)) return false
  return true
}

export function defaultSeal(): Seal {
  return {
    heart: { element: "nature-fire", mode: "create", wrap: "none" },
    daggers: [{ dagger: "expel", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: true, targets: [], qualifiers: [], trigger: "none" },
  }
}
