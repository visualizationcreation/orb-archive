# Today’s ORBs

The home page includes a newest-first feed of published ORBs beneath the browsing studio. It combines the saved `orbs.json` catalog with the existing public Museum publication feed. It is an ORB feed, without visitor replies.

- Entries show the title, a short introduction, publication date, recorded contributor credit, and a direct reader link. Contributor notes remain optional disclosures.
- `publishedAt`, or the original `firstPublished` date, controls order. Editing an old ORB does not turn it into a new arrival.
- “Today” uses the visitor’s calendar day. Date-only publications keep their recorded day; timestamps are converted to local time. Future-dated entries are withheld, and unknown dates are labelled.
- Static HTML contains recent additions and ordinary links. JavaScript adds local-day groups, eight-at-a-time expansion, and refresh. Failed refreshes preserve the entries already loaded.
- The new text and links pass through escaping and HTTPS checks. This view does not change the existing submission limits or publishing policy.

## Maintenance

`todays-orbs.js` is the shared browser/Node renderer; `todays-orbs.css` follows the Museum’s pale-blue studio. `vault-renderer.cjs` generates the saved feed, while `vault.js` updates it after the existing public catalog loader runs. Add interface translations in `vault-i18n.js`.

After changing the catalog or renderer:

```
node build-directory.cjs
node --test tests/*.test.cjs tests/*.test.mjs
```

Commit the catalog, generated pages, renderer, and changed assets together. Keep every earlier edition and inactive archive intact. Check phone layout, expansion, refresh failure, anonymous/named credit, quiet days, and a JavaScript-disabled reader.

## America at 250

The first collection added with the feed contains Philadelphia, New Orleans, Detroit and Los Angeles. Each has eight original readings, point-specific sources, a licensed documentary image, and the shared read-only Museum studio. Six reciprocal connections distinguish comparisons from the documented Motown headquarters move. The four repositories retain full static readings, source registers, image credits, and portable Reach metadata. No recordings or videos are advertised for these reading editions.
