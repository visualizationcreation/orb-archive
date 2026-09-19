# Orbiversity interface

## Public museum workspace

Visual authority, September 19, 2026: the user requested that Orbiversity resemble the current Orbforma app. The white Spiral Atlas workspace in `star-navigator-web/DESIGN.md` is the shared reference. This replaces the previous navy Earth scene on the collection and its supporting pages; original published editions retain their own content and presentation.

The museum is an Experience surface with a Read inspector: visitors explore saved, connected works without an AI connection. Use a full-width pale blue spatial map with luminous blue spheres, quiet curved paths, compact controls, and a white inspector to the right. The shared blue sphere identifies ORB. The map is functional geometry, never a decorative stock illustration.

- Palette: white `#ffffff`, pale map `#edf5fa`, toolbar/supporting surfaces `#f7f9fb`, text `#243746`, secondary text `#5b6d7b`, borders `#dce3e9`, action blue `#236e96`.
- Typography: Segoe UI/system sans-serif, left-aligned controls and readings, 14–15px readable prose, 25–28px workspace headings. No serif hero or ornamental uppercase labels.
- Composition: compact header, large map, quiet contextual reading inspector, then spacious catalogue rows with actual title, topic, point count, media and source disclosures. Preserve the original 8 catalog ORBs, 13 editions, and separately loaded community publications.
- Navigation: retain saved tree IDs, four-layer refocus, branch controls, history, categories, sorts and all real publication/source destinations. “Explore ORB free” is a visible ordinary link to the app; it does not start generation. The private Orb Builder is not linked publicly.
- Phones: header and app link remain accessible; map toolbar scrolls horizontally with 44px controls; the inspector stacks below a 600px map. Filters use 16px editable controls. No fixed-height reader or page-wide horizontal overflow.
- Accessibility: blue visible focus, dark text on pale surfaces, reduced motion, native links and buttons, usable disclosure hit areas. Supporting pages and contribution fields share these tokens.
- Fidelity: keep contributor credit, anonymous choice, personal note, promotional/profile details, media and edition provenance. The remodel changes presentation, not public submission or AI billing behavior.

Implementation: `vault.css` owns shared page and catalog styling; `orb-universe.css` owns the dynamically loaded map; `vault-renderer.cjs` owns generated public page templates. Run `node build-directory.cjs` after template changes. The former Earth images remain as existing assets, with no new image request or background fetch on this surface.
