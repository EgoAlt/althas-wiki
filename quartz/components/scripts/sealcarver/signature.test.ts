import assert from "node:assert/strict"
import { test } from "node:test"
import { signature } from "./signature"
import { Seal, defaultSeal } from "./types"

function flightish(): Seal {
  return {
    heart: { element: "body", mode: "manipulate", wrap: "loop" },
    daggers: [
      { dagger: "movement-omnidirectional", mod: "none", count: 4, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["caster"], qualifiers: ["body"], trigger: "none" },
  }
}

test("dagger count is decorative: 3 vs 4 identical", () => {
  const a = flightish()
  const b = flightish()
  b.daggers[0].count = 3
  assert.equal(signature(a), signature(b))
})

test("dagger group order does not matter", () => {
  const a = flightish()
  a.daggers.push({ dagger: "surround", mod: "none", count: 2, placement: "symmetric" })
  const b = flightish()
  b.daggers.unshift({ dagger: "surround", mod: "none", count: 6, placement: "symmetric" })
  assert.equal(signature(a), signature(b))
})

test("identical groups dedupe", () => {
  const a = flightish()
  const b = flightish()
  b.daggers.push({ ...b.daggers[0] })
  assert.equal(signature(a), signature(b))
})

test("mod changes the signature", () => {
  const a = flightish()
  const b = flightish()
  b.daggers[0].mod = "delay"
  assert.notEqual(signature(a), signature(b))
})

test("placement changes the signature", () => {
  const a = flightish()
  const b = flightish()
  b.daggers[0].placement = "directional"
  assert.notEqual(signature(a), signature(b))
})

test("plain vs detailed ring differ", () => {
  const a = defaultSeal()
  const b = defaultSeal()
  b.ring = { plain: false, targets: ["caster"], qualifiers: [], trigger: "none" }
  assert.notEqual(signature(a), signature(b))
})

test("qualifier set matters", () => {
  const a = flightish()
  const b = flightish()
  b.ring.qualifiers = ["mind"]
  assert.notEqual(signature(a), signature(b))
})

test("target order does not matter", () => {
  const a = flightish()
  a.ring.targets = ["caster", "sensed"]
  const b = flightish()
  b.ring.targets = ["sensed", "caster"]
  assert.equal(signature(a), signature(b))
})
