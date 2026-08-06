import assert from "node:assert/strict"
import { test } from "node:test"
import { compose, composeForExport } from "./compose"
import { SIGILS } from "./sigils.gen"
import { Seal, defaultSeal } from "./types"

function detailed(): Seal {
  return {
    heart: { element: "body", mode: "manipulate", wrap: "loop" },
    daggers: [
      { dagger: "movement-omnidirectional", mod: "none", count: 4, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["caster"], qualifiers: ["body"], trigger: "casters-will" },
  }
}

test("output is a self-contained themed svg", () => {
  const svg = compose(detailed())
  assert.ok(svg.startsWith("<svg"))
  assert.ok(svg.includes('viewBox="0 0 1000 1000"'))
  assert.ok(!svg.includes("stroke:black"))
  assert.ok(!svg.includes("<image"))
  assert.ok(!svg.includes("xlink:href"))
  assert.ok(svg.includes("currentColor"))
})

test("a 4-count symmetric group embeds its sigil exactly 4 times", () => {
  const svg = compose(detailed())
  // strip stroke-width rescaling before counting verbatim bodies
  const norm = (s: string) => s.replace(/stroke-width:[\d.]+px/g, "SW")
  const body = norm(SIGILS["functions/movement-omnidirectional"].body)
  const hay = norm(svg)
  let n = 0
  for (let i = hay.indexOf(body); i !== -1; i = hay.indexOf(body, i + 1)) n++
  assert.equal(n, 4)
})

test("detailed ring emits two circles, plain ring one", () => {
  const twoRings = compose(detailed())
  assert.equal((twoRings.match(/<circle/g) ?? []).length >= 2, true)
  const plain = compose(defaultSeal())
  const own = (plain.match(/r="453"/g) ?? []).length
  assert.equal(own, 1)
})

test("trigger sigils appear when set", () => {
  const withTrigger = compose(detailed())
  const norm = (s: string) => s.replace(/stroke-width:[\d.]+px/g, "SW")
  assert.ok(norm(withTrigger).includes(norm(SIGILS["triggers/casters-will"].body)))
})

test("export variants are theme independent", () => {
  const white = composeForExport(detailed(), "white")
  assert.ok(white.includes("<rect"))
  assert.ok(white.includes("#000000"))
  assert.ok(!white.includes("currentColor"))
  const transparent = composeForExport(detailed(), "transparent")
  assert.ok(!transparent.includes("<rect"))
  assert.ok(!transparent.includes("currentColor"))
})

test("caster-self heart composes without pre-composed asset", () => {
  const s = detailed()
  s.heart = { element: "caster-self", mode: "manipulate", wrap: "none" }
  const svg = compose(s)
  const norm = (x: string) => x.replace(/stroke-width:[\d.]+px/g, "SW")
  assert.ok(norm(svg).includes(norm(SIGILS["targets/caster"].body)))
  assert.ok(norm(svg).includes(norm(SIGILS["modifiers/manipulate"].body)))
})
