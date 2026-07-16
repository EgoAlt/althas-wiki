import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
    // On mobile the right sidebar renders below the article, so the infobox
    // gets a mobile-only twin up here, right below the title block (same
    // MobileOnly/DesktopOnly pairing pattern as Spacer/TableOfContents).
    // Server-rendered only: no .toString()/new Function client script, so the
    // Explorer sortFn __name pitfall doesn't apply here.
    Component.MobileOnly(Component.Infobox()),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({
      // Sort ignoring a leading "The " so "The Holy See" files under H, etc.
      // NOTE: this fn is .toString()'d and run through `new Function` in the
      // browser, so it must be fully self-contained AND must not create any
      // named inner function/const: esbuild's keep-names wraps those in a
      // `__name(...)` helper that does not exist client-side (undefined ->
      // the Explorer silently dies). Keep the "strip the leading The" logic
      // inlined for exactly that reason. Verify in a browser after editing.
      sortFn: (a, b) => {
        if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
          return a.displayName
            .replace(/^the\s+/i, "")
            .localeCompare(b.displayName.replace(/^the\s+/i, ""), undefined, {
              numeric: true,
              sensitivity: "base",
            })
        }
        if (!a.isFolder && b.isFolder) {
          return 1
        } else {
          return -1
        }
      },
    }),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.Infobox()),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      // Sort ignoring a leading "The " so "The Holy See" files under H, etc.
      // NOTE: this fn is .toString()'d and run through `new Function` in the
      // browser, so it must be fully self-contained AND must not create any
      // named inner function/const: esbuild's keep-names wraps those in a
      // `__name(...)` helper that does not exist client-side (undefined ->
      // the Explorer silently dies). Keep the "strip the leading The" logic
      // inlined for exactly that reason. Verify in a browser after editing.
      sortFn: (a, b) => {
        if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
          return a.displayName
            .replace(/^the\s+/i, "")
            .localeCompare(b.displayName.replace(/^the\s+/i, ""), undefined, {
              numeric: true,
              sensitivity: "base",
            })
        }
        if (!a.isFolder && b.isFolder) {
          return 1
        } else {
          return -1
        }
      },
    }),
  ],
  right: [],
}
