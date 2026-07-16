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
      // NOTE: this fn is .toString()'d and run client-side, so it must be
      // fully self-contained (the `strip` helper lives inside it deliberately).
      sortFn: (a, b) => {
        const strip = (s: string) => s.replace(/^the\s+/i, "")
        if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
          return strip(a.displayName).localeCompare(strip(b.displayName), undefined, {
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
      // NOTE: this fn is .toString()'d and run client-side, so it must be
      // fully self-contained (the `strip` helper lives inside it deliberately).
      sortFn: (a, b) => {
        const strip = (s: string) => s.replace(/^the\s+/i, "")
        if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
          return strip(a.displayName).localeCompare(strip(b.displayName), undefined, {
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
