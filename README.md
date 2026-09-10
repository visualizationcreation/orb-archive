# ORB Archive

## Orb Studio and ORB Fill

`studio.html` is a reusable local-file receiver for the ORB Fill generic tagged reading profile. `studio-parser.js` contains the recovered Studio parser, its validators, and stricter generic-profile checks. Imported text is rendered with textContent; source URLs must be HTTP(S). File selection and drag/drop read locally, with a 10 MB per-file limit, and never publish or upload visitor content. Unsupported legacy blocks are rejected with an explanation. No account, generation API, or local model is needed to browse a completed file.

The viewer offers knowledge-terrain and visual spiral layouts, silver and Neptune-blue finishes, rotation and point focus, authored compass links, full-text point search, source links, print, and a copyable continuation prompt. The spiral is a display route, not invented conceptual links or a narrated course. Imported content retains its language while English/Spanish controls follow the existing language preference. The 40-point `computer-task-videos.orb.txt` is the built-in example; `orbfill-skill.zip` supplies the renamed authoring skill. Parser acceptance does not prove factual accuracy or all geometric quality; review notes remain visible.

Maintain the Studio links on index, about and start pages when changing navigation. `studio-entry.css` styles its archive entry; `studio.css`, `studio.js` and `studio-spanish.js` belong to the viewer. Preserve `orbs.json` and its generated catalog when changing the Studio. Test file import, malformed input, inert HTML text, every example reading, responsive layout, both visual views, languages, reduced motion and print before deployment.

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
