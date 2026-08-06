import assert from "node:assert/strict"
import { test } from "node:test"
import { decodeSeal, encodeSeal } from "./serialize"
import { Seal, defaultSeal } from "./types"

test("roundtrip identity for the default seal", () => {
  const s = defaultSeal()
  assert.deepEqual(decodeSeal(encodeSeal(s)), s)
})

test("roundtrip identity for a maximal seal", () => {
  const s: Seal = {
    heart: { element: "caster-self", mode: "manipulate", wrap: "reset" },
    daggers: [
      { dagger: "absorption", mod: "senses", count: 3, placement: "symmetric" },
      { dagger: "expel", mod: "delay", count: 5, placement: "directional" },
      { dagger: "seek", mod: "shape-teardrop", count: 8, placement: "symmetric" },
    ],
    ring: {
      plain: false,
      targets: ["caster", "thought"],
      qualifiers: ["mind", "time"],
      trigger: "targets-will",
    },
  }
  assert.deepEqual(decodeSeal(encodeSeal(s)), s)
})

test("encoded string is URL-safe", () => {
  assert.match(encodeSeal(defaultSeal()), /^[A-Za-z0-9_-]+$/)
})

test("garbage returns null", () => {
  assert.equal(decodeSeal("!!!not-base64!!!"), null)
})

test("valid base64 of wrong JSON returns null", () => {
  const b64 = Buffer.from('{"evil":1}').toString("base64url")
  assert.equal(decodeSeal(b64), null)
})

test("valid JSON but invalid seal returns null", () => {
  const s = defaultSeal() as unknown as { daggers: unknown[] }
  s.daggers = []
  const b64 = Buffer.from(JSON.stringify(s)).toString("base64url")
  assert.equal(decodeSeal(b64), null)
})
