# ORB — A direction for your curiosity

By Informational Dimensions.

The public introduction and project directory for ORB.

GitHub Pages publishes `main` from the repository root. The existing Quinault record and its available narration metadata are preserved in `orbs.json`. The page links to the existing basic prompt, full directional skill, and Orb Studio repository.

## Add a published orb

Add an object to the `orbs` array in `orbs.json`. Use a stable `id`, `title`, concise `description`, verified HTTPS `url`, `repository`, `tags`, `category`, `format`, and `displayMeta`. Preserve existing entries and metadata. Only describe narration, routes, or editions that are actually available. Use one of the current category filters (Nature, Health, Culture), or add a matching filter button to `index.html` for a new category.

The website reads the manifest at runtime. Three static entries and all four edition links remain available if JavaScript or the manifest cannot load. The static fallback is generated from the same edition renderer as the live directory; regenerate it when changing the collection. This avoids a blank directory and supports local preview.

## Track editions and origin

Manifest `schemaVersion: 2` adds an `editions` array and `featuredEdition` to each orb, retaining the original stable project ID, links, narration metadata, and historical revision fields. Each edition has its own stable `id`, label, direct URL, authored or publication date, interface description, model-generation label, and immutable GitHub source snapshot. `basedOn` links an adaptation to its earlier edition when known.

Use **older model version** for the earlier works, as requested. This is a broad generation label, not the name or version of a specific AI model. Keep `modelId` and `orbSkillVersion` null unless documented. Record the actual skill version separately when it is known; never derive it from a plugin's current version, a repository upload date, or a model's name. Authored dates come from the artifacts; publication dates describe release and are not substituted for authorship.

Current groups are `older-model` and `narrated`. These are directory filters, not numerical ORB versions or quality ratings. The default view includes all editions. The older-model filter makes Quinault's entry link open the original 143-position reader rather than the narrated adaptation.

When a new model or substantive ORB generation produces a new edition, **append a new edition record**. Preserve the previous reader at a stable browsable URL (for example an edition subfolder with its needed assets), keep its edition ID, and link the new record with `basedOn`. Set `featuredEdition` explicitly; do not overwrite an older edition merely to feature the new one. Freeze the relevant source revision too. A GitHub source snapshot is an immutable source record, not a replacement for a browsable edition link.

Presentation-only edits retain the same edition ID and authorship/model generation. Track their commit in `presentationRevision` when needed. A new theme is not a new ORB or model version. Record changes in this manifest when publishing an edition; there is no background repository monitor.

For future entries, add the edition ID, label, verified HTTPS `url`, `generation`, `modelLabel`, nullable `modelId`, nullable `orbSkillVersion`, `interface`, `displayMeta`, date, and pinned `sourceUrl`. Unknown information stays explicitly unrecorded.

After editing `orbs.json`, run `node build-directory.cjs` from this repository. This uses `directory-renderer.cjs` to refresh the static fallback, embedded fallback catalog, and browser renderer together. It checks unique project/edition IDs, valid featured editions, HTTPS edition URLs, and JavaScript syntax. Commit the updated `orbs.json` and generated `index.html` together. Both scripts are included in this repository and need no dependencies. The live site is static and does not require Node.js.

## Local preview

Serve this folder with a local static server to exercise manifest loading. Opening `index.html` directly shows the static fallback directory, compass example, and search.

The compass is an explicitly labeled authored example, not an AI backend. Basic ORB currently uses numbered branches; the full directional skill uses the six-direction compass. The directory intentionally explains the distinction.

## Accessibility

Native links and buttons, labeled search, live filter count, keyboard focus styles, skip link, responsive layout, and reduced-motion support. Motion can be paused manually.
