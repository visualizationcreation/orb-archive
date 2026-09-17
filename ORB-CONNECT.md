# Orb Connect — organizing pass of 16 September 2026

The Museum now has a saved, authored arrangement of the 12 published ORBs observed on this date. Five grouping orbs hold overlapping collections. There are 22 membership connections and six jumps between groups. These are editorial navigation relationships, not scientific similarity scores or new contributed editions.

The initial collections are Forests & Waters; Mexico: Places & Voices; Food, Seasons & Gathering; Belief, Memory & Meaning; and Ways of Seeing. Each has an introduction, member reasons and a stable ID. Original editions, creators, libraries, media, catalog IDs and publication storage are unchanged.

`orb-connect-pass.mjs` owns the authored groups and edges and the pure neighborhood model. `orb-connect-snapshot.mjs` retains only public catalog references observed during this pass, allowing the map to work when the community feed is unavailable. Live listings override the snapshot. Newly published works not in this pass appear under New arrivals rather than disappearing or receiving fabricated relationships.

`orb-universe.mjs` renders the connected neighborhood, with up to eight nearby paths on desktop or six on phones, plus the current center. More paths are paginated and the companion list includes all neighbors. These are display limits, not graph limits. The map supports grouping-to-work and work-to-group navigation, group-to-group jumps, Back, All worlds, shareable `?map=<stable-id>` locations, browser history and layout-only Rearrange. Existing `?orb=<publication-id>` links select that work. The lower catalog also links to the authored collections. Original source and edition links are retained.

This is a completed one-time pass authored by the primary assistant. It is not a scheduled daily curator and does not call an AI model when a visitor opens the Museum. To revise the organization, update the pass while preserving useful IDs and explicitly changing membership reasons; do not manufacture completed ORB content. A future daily engine needs a separate persisted ingestion and authoring workflow.

Run `node --test tests/*.test.mjs tests/*.test.cjs` and `node build-directory.cjs`. Verify navigation, deep-link reload, feed failure, mobile pagination and catalog links before publishing. The tests exercise full reachability, original links, bidirectional memberships, new arrivals and a 29-work neighborhood that spans multiple pages.
