# Museum media desk

The collection inspector and published reader share `museum-media-panel.mjs` and
`museum-media.css`. The visual language follows Orbforma: contain-fit photographs,
source credits, explicit video playback, and a full-image viewer. Phones stack the
viewer below the map. The published reader synchronizes media and point navigation.

## Data and automatic population

- `museum-media-model.mjs` normalizes saved point images, attachments, source
  videos, library media, recordings, and legacy catalog entries. Media URLs are
  public HTTPS; only recognized YouTube/Vimeo IDs create embedded players.
- `museum-media-index.json` indexes existing media in eight older exhibits. It
  preserves original asset URLs, credits, licenses, and existing AI labels.
- `museum-media-discovery.mjs` uses saved images first. Where none exist, it can
  resolve an exact cited Wikipedia page or an exact matching title to an attributed
  Commons image. Related imagery is labeled and never modifies the published ORB.
- Discovery is free of model calls and does not require a visitor key. Results and
  misses are cached, requests are bounded, and obsolete selections are cancelled.
- No match stays empty; a source outage gives a retry. External provider pages
  stay links. Native audio/video files use controls and no autoplay; embedded video
  starts only after Play is selected.

## Maintenance and verification

Local source workspace: `orbiversity-site`. Regenerate the older-exhibit index with
`node scripts/build-museum-media-index.mjs`, then review the public JSON before
publishing it. The extraction script reads data and markup without executing
exhibit JavaScript. Do not publish `.private` extraction or request receipts.

Verified on 19 September 2026:

- 112 museum tests passed, including media normalization, asynchronous selection,
  playback cleanup, source licensing, and malformed-link cases.
- All 205 unique indexed image URLs returned successful image responses.
- Chapultepec's eight saved photographs load automatically with their credits.
- Desktop and 390-pixel phone layouts have no page-wide horizontal overflow.
- Thumbnail/read-point synchronization, full image view, YouTube player mounting,
  audio selection, and removal of an active video on media switching were checked.

The museum remains read-only. Existing editions, source text, contributor notes,
and original records are preserved. Provider availability remains outside the
museum's control; every media entry retains its original source link.
