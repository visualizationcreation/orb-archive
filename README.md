# ORB — A direction for your curiosity

By Informational Dimensions.

The public introduction and active project directory for ORB. GitHub Pages publishes main from the repository root. The page links to the basic prompt, full directional skill, and Orb Studio repository.

## Active collection

The root `orbs.json` contains only active editions. The current collection features the narrated Quinault pilot and its forest film. The older original Quinault, CIRS, and Reputation & Public Perception readers are preserved in [Archived Orbs (Inactive)](Archived%20Orbs%20%28Inactive%29/README.md). They are excluded from the main website, its search, and its static fallback.

The inactive folder contains complete HTML snapshots, edition metadata, SHA-256 checksums, and the catalog as it stood before archiving. Original source repositories are preserved. Inactive means excluded from the active directory; this folder is still public source material.

## Add a published orb

Add an object to the root orbs array with a stable ID, title, concise description, verified HTTPS URL, repository, tags, category, format, and display metadata. Describe only journeys and narration that are available. The current interface uses search; topic and edition filters can be reintroduced when the active collection needs them.

Run `node build-directory.cjs` after editing the manifest, then commit the manifest and generated index.html together. The dependency-free build refreshes static entries, the embedded fallback catalog, and the browser renderer. It validates unique project and edition IDs, featured editions, HTTPS links, inactive status, and JavaScript syntax. The live site does not require Node.js.

## Track editions and origin

Manifest schema version 2 records editions and featuredEdition for each project. Each edition keeps its stable ID, label, direct URL, authored or publication date, interface, model-generation label, and pinned source snapshot. The basedOn field preserves a known lineage by edition ID, including when the earlier edition is inactive.

Use **older model version** for the archived works. Keep modelId and orbSkillVersion null unless documented. Never infer them from a current plugin version, upload date, or model name. Authored dates and publication dates have distinct meanings. A new visual theme retains the edition ID and model generation; its source commit can be recorded as presentationRevision.

For a substantive new edition, create a new edition record and explicitly select the featured edition. Preserve its predecessor's files and version information. To retire an edition, put a complete copy and its metadata in Archived Orbs (Inactive), mark its archival record inactive, and remove it from the root catalog. Remove a project only when it has no active editions left. Rebuild the static fallback to remove obsolete links too. Restoration to the active directory should be an explicit editorial decision, never automatic discovery of archived files.

## Local preview and accessibility

Serve this folder with a local static server to exercise manifest loading. Opening index.html directly also provides the embedded catalog and static fallback. The compass is a labeled authored example. Basic ORB uses numbered branches; the full skill uses six directions.

The site includes native links and buttons, labeled search, a live result count, keyboard focus styles, a skip link, responsive layout, and reduced-motion support. Motion can be paused manually.
