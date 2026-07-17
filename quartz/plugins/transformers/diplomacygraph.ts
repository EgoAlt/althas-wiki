import { QuartzTransformerPlugin } from "../types"
import { Root, Code } from "mdast"
import { visit } from "unist-util-visit"

// Stashes each diplomacy-graph code block's raw text in a data-graph attribute
// so diplomacy-graph.inline.ts can parse it reliably, regardless of what the
// syntax highlighter does to the visible block. Same mechanism as the Mermaid
// data-clipboard attribute in ofm.ts. Grammar spec: the campaign's
// specs/althas-diplomacy-force-graph-design.md in Ontos.
export const DiplomacyGraphBlocks: QuartzTransformerPlugin = () => ({
  name: "DiplomacyGraphBlocks",
  markdownPlugins() {
    return [
      () => (tree: Root) => {
        visit(tree, "code", (node: Code) => {
          if (node.lang === "diplomacy-graph") {
            node.data = {
              hProperties: {
                className: ["diplomacy-graph-data"],
                "data-graph": node.value,
              },
            }
          }
        })
      },
    ]
  },
})
