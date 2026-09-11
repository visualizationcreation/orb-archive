# ORB Archive

## Studio navigation and point media

Compass points lists destinations beneath four headings in the navigation column: Up contains the authored parent and alternative parents, Down contains every authored child, and Left/Right contain the same immediate ring neighbors used by the control pad. The lists refresh with each selected point. Empty directions state that no linked point exists; floor points retain their floor explanation. Selecting a title uses the normal selection handler, including sphere focus, reading, sources, and URL updates. The panel is expanded on desktop and starts collapsed on phones, where it closes after selection. Preserve the compact reading-first layout when extending these lists.

Studio gives the reading/media window most of the desktop width, beside a compact sticky sphere and control pad. On phones a 204px navigation dock stays above the reading while scrolling within the workspace. Display options are tucked into a disclosure. The cross follows authored Up/Down and neighboring Left/Right links. Home returns to the subject. Back/Forward retain their authored thread meanings; Previous/Next traverse the display route. Missing directions stay disabled. Canvas arrow keys use the same conceptual directions; Home returns to the subject. Selecting a new point brings its reading header back into view when necessary while retaining the navigation controls. The reading area has no nested scrolling pane. `studio-cockpit.css` supplies this reading-first layout after the base Studio stylesheet; preserve both.

Optional media uses the existing generic SOURCE contract: set `kind: image`, `kind: audio`, or `kind: video`, attach point IDs with `points`, and supply an absolute HTTP(S) direct media URL. The source `title` becomes the caption and image description, with `publisher` retained as credit. This is a Studio rendering convention, not a new block or a change to generic file validation. Ordinary documentation sources remain links. Images and native audio/video previews load only when the visitor selects Load; switching points stops and removes previous media. Failed previews retain the original link. YouTube page URLs and other hosted-player pages should remain ordinary links, since they are not direct video files. No iframe embeds or HTML from imported files are executed. Reading files remain local; loading a remote preview contacts the named media host. Do not insert private album URLs or unpublished personal media into a publicly shared example.

The 40-point example remains text and documentation links; this layout release does not add generated media or narration. Test with explicit local fixtures, not invented example sources, when verifying media support.

## Orb Studio and ORB Fill

`studio.html` is a reusable paste-and-file receiver for the ORB Fill generic tagged reading profile. `studio-parser.js` contains the recovered Studio parser, its validators, and stricter generic-profile checks. Imported text is rendered with textContent; source URLs must be HTTP(S). Pasted text, file selection and drag/drop are validated locally, with a 10 MB UTF-8 limit per import, and never publish or upload visitor content. Unsupported legacy blocks are rejected with an explanation. No account, generation API, or local model is needed to browse a completed file.

The viewer offers knowledge-terrain and visual spiral layouts, silver and Neptune-blue finishes, rotation and point focus, authored compass links, full-text point search, source links, print, and a copyable continuation prompt. The spiral is a display route, not invented conceptual links or a narrated course. Imported content retains its language while English/Spanish controls follow the existing language preference. The 40-point `computer-task-videos.orb.txt` is the built-in example; `orbfill-skill.zip` supplies the current authoring skill, including its automatic complete-text copy block, Studio link and large-export HTML handoff instructions. Parser acceptance does not prove factual accuracy or all geometric quality; review notes remain visible.

The archive, About page, beginner guide and Studio share a copyable ORB Fill request and the Copy → Studio → Paste → Check & open instructions in English and Spanish. `orbfill-handoff.js` handles request copying and clipboard fallback; `orbfill-handoff.css` styles these controls. Studio copies or saves the exact accepted text, including sources, and keeps the current ORB when a new paste fails validation. Clipboard failures expose selectable text without falsely reporting success. ORB Share retains its separate JSON format and submission flow. Refresh `orbfill-skill.zip` from the installed skill when these instructions change. Maintain the Studio links on index, about and start pages when changing navigation. `studio-entry.css` styles its archive entry; `studio.css`, `studio.js` and `studio-spanish.js` belong to the viewer. Preserve `orbs.json` and its generated catalog when changing the Studio. Test file import, malformed input, inert HTML text, every example reading, responsive layout, both visual views, languages, reduced motion and print before deployment.

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
- edition.journeyMode can be active or rest when that script mode is confirmed. The course-mode filter appears only when the catalog contains confirmed modes. Do not infer a mode from generation, a mention in explanatory text, or a voice provider.

Search matches words in title, description, category, and tags. Topic and format filters intersect. Recent updates and newest additions sort descending by their recorded dates, with title as a stable tie-breaker; Title A–Z uses title ordering. Dates remain at their recorded precision.

## Publication and verification

GitHub Pages publishes main from the root. Preserve .nojekyll and Archived Orbs (Inactive). Publish index.html, about.html, library.css, library.js, directory.js, directory-renderer.cjs, build-directory.cjs, README.md and the current orbs.json when changed. Keep local review fixtures out of uploads.

Check the deployment's revision and live page. Verify search, intersecting filters, reset, sorting, edition details, About navigation, and responsive layout. The static list and embedded catalog must contain the same active ORBs; a failed manifest refresh uses the saved catalog with a visible message. Actual reader, narration, and film links must remain available. No background repository monitor or paid backend is required.

## ORB Share community submissions

The #share section links to https://visualizationcreation.github.io/orb-share/. Contributors create with the ORB Skill or published ORB prompt, then submit a link or HTML/ZIP through the prefilled GitHub issue intake. They need a GitHub account but no repository, hosting, JSON editing or PR.

The owner asks the assistant to review intake, considers its file/format/evidence checks and preview, then explicitly approves a named version. Only then does the assistant manage hosting, creator attribution and the approved catalogue in orb-share/orbs.json. Follow orb-share/REVIEWING.md. Review is on request, not a background monitor.

community.js reads only the published approved orb-share manifest, never pending issues or attachments. It renders safe text and links, with empty/error states. Keep the Share navigation, section, community.js and community.css during future updates. The curated catalogue and its search/filters remain separate; preserve existing editions, media links and inactive snapshots. The existing directory builder preserves the community section.

Public terminology: Spiral Courses includes ORB Learn — Spiral Audio Course and ORB Feel & Experience — Guided Audio Journey. Retain active/rest identifiers and existing URLs for compatibility; use courseModeLabel for display. Read & explore describes the interactive format, not a third course mode. A label update does not regenerate earlier recordings.

## Site languages and beginner guide

`start.html` introduces free AI chat on a phone with official ChatGPT and Claude links. Vendor links and free-plan availability were checked September 8, 2026 against their download pages, ChatGPT Free FAQ, and Claude pricing. It does not promise free autonomous agent features or automatic ORB video production.

`languages.js`, `spanish.js` and `languages.css` localize the archive interface, About page, and beginner guide. Use `?lang=en` / `?lang=es`; language preference is stored under `orb-site-language`. Interface translation requires JavaScript. Linked ORBs, recordings, community submissions and historical version/source records retain their original language. Add new interface strings to `spanish.js` when extending the site; never translate IDs or URLs. Search accepts English catalog fields and their Spanish translations.

The canonical catalog and all source records remain in `orbs.json`. `build-directory.cjs` preserves the language controls while rebuilding the saved catalog. Local tests cover desktop/mobile layouts, Spanish search, filters, compass, language switching, reload, and starter-message clipboard copying.



## Star Navigator visitor archive

The `#star-navigator` section uses `star-navigator.js` to display orbs explicitly published through Star Navigator. Netlify Blobs stores these public records; GitHub Pages displays the live feed. Publishing does not create a GitHub account, repository, or commit per visitor orb. The selected ORB content, sources, generation metadata and publication date are public; private inquiry context and journey history are excluded. Each record has a stable content ID and a reusable reader URL. Existing curated and approved Community ORBs retain their own workflows. Preserve this section and script during directory builds.
