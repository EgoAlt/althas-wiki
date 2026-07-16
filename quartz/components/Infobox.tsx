import { JSX } from "preact"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/infobox.scss"
import { FilePath, FullSlug, slugifyFilePath, transformLink } from "../util/path"
import { classNames } from "../util/lang"

// The typed-infobox schema for the article-templates pilot. Field order here
// is render order. Kept in step with the sync whitelist (INFOBOX_KIND_FIELDS
// in scripts/sync-from-ontos.py), the gate (scripts/check-infobox-fields.py),
// and the authoring reference in the Ontos campaign folder.
const KIND_FIELDS: Record<string, string[]> = {
  person: ["born", "died", "house", "allegiance", "role", "pc"],
  nation: ["capital", "ruler", "government", "founded"],
  location: ["nation", "region"],
  organization: ["seat", "leader", "founded"],
  "magic-system": ["practitioners", "source"],
  being: ["nature", "domain", "fate"],
  artifact: ["wielder", "origin"],
  event: ["when", "outcome"],
  ancestry: ["homeland", "standing"],
}

// Row labels that a plain first-letter capitalization would get wrong.
const FIELD_LABELS: Record<string, string> = {
  pc: "Player character",
}

const kindLabel = (kind: string): string =>
  kind
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

const fieldLabel = (field: string): string =>
  FIELD_LABELS[field] ?? field.charAt(0).toUpperCase() + field.slice(1)

// Frontmatter values are NOT processed by the CrawlLinks transformer, so a
// wikilink arrives here as a raw string like "[[house-voldis|House Voldis]]".
// Parse that pattern ourselves and resolve it exactly the way the site's own
// body links resolve: transformLink() with the "shortest" strategy (which
// carries this repo's patched folder-index rule, so [[armada]] resolves to
// locations/armada/index.md).
const WIKILINK_RE = /\[\[([^\[\]|#]+)(?:#[^\[\]|]*)?(?:\|([^\[\]]+))?\]\]/g

const targetExists = (target: string, allSlugs: FullSlug[]): boolean => {
  const canonical = slugifyFilePath((target.trim() + ".md") as FilePath)
  return allSlugs.some((slug) => {
    if (slug === canonical) {
      return true
    }
    const parts = slug.split("/")
    const fileName = parts.at(-1)
    if (fileName === "index" && parts.length >= 2) {
      return canonical === parts.at(-2)
    }
    return canonical === fileName
  })
}

const renderString = (
  value: string,
  slug: FullSlug,
  allSlugs: FullSlug[],
): (string | JSX.Element)[] => {
  const parts: (string | JSX.Element)[] = []
  let last = 0
  for (const m of value.matchAll(WIKILINK_RE)) {
    if (m.index! > last) {
      parts.push(value.slice(last, m.index))
    }
    const target = m[1].trim()
    const display = (m[2] ?? m[1]).trim()
    if (targetExists(target, allSlugs)) {
      const href = transformLink(slug, target, { strategy: "shortest", allSlugs })
      parts.push(
        <a href={href} class="internal">
          {display}
        </a>,
      )
    } else {
      // Target page isn't on the public site (or is ambiguous): degrade to
      // plain text rather than emit a dead link.
      parts.push(display)
    }
    last = m.index! + m[0].length
  }
  if (last < value.length) {
    parts.push(value.slice(last))
  }
  return parts
}

const renderValue = (
  value: unknown,
  slug: FullSlug,
  allSlugs: FullSlug[],
): (string | JSX.Element)[] => {
  if (typeof value === "boolean") {
    return [value ? "Yes" : "No"]
  }
  if (Array.isArray(value)) {
    const parts: (string | JSX.Element)[] = []
    value.forEach((item, i) => {
      if (i > 0) {
        parts.push(", ")
      }
      parts.push(...renderValue(item, slug, allSlugs))
    })
    return parts
  }
  if (typeof value === "string") {
    return renderString(value, slug, allSlugs)
  }
  return [String(value)]
}

export default (() => {
  const Infobox: QuartzComponent = ({ fileData, displayClass, ctx }: QuartzComponentProps) => {
    const fm = fileData.frontmatter as Record<string, unknown> | undefined
    const kind = fm?.["kind"]
    if (typeof kind !== "string" || !(kind in KIND_FIELDS)) {
      return null
    }
    const rows = KIND_FIELDS[kind]
      .map((field) => [field, fm![field]] as const)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
    return (
      <div class={classNames(displayClass, "infobox")}>
        <span class="infobox-kind">{kindLabel(kind)}</span>
        {rows.length > 0 && (
          <dl class="infobox-fields">
            {rows.map(([field, value]) => (
              <>
                <dt>{fieldLabel(field)}</dt>
                <dd>{renderValue(value, fileData.slug!, ctx.allSlugs)}</dd>
              </>
            ))}
          </dl>
        )}
      </div>
    )
  }

  Infobox.css = style

  return Infobox
}) satisfies QuartzComponentConstructor
