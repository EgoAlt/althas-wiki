import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  Simulation,
  SimulationNodeDatum,
  select,
  drag,
} from "d3"

// Diplomacy force graph. Parses the page's diplomacy-graph block (raw text in
// data-graph, set by plugins/transformers/diplomacygraph.ts), hides the code
// block, and renders an SVG force layout in its place. Grammar must stay
// equivalent to scripts/check-diplomacy-graph.py in the site repo; like that
// gate's public-edge check, edges whose endpoints have no node declaration in
// the block are treated as a parse failure. On any parse failure: leave the
// code block visible and bail (it doubles as the no-JS fallback). Element
// listeners rebind per "nav"; window.addCleanup for anything document/window-
// level.
//
// Imports come from "d3" (not the d3-force/d3-selection/d3-drag subpaths):
// the site already bundles d3 this way in graph.inline.ts, and it keeps the
// esbuild inline-script pipeline happy.

const KNOWN_TYPES = ["governance", "war-history", "alliance", "rivalry", "uneasy"]
const NODE_RE = /^node\s+([a-z0-9-]+)\s*\|\s*([^|]+?)\s*\|\s*([a-z-]+)\s*\|\s*(\S+)\s*$/
const EDGE_RE = /^edge\s+([a-z0-9-]+)\s*(->|<->)\s*([a-z0-9-]+)\s*\|\s*([a-z-]+)\s*\|\s*(.+?)\s*$/

type GNode = { id: string; name: string; kind: string; path: string } & SimulationNodeDatum
type GEdge = {
  source: string | GNode
  target: string | GNode
  mutual: boolean
  etype: string
  label: string
}

function parseGraph(text: string): { nodes: GNode[]; edges: GEdge[] } | null {
  const nodes: GNode[] = []
  const edges: GEdge[] = []
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const n = NODE_RE.exec(line)
    if (n) {
      nodes.push({ id: n[1], name: n[2], kind: n[3], path: n[4] })
      continue
    }
    const e = EDGE_RE.exec(line)
    if (e) {
      edges.push({ source: e[1], target: e[3], mutual: e[2] === "<->", etype: e[4], label: e[5] })
      continue
    }
    console.warn("diplomacy-graph: unparseable line, leaving text block visible:", line)
    return null
  }
  // Referential check, mirroring check-diplomacy-graph.py's "public edge
  // references non-public node" error: a grammar-valid edge whose endpoint
  // has no node declaration would otherwise pass parsing, hide the code
  // block, and then throw inside d3's forceLink id lookup, leaving a dead
  // half-rendered page. Fail closed here instead.
  const ids = new Set(nodes.map((n) => n.id))
  for (const e of edges) {
    if (!ids.has(e.source as string) || !ids.has(e.target as string)) {
      console.warn(
        "diplomacy-graph: edge references undeclared node, leaving text block visible:",
        e.source,
        "->",
        e.target,
      )
      return null
    }
  }
  return nodes.length ? { nodes, edges } : null
}

const RADIUS: Record<string, number> = { nation: 22, institution: 16, people: 12 }

function setupDiplomacyGraph() {
  const mount = document.querySelector<HTMLElement>(".diplomacy-graph-mount")
  const codeEl = document.querySelector<HTMLElement>(
    "code.diplomacy-graph-data[data-graph], [data-graph]",
  )
  if (!mount || !codeEl) return
  // If the mount already holds an SVG, a previous run rendered here. Guard
  // against double-mounting on repeated "nav" events for the same page.
  if (mount.querySelector("svg")) return
  const parsed = parseGraph(codeEl.dataset.graph ?? codeEl.getAttribute("data-graph") ?? "")
  if (!parsed) return
  const { nodes, edges } = parsed

  // Place the graph where the code block sits in the article, then hide it.
  const pre = codeEl.closest("pre, figure") ?? codeEl
  pre.insertAdjacentElement("beforebegin", mount)
  ;(pre as HTMLElement).style.display = "none"

  // Fixed logical coordinate space for the viewBox and the force layout. The
  // SVG scales to the container via CSS (max-width:100%, height:auto), so this
  // only sets the layout's aspect ratio and node spacing. It deliberately does
  // NOT read mount.clientWidth: at "nav" time that measurement is unreliable
  // (it came back far too narrow, collapsing the graph into a tall strip), and
  // a fixed landscape box renders identically regardless of when the script
  // runs.
  const width = 920
  const height = 600
  const svg = select(mount)
    .append("svg")
    .attr("class", "diplomacy-svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Diplomacy web of Althas")

  const caption = document.createElement("div")
  caption.className = "diplomacy-caption"
  caption.textContent = "Hover or tap a power to focus its connections."
  mount.appendChild(caption)

  const typeClass = (t: string) => (KNOWN_TYPES.includes(t) ? `type-${t}` : "type-other")

  const link = svg
    .append("g")
    .selectAll("line")
    .data(edges)
    .join("line")
    .attr("class", (d) => `dg-edge ${typeClass(d.etype)}`)

  // Relationship label sitting on each connecting line (always visible, at the
  // edge midpoint, kept centered in tick()). A --light halo (paint-order stroke
  // in the stylesheet) keeps it legible where it crosses a colored edge. Drawn
  // after the edges so it reads above them; pointer-events:none so it never
  // steals the edge/node hover and drag handlers.
  const edgeLabel = svg
    .append("g")
    .attr("class", "dg-edge-labels")
    .selectAll("text")
    .data(edges)
    .join("text")
    .attr("class", "dg-edge-label")
    .text((d) => d.label)

  const node = svg
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", (d) => `dg-node kind-${d.kind}`)
  node.append("circle").attr("r", (d) => RADIUS[d.kind] ?? 14)
  node
    .append("text")
    .attr("dy", (d) => (RADIUS[d.kind] ?? 14) + 14)
    .text((d) => d.name)

  // Keep name labels readable at every width. The SVG scales to the article
  // column (rendered px = user units * renderedWidth / 760), so at mobile
  // widths the stylesheet's 12-unit default would render around 5px. Measure
  // the actual scale and compensate so labels render at roughly 10px, capped
  // so desktop (scale ~0.83, ~10px rendered already) stays effectively
  // unchanged and tiny panes cannot balloon the text. The inline style wins
  // over the stylesheet default. Runs immediately, then again on two settle
  // timers (layout is not always final at "nav" time, which is why the
  // viewBox is fixed rather than measured), and on window resize. Plain
  // timers on purpose: rAF and ResizeObserver callbacks proved unreliable in
  // embedded panes, while timers and resize listeners fire everywhere. All
  // torn down in the cleanup below.
  const labelResize = () => {
    const rendered = (svg.node() as SVGSVGElement).getBoundingClientRect().width
    if (!rendered) return
    const scale = rendered / width
    const fs = Math.min(Math.max(12, 10 / scale), 26)
    node.selectAll<SVGTextElement, GNode>("text").style("font-size", `${fs}px`)
    // Edge labels a touch smaller than node names, same compensation so they
    // don't collapse to ~5px at mobile widths.
    const efs = Math.min(Math.max(11, 9 / scale), 22)
    edgeLabel.style("font-size", `${efs}px`)
  }
  labelResize()
  const labelTimers = [window.setTimeout(labelResize, 150), window.setTimeout(labelResize, 600)]
  window.addEventListener("resize", labelResize)

  const sim: Simulation<GNode, undefined> = forceSimulation(nodes)
    // Spacing tuned so the always-visible edge labels have room: a longer link
    // distance and stronger repulsion spread the tight war-cluster (Armada /
    // Polaris / Jesthaen) whose midpoint labels otherwise overlap into an
    // unreadable pile. Nodes stay draggable to separate any that still crowd.
    .force("charge", forceManyBody().strength(-620))
    .force("center", forceCenter(width / 2, height / 2))
    .force(
      "link",
      forceLink<GNode, GEdge>(edges)
        .id((d) => d.id)
        .distance(175),
    )
    .force("collide", forceCollide<GNode>((d) => (RADIUS[d.kind] ?? 14) + 34))

  function tick() {
    link
      .attr("x1", (d) => (d.source as GNode).x!)
      .attr("y1", (d) => (d.source as GNode).y!)
      .attr("x2", (d) => (d.target as GNode).x!)
      .attr("y2", (d) => (d.target as GNode).y!)
    edgeLabel
      .attr("x", (d) => ((d.source as GNode).x! + (d.target as GNode).x!) / 2)
      .attr("y", (d) => ((d.source as GNode).y! + (d.target as GNode).y!) / 2)
    node.attr("transform", (d) => `translate(${d.x},${d.y})`)
  }
  sim.on("tick", tick)
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    sim.stop()
    for (let i = 0; i < 300; i++) sim.tick()
    tick()
  }

  // Drag pins while held, releases with a gentle reheat. A near-motionless
  // drag counts as a click and navigates (paths are content-root-relative,
  // and this page lives one level deep, so "../" resolves them).
  let moved = 0
  node.call(
    drag<SVGGElement, GNode>()
      .on("start", (event, d) => {
        moved = 0
        if (!event.active) sim.alphaTarget(0.25).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on("drag", (event, d) => {
        moved += Math.abs(event.dx) + Math.abs(event.dy)
        d.fx = event.x
        d.fy = event.y
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0)
        d.fx = null
        d.fy = null
        if (moved < 4) window.location.href = `../${d.path}`
      }),
  )

  // Hover/tap: caption + dim non-adjacent.
  const adjacent = (n: GNode, e: GEdge) => e.source === n || e.target === n
  const edgeText = (e: GEdge) =>
    `${(e.source as GNode).name} ${e.mutual ? "and" : "to"} ${(e.target as GNode).name}: ${e.label}`
  function focusNode(d: GNode | null) {
    node.classed(
      "dimmed",
      (n) =>
        !!d && n !== d && !edges.some((e) => adjacent(d, e) && (e.source === n || e.target === n)),
    )
    link.classed("dimmed", (e) => !!d && !adjacent(d, e))
    edgeLabel.classed("dimmed", (e) => !!d && !adjacent(d, e))
    caption.textContent = d
      ? edges
          .filter((e) => adjacent(d, e))
          .map(edgeText)
          .join("  •  ") || d.name
      : "Hover or tap a power to focus its connections."
  }
  node.on("mouseenter", (_ev, d) => focusNode(d)).on("mouseleave", () => focusNode(null))
  link
    .on("mouseenter", (_ev, e) => {
      caption.textContent = edgeText(e)
    })
    .on("mouseleave", () => focusNode(null))
    .on("click", (_ev, e) => {
      caption.textContent = edgeText(e)
    })

  // Legend from types present in the public data.
  const present = KNOWN_TYPES.filter((t) => edges.some((e) => e.etype === t))
  const legend = document.createElement("ul")
  legend.className = "diplomacy-legend"
  for (const t of present) {
    const li = document.createElement("li")
    const swatch = document.createElement("span")
    swatch.className = `dg-swatch ${typeClass(t)}`
    li.appendChild(swatch)
    li.appendChild(document.createTextNode(t.replace("-", " ")))
    legend.appendChild(li)
  }
  mount.appendChild(legend)

  window.addCleanup(() => {
    sim.stop()
    labelTimers.forEach((t) => window.clearTimeout(t))
    window.removeEventListener("resize", labelResize)
  })
}

document.addEventListener("nav", () => {
  setupDiplomacyGraph()
})
