# ORB — A direction for your curiosity

The public introduction and project directory for Nathan Wilson's ORB work.

GitHub Pages publishes `main` from the repository root. The existing Quinault record and its available narration metadata are preserved in `orbs.json`. The page links to the existing basic prompt, full directional skill, and Orb Studio repository.

## Add a published orb

Add an object to the `orbs` array in `orbs.json`. Use a stable `id`, `title`, concise `description`, verified HTTPS `url`, `repository`, `tags`, `category`, `format`, and `displayMeta`. Preserve existing entries and metadata. Only describe narration, routes, or editions that are actually available. Use one of the current category filters (Nature, Health, Culture), or add a matching filter button to `index.html` for a new category.

The website reads the manifest at runtime. Three static entries remain available if JavaScript or the manifest cannot load; refresh this fallback markup when the collection changes. This avoids a blank directory and supports local preview.

## Local preview

Serve this folder with a local static server to exercise manifest loading. Opening `index.html` directly shows the static fallback directory, compass example, and search.

The compass is an explicitly labeled authored example, not an AI backend. Basic ORB currently uses numbered branches; the full directional skill uses the six-direction compass. The directory intentionally explains the distinction.

## Accessibility

Native links and buttons, labeled search, live filter count, keyboard focus styles, skip link, responsive layout, and reduced-motion support. Motion can be paused manually.
