import assert from "node:assert/strict"
import { test } from "node:test"
import { Seal, defaultSeal, isValidSeal, MAX_DAGGER_GROUPS } from "./types"

test("defaultSeal is valid", () => {
  assert.equal(isValidSeal(defaultSeal()), true)
})

test("rejects zero dagger groups", () => {
  const s = defaultSeal()
  s.daggers = []
  assert.equal(isValidSeal(s), false)
})

test("rejects more than MAX_DAGGER_GROUPS groups", () => {
  const s = defaultSeal()
  const g = { ...s.daggers[0] }
  s.daggers = Array.from({ length: MAX_DAGGER_GROUPS + 1 }, () => ({ ...g }))
  assert.equal(isValidSeal(s), false)
})

test("rejects count outside 1..8", () => {
  const s = defaultSeal()
  s.daggers[0].count = 0
  assert.equal(isValidSeal(s), false)
  s.daggers[0].count = 9
  assert.equal(isValidSeal(s), false)
})

test("rejects caster-self as a ring qualifier", () => {
  const s: Seal = {
    heart: { element: "magic", mode: "create", wrap: "none" },
    daggers: [{ dagger: "expel", mod: "none", count: 4, placement: "symmetric" }],
    ring: { plain: false, targets: ["caster"], qualifiers: ["caster-self"], trigger: "none" },
  }
  assert.equal(isValidSeal(s), false)
})

test("plain ring must carry no targets, qualifiers or trigger", () => {
  const s = defaultSeal()
  s.ring = { plain: true, targets: ["caster"], qualifiers: [], trigger: "none" }
  assert.equal(isValidSeal(s), false)
  s.ring = { plain: true, targets: [], qualifiers: [], trigger: "casters-will" }
  assert.equal(isValidSeal(s), false)
})

test("detailed ring needs at least one target", () => {
  const s = defaultSeal()
  s.ring = { plain: false, targets: [], qualifiers: [], trigger: "none" }
  assert.equal(isValidSeal(s), false)
})

test("rejects duplicate targets", () => {
  const s = defaultSeal()
  s.ring = { plain: false, targets: ["caster", "caster"], qualifiers: [], trigger: "none" }
  assert.equal(isValidSeal(s), false)
})
