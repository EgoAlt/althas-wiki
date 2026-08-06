import assert from "node:assert/strict"
import { test } from "node:test"
import { CANON, findCanon } from "./canon"
import { signature } from "./signature"
import { Seal, isValidSeal } from "./types"

test("thirteen Arcana entries", () => {
  assert.equal(CANON.filter((c) => c.domain === "Arcana").length, 13)
})

test("every canon seal is valid", () => {
  for (const c of CANON) {
    assert.equal(isValidSeal(c.seal), true, `${c.name} is invalid`)
  }
})

test("all canon signatures are pairwise distinct", () => {
  const sigs = CANON.map((c) => signature(c.seal))
  const dupes = sigs.filter((s, i) => sigs.indexOf(s) !== i)
  assert.deepEqual(dupes, [], `colliding signatures: ${dupes.join(" ; ")}`)
})

test("findCanon matches Flight at a different dagger count", () => {
  const flight: Seal = {
    heart: { element: "body", mode: "manipulate", wrap: "loop" },
    // canon table uses count 4; a player using 6 still discovers Flight
    daggers: [
      { dagger: "movement-omnidirectional", mod: "none", count: 6, placement: "symmetric" },
    ],
    ring: { plain: false, targets: ["caster"], qualifiers: ["body"], trigger: "none" },
  }
  assert.equal(findCanon(signature(flight))?.name, "Flight")
})

test("findCanon returns undefined for a non-canon seal", () => {
  const s: Seal = {
    heart: { element: "nature-plant", mode: "create", wrap: "reset" },
    daggers: [{ dagger: "wall", mod: "senses", count: 3, placement: "symmetric" }],
    ring: { plain: true, targets: [], qualifiers: [], trigger: "none" },
  }
  assert.equal(findCanon(signature(s)), undefined)
})

test("Arcana entries are hidden from the gallery", () => {
  for (const c of CANON.filter((c) => c.domain === "Arcana")) {
    assert.equal(c.gallery, false, `${c.name} must not spoil the discovery pool`)
  }
})
