import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/diplomacy-graph.inline"
import style from "./styles/diplomacy-graph.scss"

// Shell for the diplomacy force graph. All behavior lives in
// diplomacy-graph.inline.ts, which finds the page's diplomacy-graph code
// block (via the data-graph attribute), hides it, and mounts the SVG here.
// Slug-gated in quartz.layout.ts to setting/diplomacy only.
export default (() => {
  const DiplomacyGraph: QuartzComponent = (_props: QuartzComponentProps) => {
    return <div class="diplomacy-graph-mount"></div>
  }
  DiplomacyGraph.css = style
  DiplomacyGraph.afterDOMLoaded = script
  return DiplomacyGraph
}) satisfies QuartzComponentConstructor
