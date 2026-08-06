// CAUTION: the word "e" + "xport" must NEVER appear anywhere in this file,
// not even in a comment or class-name string. Quartz's inline-script-loader
// (quartz/cli/handlers.js) strips the first literal occurrence from the
// source before bundling, which silently corrupts whatever contains it
// (found 2026-08-06 when ".sc-e*-preview" became ".sc--preview").
import { CANON, findCanon } from "./sealcarver/canon"
import { compose, composeForSave } from "./sealcarver/compose"
import { autoName, ELEMENT_NAMES } from "./sealcarver/naming"
import { decodeSeal, encodeSeal } from "./sealcarver/serialize"
import { SIGILS } from "./sealcarver/sigils.gen"
import { signature } from "./sealcarver/signature"
import {
  DAGGERS,
  DaggerId,
  DaggerMod,
  ELEMENTS,
  ElementId,
  MAX_DAGGER_GROUPS,
  MAX_RING_QUALIFIERS,
  MAX_RING_TARGETS,
  Seal,
  TARGETS,
  TargetId,
  TriggerId,
  defaultSeal,
  isValidSeal,
} from "./sealcarver/types"

const STORAGE_KEY = "althas-sealcarver-v1"
const SAVE_SIZE = 2000

// UI copy (short imperative labels; naming.ts nouns are for generated names)
const DAGGER_LABELS: Record<DaggerId, string> = {
  absorption: "Absorb",
  expel: "Expel",
  surround: "Surround",
  grasp: "Grasp",
  break: "Break",
  shape: "Shape",
  disperse: "Disperse",
  fuse: "Fuse",
  transfer: "Transfer",
  "movement-directional": "Move (one way)",
  "movement-omnidirectional": "Move (free)",
  "movement-omnidirectional-surface": "Move (surface)",
  wall: "Wall",
  solidify: "Solidify",
  seek: "Seek",
  compress: "Compress",
}
const MOD_LABELS: Record<DaggerMod, string> = {
  none: "Plain",
  delay: "Delay",
  senses: "Senses",
  "shape-sphere": "Sphere",
  "shape-teardrop": "Teardrop",
}
const TARGET_LABELS: Record<TargetId, string> = {
  caster: "The Caster",
  sensed: "Sensed",
  thought: "In Thought",
  touched: "Touched",
  close: "Nearby",
}
const TRIGGER_LABELS: Record<Exclude<TriggerId, "none">, string> = {
  "casters-will": "Caster's Will",
  "targets-will": "Target's Will",
}

function iconFor(element: ElementId): string {
  return element === "caster-self" ? "targets/caster" : `elements/${element}`
}

function miniSvg(key: string): string {
  const a = SIGILS[key]
  if (!a) return ""
  return `<svg viewBox="0 0 ${a.w} ${a.h}" aria-hidden="true">${a.body}</svg>`
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
}

function clone(s: Seal): Seal {
  return JSON.parse(JSON.stringify(s)) as Seal
}

function loadInitial(): Seal {
  const fromUrl = new URLSearchParams(window.location.search).get("seal")
  if (fromUrl) {
    const s = decodeSeal(fromUrl)
    if (s) return s
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const s = decodeSeal(stored)
      if (s) return s
    }
  } catch {
    // storage unavailable: start fresh
  }
  return defaultSeal()
}

function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)]
}

function randomSeal(): Seal {
  const roll = Math.random()
  const nGroups = roll < 0.6 ? 1 : roll < 0.9 ? 2 : 3
  const normalElements = ELEMENTS.filter((e) => e !== "caster-self" && e !== "nature-blank")
  const seal: Seal = {
    heart: {
      element: Math.random() < 0.05 ? "caster-self" : pick(normalElements),
      mode: Math.random() < 0.5 ? "create" : "manipulate",
      wrap: Math.random() < 0.25 ? "loop" : Math.random() < 0.13 ? "reset" : "none",
    },
    daggers: Array.from({ length: nGroups }, () => ({
      dagger: pick(DAGGERS),
      mod: (Math.random() < 0.15 ? pick(["delay", "senses"]) : "none") as DaggerMod,
      count: pick([2, 3, 4, 4]),
      placement: (Math.random() < 0.15 ? "directional" : "symmetric") as "symmetric",
    })),
    ring:
      Math.random() < 0.4
        ? { plain: true, targets: [], qualifiers: [], trigger: "none" }
        : {
            plain: false,
            targets: [pick(TARGETS)],
            qualifiers:
              Math.random() < 0.6
                ? [pick(normalElements.filter((e) => !e.startsWith("nature-")))]
                : [],
            trigger: (Math.random() < 0.25
              ? pick(["casters-will", "targets-will"])
              : "none") as TriggerId,
          },
  }
  return isValidSeal(seal) ? seal : defaultSeal()
}

function setupSealcarver() {
  const root = document.querySelector<HTMLElement>(".sealcarver")
  if (!root) return

  const canvasEl = root.querySelector<HTMLElement>(".sc-canvas")!
  const nameEl = root.querySelector<HTMLElement>(".sc-name")!
  const heartEl = root.querySelector<HTMLElement>(".sc-zone-heart")!
  const daggersEl = root.querySelector<HTMLElement>(".sc-zone-daggers")!
  const ringEl = root.querySelector<HTMLElement>(".sc-zone-ring")!
  const galleryEl = root.querySelector<HTMLElement>(".sc-gallery")!
  const previewEl = root.querySelector<HTMLElement>(".sc-save-preview")!
  const shareBtn = root.querySelector<HTMLButtonElement>(".sc-share")!

  let seal = loadInitial()
  const galleryEntries = CANON.filter((c) => c.gallery)

  function sigilBtn(act: string, key: string, label: string, selected: boolean): string {
    return (
      `<button type="button" class="sc-sigil-btn${selected ? " sc-selected" : ""}" data-act="${esc(act)}">` +
      `${miniSvg(key)}<span>${esc(label)}</span></button>`
    )
  }
  function pill(act: string, label: string, selected: boolean): string {
    return `<button type="button" class="sc-pill${selected ? " sc-selected" : ""}" data-act="${esc(act)}">${esc(label)}</button>`
  }

  function renderHeartZone(): void {
    const h = seal.heart
    heartEl.innerHTML =
      `<div class="sc-grid">` +
      ELEMENTS.filter((e) => e !== "nature-blank")
        .map((e) => sigilBtn(`el:${e}`, iconFor(e), ELEMENT_NAMES[e], h.element === e))
        .join("") +
      `</div>` +
      `<div class="sc-row"><span class="sc-pill-group">` +
      pill("mode:create", "Create", h.mode === "create") +
      pill("mode:manipulate", "Manipulate", h.mode === "manipulate") +
      `</span><span class="sc-pill-group">` +
      pill("wrap:none", "Once", h.wrap === "none") +
      pill("wrap:loop", "Loop", h.wrap === "loop") +
      pill("wrap:reset", "Reset", h.wrap === "reset") +
      `</span></div>`
  }

  function renderDaggerZone(): void {
    const groups = seal.daggers
      .map((g, i) => {
        const grid = DAGGERS.map((d) =>
          sigilBtn(`g:${i}:dagger:${d}`, `functions/${d}`, DAGGER_LABELS[d], g.dagger === d),
        ).join("")
        const mods = (["none", "delay", "senses", "shape-sphere", "shape-teardrop"] as DaggerMod[])
          .map((m) => pill(`g:${i}:mod:${m}`, MOD_LABELS[m], g.mod === m))
          .join("")
        return (
          `<div class="sc-dagger-group"><div class="sc-group-head"><strong>Dagger set ${i + 1}</strong>` +
          (seal.daggers.length > 1 ? pill(`g:${i}:remove`, "Remove", false) : "") +
          `</div><div class="sc-grid">${grid}</div>` +
          `<div class="sc-row"><span class="sc-pill-group">${mods}</span>` +
          `<span class="sc-pill-group">` +
          pill(`g:${i}:count:-1`, "−", false) +
          `<span class="sc-pill" aria-label="count">×${g.count}</span>` +
          pill(`g:${i}:count:1`, "+", false) +
          `</span><span class="sc-pill-group">` +
          pill(`g:${i}:place:symmetric`, "Symmetric", g.placement === "symmetric") +
          pill(`g:${i}:place:directional`, "One-sided", g.placement === "directional") +
          `</span></div></div>`
        )
      })
      .join("")
    daggersEl.innerHTML =
      groups +
      (seal.daggers.length < MAX_DAGGER_GROUPS
        ? `<div class="sc-row">${pill("g:add", "+ Add a dagger set", false)}</div>`
        : "")
  }

  function renderRingZone(): void {
    const r = seal.ring
    let html =
      `<div class="sc-row"><span class="sc-pill-group">` +
      pill("ring:plain", "Plain ring (fires at once, nearest match)", r.plain) +
      pill("ring:detailed", "Carved ring (choose target and trigger)", !r.plain) +
      `</span></div>`
    if (!r.plain) {
      html +=
        `<div class="sc-row"><strong>Target</strong></div><div class="sc-grid">` +
        TARGETS.map((t) =>
          sigilBtn(`target:${t}`, `targets/${t}`, TARGET_LABELS[t], r.targets.includes(t)),
        ).join("") +
        `</div>` +
        `<div class="sc-row"><strong>Of their...</strong></div><div class="sc-grid">` +
        ELEMENTS.filter((e) => e !== "caster-self" && e !== "nature-blank")
          .map((e) => sigilBtn(`qual:${e}`, iconFor(e), ELEMENT_NAMES[e], r.qualifiers.includes(e)))
          .join("") +
        `</div>` +
        `<div class="sc-row"><strong>Trigger</strong><span class="sc-pill-group">` +
        pill("trigger:none", "At once", r.trigger === "none") +
        (["casters-will", "targets-will"] as const)
          .map((t) => pill(`trigger:${t}`, TRIGGER_LABELS[t], r.trigger === t))
          .join("") +
        `</span></div>`
    }
    ringEl.innerHTML = html
  }

  function renderGallery(): void {
    if (galleryEntries.length === 0) {
      galleryEl.parentElement!.style.display = "none"
      return
    }
    const byBook = new Map<string, typeof galleryEntries>()
    for (const c of galleryEntries) {
      const book = c.book ?? "Other"
      if (!byBook.has(book)) byBook.set(book, [])
      byBook.get(book)!.push(c)
    }
    let html = ""
    for (const [book, entries] of byBook) {
      html += `<h4 class="sc-gallery-book">${esc(book)}</h4>`
      html += entries
        .map((c) => {
          const idx = CANON.indexOf(c)
          return (
            `<button type="button" class="sc-gallery-card" data-act="load:${idx}">` +
            `${compose(c.seal)}<figcaption>${esc(c.name)}</figcaption></button>`
          )
        })
        .join("")
    }
    galleryEl.innerHTML = html
  }

  function render(): void {
    canvasEl.innerHTML = compose(seal)
    const canon = findCanon(signature(seal))
    if (canon) {
      nameEl.textContent = `✦ ${canon.name} · Level ${canon.level} ${canon.domain} ✦`
      nameEl.classList.add("sc-name-canon")
    } else {
      nameEl.textContent = autoName(seal)
      nameEl.classList.remove("sc-name-canon")
    }
    renderHeartZone()
    renderDaggerZone()
    renderRingZone()
    try {
      window.localStorage.setItem(STORAGE_KEY, encodeSeal(seal))
    } catch {
      // storage full or unavailable: sharing and saving still work
    }
  }

  function download(filename: string, href: string): void {
    // Programmatic downloads can be blocked in embedded browsers; treat the
    // click as best-effort and never let it break the flow around it.
    try {
      const a = document.createElement("a")
      a.href = href
      a.download = filename
      a.click()
    } catch {
      // the inline preview (PNG) or copied link still gives users a path
    }
  }

  function saveSvg(): void {
    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + composeForSave(seal, "transparent")
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    download("seal.svg", url)
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  function savePng(bg: "white" | "transparent"): void {
    const svg = composeForSave(seal, bg)
    const img = new Image()
    img.onload = () => {
      const c = document.createElement("canvas")
      c.width = SAVE_SIZE
      c.height = SAVE_SIZE
      const ctx = c.getContext("2d")!
      ctx.drawImage(img, 0, 0, SAVE_SIZE, SAVE_SIZE)
      const data = c.toDataURL("image/png")
      // preview FIRST (iOS long-press save path), download as best-effort:
      // a blocked download must never cost the user their image
      previewEl.innerHTML = `<img alt="Saved seal" src="${data}">`
      download("seal.png", data)
    }
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
  }

  function share(): void {
    const url = new URL(window.location.href)
    url.search = "?seal=" + encodeSeal(seal)
    url.hash = ""
    const flash = () => {
      const prev = shareBtn.textContent
      shareBtn.textContent = "Copied!"
      setTimeout(() => (shareBtn.textContent = prev), 1200)
    }
    navigator.clipboard.writeText(url.toString()).then(flash, flash)
  }

  function apply(act: string): void {
    const next = clone(seal)
    const [head, ...rest] = act.split(":")
    if (head === "el") next.heart.element = rest[0] as ElementId
    else if (head === "mode") next.heart.mode = rest[0] as "create"
    else if (head === "wrap") next.heart.wrap = rest[0] as "none"
    else if (head === "g") {
      if (rest[0] === "add") {
        if (next.daggers.length < MAX_DAGGER_GROUPS)
          next.daggers.push({ dagger: "surround", mod: "none", count: 4, placement: "symmetric" })
      } else {
        const i = parseInt(rest[0], 10)
        const g = next.daggers[i]
        if (!g) return
        if (rest[1] === "dagger") g.dagger = rest[2] as DaggerId
        else if (rest[1] === "mod") g.mod = rest[2] as DaggerMod
        else if (rest[1] === "count")
          g.count = Math.min(8, Math.max(1, g.count + parseInt(rest[2], 10)))
        else if (rest[1] === "place") g.placement = rest[2] as "symmetric"
        else if (rest[1] === "remove" && next.daggers.length > 1) next.daggers.splice(i, 1)
      }
    } else if (head === "ring") {
      if (rest[0] === "plain")
        next.ring = { plain: true, targets: [], qualifiers: [], trigger: "none" }
      else if (next.ring.plain)
        next.ring = { plain: false, targets: ["caster"], qualifiers: [], trigger: "none" }
    } else if (head === "target") {
      const t = rest[0] as TargetId
      const i = next.ring.targets.indexOf(t)
      if (i >= 0 && next.ring.targets.length > 1) next.ring.targets.splice(i, 1)
      else if (i < 0 && next.ring.targets.length < MAX_RING_TARGETS) next.ring.targets.push(t)
    } else if (head === "qual") {
      const q = rest[0] as ElementId
      const i = next.ring.qualifiers.indexOf(q)
      if (i >= 0) next.ring.qualifiers.splice(i, 1)
      else if (next.ring.qualifiers.length < MAX_RING_QUALIFIERS) next.ring.qualifiers.push(q)
    } else if (head === "trigger") {
      next.ring.trigger = rest.join(":") === "none" ? "none" : (rest.join(":") as TriggerId)
    } else if (head === "load") {
      const c = CANON[parseInt(rest[0], 10)]
      if (c) {
        seal = clone(c.seal)
        render()
        canvasEl.scrollIntoView({ behavior: "smooth", block: "center" })
        return
      }
    } else if (head === "surprise") {
      seal = randomSeal()
      render()
      return
    }
    if (isValidSeal(next)) {
      seal = next
      render()
    }
  }

  function onClick(e: MouseEvent): void {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-act]")
    if (btn && root!.contains(btn)) {
      apply(btn.dataset.act!)
      return
    }
    const t = (e.target as HTMLElement).closest<HTMLElement>("button")
    if (!t || !root!.contains(t)) return
    if (t.classList.contains("sc-surprise")) apply("surprise")
    else if (t.classList.contains("sc-share")) share()
    else if (t.classList.contains("sc-save-svg")) saveSvg()
    else if (t.classList.contains("sc-save-png")) savePng("white")
    else if (t.classList.contains("sc-save-png-t")) savePng("transparent")
  }

  root.addEventListener("click", onClick)
  window.addCleanup(() => root.removeEventListener("click", onClick))

  renderGallery()
  render()
}

document.addEventListener("nav", () => {
  setupSealcarver()
})
