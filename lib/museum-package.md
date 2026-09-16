# Museum review package contract

`museum-package.mjs` is a dependency-free browser module. `buildMuseumPackage(input, {onProgress})` returns `{blob, filename, manifest, warnings}`. It creates a downloadable review ZIP locally; it does not execute submitted HTML, fetch remote media, upload files, approve a contribution or publish it.

## Contributor fields

```js
await buildMuseumPackage({
  title: 'A remembered forest',
  html: selectedHTMLFile,
  orbJSON: optionalRecord,
  attribution: 'named', // 'named' or 'anonymous'
  creatorName: 'M. Rivera',
  creatorNote: 'What I wanted to share.',
  expression: 'A quiet reading, with time between points.',
});
```

- `creatorName`: optional plain text, at most 120 characters. Named attribution requires a nonblank display name; a bare email address is rejected. A display name is self-asserted credit, not a verified identity or digital signature.
- `creatorNote` and `expression`: optional plain text, at most 2400 characters each. They are public contributor text, rendered as escaped text under **About this orb** in the review cover. Line breaks are retained. Empty fields are omitted from `museum.contribution`.
- `attribution`: `named` or `anonymous`. An explicit anonymous choice omits `museum.creator` from generated public submission metadata, even if a stale creator name was supplied.
- When both attribution and creator name are omitted, imported `museum.attribution` and `museum.creator.displayName` are retained. Otherwise an omitted attribution is inferred from the supplied nonblank name, or defaults to anonymous. Unknown legacy records receive no invented name.
- Each omitted contribution field retains its corresponding imported `museum.contribution` text. An explicit empty string clears that field. Supplied values replace imported ones.

The generated `submission.json` and `manifest.json` carry:

```js
museum: {
  attribution: 'named',
  creator: {
    displayName: 'M. Rivera',
    creditType: 'self_asserted_display_name',
    verified: false
  },
  contribution: {
    note: 'What I wanted to share.',
    expression: 'A quiet reading, with time between points.'
  },
  library: [],
  audio: []
}
```

`creator` is absent for anonymous attribution. `contribution`, `note` and `expression` are absent when empty. The canonical `title` remains the submitted title. The cover and README display **Title — an orb by Name** or **Title — an anonymous orb**. This engine creates a cover section, not a new authored semantic point; reader integration can present the same metadata as its separate About point.

## Optional profiles and contributor items

`input.spotlight` becomes `museum.spotlight` in both generated metadata files:

```js
spotlight: {
  profiles: [
    {label: 'My portfolio', url: 'https://example.org/portfolio'}
  ],
  items: [
    {kind: 'project', title: 'A related project',
     description: 'What I want to share about it.',
     url: 'https://example.org/project'},
    {kind: 'thought', title: 'An idea without a destination',
     description: 'This entry does not need a link.'}
  ]
}
```

- Up to six profiles and six items; extra or invalid rows cause a visible error instead of being shortened or omitted.
- Profiles require a valid URL. Labels are optional, at most 80 characters; a blank label becomes the URL hostname. If that hostname exceeds 80 characters, supply a shorter label.
- Items require `kind` (`idea`, `thought`, `project`, `design`, or `product`) and a title of at most 180 characters. Description is optional, at most 2400 characters; URL is optional.
- URLs are at most 2048 characters before and after normalization. Only HTTPS domain links without whitespace, control characters, backslashes, credentials, private hostnames, IP literals or known access-token query/fragment parameters are accepted. Ordinary public reference parameters and section anchors are retained. This is syntax validation, not a network check, proof of ownership or endorsement.
- Omitted spotlight retains imported `museum.spotlight`. Explicit `null`, `{}`, or empty arrays clear it. Supplied nonempty spotlight replaces the imported section. Empty arrays/fields are omitted from the output. Unknown fields are excluded from the generated projection; original record bytes remain intact.
- Anonymous attribution suppresses the display name only. Deliberately supplied spotlight links/items remain. The cover and warnings explain that these public links may identify the author.

The cover includes a **From the contributor** section. Profile labels and linked item titles are escaped HTML text. Descriptions preserve line breaks. Items without URLs remain unlinked; no destination is invented. Links use `rel="noopener noreferrer"`. The engine neither fetches nor previews these destinations.

Reusable, dependency-free exports:

```js
normalizeMuseumSpotlight(value, field = 'spotlight') // normalized object or undefined
safeMuseumSpotlightURL(value) // normalized HTTPS string or null
```

The normalizer rejects getters, functions, cycles, sparse arrays, malformed rows and oversized fields without invoking user code. It returns a new object and never mutates its input. `MuseumPackageError.field` identifies the failing field, such as `spotlight.items[0].url`. `PACKAGE_LIMITS` exposes the row and text limits.

## Preservation and limits

Original HTML, JSON file/text bytes, and selected attachments are retained exactly. A plain JSON object is serialized as inert JSON. Anonymous public credit does **not** anonymize supplied HTML, records, filenames or attachments; those originals may identify the author. The cover, README and warnings state this explicitly. Imported verification flags do not confer verified attribution or publication approval.

Imported library metadata and manually supplied library rows are additive, deduplicated only when the full descriptor is identical. Existing remote media remains an external reference; it is not downloaded. Every selected audio file is included or the build fails visibly. CSS/JS/MJS dependencies are inert bundled files for review, not executed previews. Filename safety mapping can require repairing relative dependencies before hosting.

Limits: 32 MiB HTML, 8 MiB ORB JSON, 128 MiB per attachment, 256 MiB complete ZIP, and 256 selected files. `PACKAGE_LIMITS` exposes these bounds and the text limits. Validation failures are `MuseumPackageError` with `code` and `field`. Inputs with getters, executable JSON methods or cycles are rejected without invoking them.

Run verification with `node --test orbiversity-site/tests/museum-package.test.mjs` from the workspace root.
