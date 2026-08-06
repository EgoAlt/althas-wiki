import { signature } from "./signature"
import { Seal } from "./types"

// Canon seal table. Arcana entries transcribe the worked circles in the
// Codex of Arcane Arts (Roc Humet Vidal, CC-BY 4.0), levels 1-10, single
// circles only. gallery:false keeps them out of the Codex Seals gallery so
// they stay a hidden discovery pool.
//
// Excluded Arcana spells and why:
// - Chain Lightning: Compress modifiers wrap the HEART and extra imprint
//   sigils feed the target; exceeds the single-circle grammar model.
// - Floating Eye, Telekinesis, Rift Walker, Cloaking Blast, Arcane
//   Reflection, Confusing Aura, Sensory Projection, Falling Sky 1+2:
//   compound / multi-circle constructions, planned for the compound update.

export interface CanonSeal {
  name: string
  level: number
  domain: "Arcana" | "Codex"
  book?: string
  gallery: boolean
  seal: Seal
}

const arcana = (name: string, level: number, seal: Seal): CanonSeal => ({
  name,
  level,
  domain: "Arcana",
  gallery: false,
  seal,
})

export const CANON: CanonSeal[] = [
  arcana("Rune Ward", 1, {
    heart: { element: "magic", mode: "create", wrap: "loop" },
    daggers: [
      { dagger: "surround", mod: "none", count: 2, placement: "symmetric" },
      { dagger: "wall", mod: "none", count: 2, placement: "symmetric" },
      { dagger: "break", mod: "none", count: 4, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["thought"], qualifiers: [], trigger: "none" },
  }),
  arcana("Unleash Chaos", 1, {
    heart: { element: "magic", mode: "manipulate", wrap: "none" },
    daggers: [
      { dagger: "absorption", mod: "none", count: 3, placement: "symmetric" },
      { dagger: "expel", mod: "delay", count: 3, placement: "directional" },
    ],
    ring: { plain: false, targets: ["caster"], qualifiers: ["mind"], trigger: "none" },
  }),
  arcana("Wall Walk", 1, {
    heart: { element: "body", mode: "manipulate", wrap: "loop" },
    daggers: [
      { dagger: "movement-omnidirectional-surface", mod: "none", count: 4, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["touched"], qualifiers: ["body"], trigger: "targets-will" },
  }),
  arcana("Cinder Grasp", 2, {
    heart: { element: "nature-fire", mode: "create", wrap: "none" },
    daggers: [{ dagger: "grasp", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["thought"], qualifiers: ["body"], trigger: "none" },
  }),
  arcana("Instant Counterspell", 3, {
    heart: { element: "magic", mode: "manipulate", wrap: "none" },
    daggers: [{ dagger: "break", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["thought"], qualifiers: [], trigger: "casters-will" },
  }),
  arcana("Simple Counterspell", 3, {
    heart: { element: "magic", mode: "manipulate", wrap: "none" },
    daggers: [{ dagger: "break", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: true, targets: [], qualifiers: [], trigger: "none" },
  }),
  arcana("Flight", 3, {
    heart: { element: "body", mode: "manipulate", wrap: "loop" },
    daggers: [{ dagger: "movement-omnidirectional", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["caster"], qualifiers: ["body"], trigger: "none" },
  }),
  arcana("Blink Out", 4, {
    heart: { element: "caster-self", mode: "manipulate", wrap: "none" },
    daggers: [{ dagger: "surround", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["sensed"], qualifiers: ["space"], trigger: "none" },
  }),
  arcana("Preservation Blast 1", 4, {
    heart: { element: "magic", mode: "create", wrap: "none" },
    daggers: [{ dagger: "expel", mod: "none", count: 6, placement: "symmetric" }],
    ring: { plain: true, targets: [], qualifiers: [], trigger: "none" },
  }),
  arcana("Preservation Blast 2", 4, {
    heart: { element: "magic", mode: "manipulate", wrap: "none" },
    daggers: [
      { dagger: "absorption", mod: "none", count: 3, placement: "symmetric" },
      { dagger: "expel", mod: "none", count: 3, placement: "symmetric" },
    ],
    ring: { plain: true, targets: [], qualifiers: [], trigger: "none" },
  }),
  arcana("Premonition", 5, {
    heart: { element: "time", mode: "manipulate", wrap: "none" },
    daggers: [
      { dagger: "movement-directional", mod: "none", count: 4, placement: "symmetric" },
      { dagger: "surround", mod: "none", count: 4, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["caster"], qualifiers: ["mind"], trigger: "casters-will" },
  }),
  arcana("Earthquake", 9, {
    heart: { element: "nature-earth", mode: "manipulate", wrap: "reset" },
    daggers: [
      { dagger: "compress", mod: "none", count: 3, placement: "symmetric" },
      { dagger: "break", mod: "delay", count: 3, placement: "symmetric" },
      { dagger: "movement-omnidirectional", mod: "none", count: 3, placement: "symmetric" },
    ],
    ring: { plain: true, targets: [], qualifiers: [], trigger: "none" },
  }),
  arcana("Adjust Reality", 10, {
    heart: { element: "time", mode: "manipulate", wrap: "none" },
    daggers: [{ dagger: "seek", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["thought"], qualifiers: ["time"], trigger: "none" },
  }),
]

let index: Map<string, CanonSeal> | undefined

export function findCanon(sig: string): CanonSeal | undefined {
  if (!index) {
    index = new Map(CANON.map((c) => [signature(c.seal), c]))
  }
  return index.get(sig)
}
