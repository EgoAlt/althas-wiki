import { Seal } from "./types"

// Canonical structural signature of a seal. Order-insensitive and
// count-insensitive: the source treats how MANY of a dagger you draw as
// aesthetic, so recognition matches on dagger type + modifier + placement
// only. A future compound extension prefixes a circle index per segment and
// appends link edges; this single-circle format stays a valid sub-string.
export function signature(seal: Seal): string {
  const h = `${seal.heart.element}/${seal.heart.mode}/${seal.heart.wrap}`
  const d = [...new Set(seal.daggers.map((g) => `${g.dagger}.${g.mod}.${g.placement}`))]
    .sort()
    .join("+")
  const r = seal.ring.plain
    ? "plain"
    : `t:${[...seal.ring.targets].sort().join(",")}|q:${[...seal.ring.qualifiers].sort().join(",")}|x:${seal.ring.trigger}`
  return `${h}//${d}//${r}`
}
