# ORB Archive

By Informational Dimensions.

A functional library of active ORBs. The site opens on search, topic and format filters, sorting, and compact collection rows. Introductory material and a small compass example live in about.html.

## Maintain the catalog

The canonical data is orbs.json (schemaVersion 2). Fetch the latest repository state before updating. Upsert by stable ORB and edition ID; preserve unrelated metadata and entries. Only catalog published, verified reader URLs. Inactive editions remain in Archived Orbs (Inactive), excluded from the root catalog, search, and static fallback.

Run `node build-directory.cjs` after editing the manifest or shared renderer. Commit orbs.json, index.html and directory.js together. The dependency-free build regenerates the static list, embedded fallback catalog, topic options, and browser renderer. library.js handles search and URL-preserved filters; library.css styles both pages.

Each record retains its title, description, category, tags, firstPublished/updated dates, repository, featuredEdition, and editions. Each edition retains its label, direct HTTPS URL, original point lineage, authored/published dates, source revision and model/skill provenance. Unknown model and skill versions stay null. A presentation edit does not create a model generation or rewrite authorship.

## Availability fields

- Reading uses the selected featured edition's verified URL.
- Optional pointCount is an integer. Existing records fall back to the explicitly recorded count in displayMeta.
- availableJourneys entries with narrationReady true make Listen available. Set a verified url for a journey with a separate destination; otherwise the ORB reader is used. durationSeconds is measured recording time, not a plan.
- filmStudy.url and durationSeconds describe a published companion film; optional videoUrl can identify another published video. Watch appears only with a valid HTTPS destination.
- edition.journeyMode can be active or rest when that script mode is confirmed. The journey-mode filter appears only when the catalog contains confirmed modes. Do not infer a mode from generation, a mention in explanatory text, or a voice provider.

Search matches words in title, description, category, and tags. Topic and format filters intersect. Recent updates and newest additions sort descending by their recorded dates, with title as a stable tie-breaker; Title A–Z uses title ordering. Dates remain at their recorded precision.

## Publication and verification

GitHub Pages publishes main from the root. Preserve .nojekyll and Archived Orbs (Inactive). Publish index.html, about.html, library.css, library.js, directory.js, directory-renderer.cjs, build-directory.cjs, README.md and the current orbs.json when changed. Keep local review fixtures out of uploads.

Check the deployment's revision and live page. Verify search, intersecting filters, reset, sorting, edition details, About navigation, and responsive layout. The static list and embedded catalog must contain the same active ORBs; a failed manifest refresh uses the saved catalog with a visible message. Actual reader, narration, and film links must remain available. No background repository monitor or paid backend is required.

## ORB Share community submissions

The main page includes a separate ORB Share walkthrough and Community ORBs section at `#share`. The public guide and submission repository are https://visualizationcreation.github.io/orb-share/ and https://github.com/visualizationcreation/orb-share. Creators publish their own ORB repositories and propose listings by fork pull request. Only @visualizationcreation reviews, approves and merges accepted submissions.

`community.js` reads only the published `orb-share/orbs.json` from the upstream main deployment. It does not read open PRs, forks or issues, and it creates text and safe HTTPS links without injecting submitted HTML. `community.css` styles this section. The existing search and filters apply to the curated collection above it; community listings are shown separately. Empty and unavailable catalogues have explicit states. Approved community updates appear after the ORB Share Pages deployment without another archive commit. Review provenance uses each listing's immutable source revision; creator-hosted live content may change.

Preserve the Share navigation link, `#share` section and the community script/style references during future archive updates. The existing build-directory.cjs preserves this section. Keep the community catalogue separate from the curated schemaVersion 2 catalogue. Do not copy pending PR entries into the archive. See orb-share/REVIEWING.md for the owner workflow, branch protection and removal process.
