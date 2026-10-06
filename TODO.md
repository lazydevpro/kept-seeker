# TODO

Spec: [docs/design/kept-design-system.md](docs/design/kept-design-system.md)

## Now — Solana dApp Store readiness (reviewed 7 Oct 2026) #store

Sources: dApp Store Terms of Use, Publisher Policy, Developer Agreement, docs.solanamobile.com.

- [ ] Device pass on a phone with real money (SOL, a stock, sell, reinstall → restore, widget,
      invite link opens the app) — nothing wallet-side has run on a phone on this stack #verify
- [ ] **Decide: tokenized stocks in the store build.** ToS §5.4.16 bars using the store to
      transact in securities; the Publisher Policy wants regulated financial services to file
      their documentation. Crypto-only for the store (PRIVATE_MARKETS-style switch), or a
      lawyer's view on xStocks first #legal
- [ ] Report and block for social content (Publisher Policy: user-generated content needs
      report/flag, moderation and blocking). KEPT has leave and owner-remove, no report #screens
- [ ] Push (FCM project + EXPO_ACCESS_TOKEN): reminders and nudges reach no phone today #notifications
- [ ] Listing: 512×512 icon, ≥4 screenshots ≥1080 px from the crypto-first build, banner
      1200×600, feature graphic 1200×1200 (optional), short description ≤30 chars, support
      email; privacy + terms are in-app (Account) and on the site; account deletion exists #store
- [ ] Publisher Portal: KYC/KYB, a publisher wallet with ~0.2 SOL (keep it — every update needs
      it). Review takes 3–5 business days; for Clock In it must be live by ~10 Dec #store
- [ ] Optional: crash reporting; encrypt the MWA auth token (the wallet kit keeps it in
      AsyncStorage); a lawyer's review of /terms and /privacy #launch
- [ ] Deck screenshots show the old shelf (private markets, no crypto): recapture with
      `video/scripts/app-shots.mjs` #deck

## Now — Clock In submission (closes Fri 9 Oct, 12:29 IST) #clockin

Plan: [docs/plans/clock-in-submission.md](docs/plans/clock-in-submission.md). Own deadline: Thu 8 Oct, 22:00 IST.

- [ ] Owner: register on Align (Radiants) and confirm the sign-up deadline #clockin
- [x] New repo `lazydevpro/kept-seeker` (public, full history); pushes to the old `kept` repo
      disabled locally while its review runs. Pending work committed and pushed #clockin
- [x] A stack of its own: `kept-seeker-api` (+ D1 `kept-seeker-production`, queue
      `kept-seeker-jobs`), `kept-seeker.pages.dev` (+ KV), app `com.lazydevpro.keptseeker` 1.1.0 #clockin
- [x] API live on its own Cloudflare account: `kept-seeker-api.keptseeker.workers.dev`, cron on,
      migrations 0001–0011, secrets set (auth, Jupiter, RPC) #clockin
- [x] Release key (`~/.kept-seeker/android/`), APK 1.1.0 built and signed, published as the
      v1.1.0 pre-release on kept-seeker; `assetlinks.json` verified by Google (`linked: true`) #clockin
- [x] Site live at kept-seeker.pages.dev (own account); crypto market section committed #web
- [x] Site redeployed: crypto market section live, download button → v1.1.0 APK (200) #web
- [x] Film "Next week": "stocks and crypto" line, reel and small print; new take cut and
      listened to by the owner. Rendered (video/out/kept-next-week-16x9-product-vo.mp4), limited
      to −0.9 dBFS peak at −13.9 LUFS #film
- [x] Demo narration recorded (AI Studio), cut by `npm run narration`, listened to — good #film
- [x] Terms version 2 (7 Oct): crypto in the summary, §3, §4 and §5; owner-approved, live on the
      site and enforced by the API. Still not a lawyer's review (see Legal review below) #launch
- [ ] Put the new key's SHA-256 in `web/public/.well-known/assetlinks.json`, redeploy the site #web
- [x] Fresh-clone check: CI on the new repo runs `npm ci` + every gate on a clean runner — green #verify
- [x] README: a Clock In block at the top (APK, video, deck, install, run locally) #clockin
- [ ] Device pass on a phone with $1 real money (the open #verify item below) #verify
- [ ] v1.0.2 APK from the submitted commit, if the app changed since v1.0.1 #mobile
- [ ] Demo video, 2:45: script and shot list in `docs/demo-video.md`; record Wed, assemble Thu #film
- [ ] Deck pass against the four criteria; re-export `docs/kept-deck.pdf` #deck
- [ ] Draft on Align, run the AI Coach, final submit #clockin
- [ ] After a win: live on the Solana dApp Store by 10 Dec #launch
- [x] Crypto shelf: SOL, cbBTC, SKR; SOL verified from lamports; 42 backend tests #clockin
- [ ] Stretch, decide Wed noon: "pay your promise in SKR" (SKR prize) #clockin
- [ ] Colosseum World's Fair by 13 Oct 12:29 IST: register, presentation video (2–3 min),
      go-to-market plan, past-work disclosure; select India for the Superteam India track #clockin

## Now — the product film "Next week" #film

Spec: [docs/product-video.md](docs/product-video.md)

- [x] Voiceover: one Gemini TTS take of the whole script, cut at the pauses, every clip checked by
      transcription, laid on the beats with the music ducked under it (`video/scripts/voiceover.mjs`)
- [x] Second half from feedback: every circle feature said, "everyone around you", a new money
      section (put away $1,275 → an $18,236 ten-year illustration, footnoted)
- [x] Thumbnails: the hook on ink, the payoff on cream
- [x] The method as a reusable skill: `~/.claude/skills/product-film` (idea, workflow, portable
      scripts, a tested starter kit, this film as the case study, a learnings log)
- [ ] Commit the film work (`video/`, `docs/product-video.md`), not committed yet

## Now — the deck #deck

- [x] Product deck at `web/app/deck`, exported by `web/scripts/deck-export.mjs` to
      `docs/kept-deck.pdf` (20 slides)
- [x] Under the hood: architecture, one purchase end to end, privacy as the API sends it,
      wallet identity, reliability and security, every figure read from `backend/`
- [x] Roadmap slide. "Later" (iOS, circle streaks, more countries) is a proposal, not a plan
      the repo records; confirm or replace
- [ ] Commit the deck (`web/app/deck`, `web/public/deck`, `web/scripts/deck-export.mjs`,
      `docs/kept-deck.pdf`), not committed yet
- [ ] 9:16 and 1:1 layouts; the 30 s and 15 s cutdowns (planned in the spec)

## Done — KEPT UI rebuild #design

- [x] Design tokens: KEPT palette (light-first), Sora + Inter type scale, spacing/radii/shadow #design
- [x] Level 1 + Level 2 icon set as custom SVG, Ionicons retired from the product surface #design
- [x] Level 3 3D object registry over the bundled Fluent assets #design
- [x] 2D flat SVG illustrations for empty states, the invite screen and the circle #design
- [x] UI primitives: Screen, Card, Button, Chip, Stat, ListRow, Sheet, SectionHeader #design
- [x] Rings rebuilt to Apple Fitness quality; one SVG implementation for native and web #design
- [x] Week, Circle, Goal, Invest, Awards, Onboarding, Join screens #screens
- [x] Invest risk copy moved out of the shelf and into a disclosure sheet #screens
- [x] Floating tab bar #screens
- [x] User-facing rename Neon Reserve → KEPT #brand
- [x] Typecheck, lint, and a screen-by-screen visual pass in light and dark #verify

- [x] App icon, adaptive icons, favicon and splash in the KEPT identity, generated from
      vector sources by `mobile/scripts/build-brand-assets.py` #brand

## Done — private portfolio #portfolio

- [x] Migration 0006: `verified_amount_base_units` + `asset_decimals` on contributions,
      both filled by the verification job from the confirmed transaction #backend
- [x] `GET /v1/portfolio` — holdings, cost basis, live value and P&L, owner-only #backend
- [x] Jupiter Price v3 lookup, mainnet + API key only; degrades to cost basis otherwise #backend
- [x] Portfolio screen, reachable from the Week money tile and the Invest shelf #screens
- [x] Sandbox rehearsals reported separately and excluded from holdings #backend

## Done — notifications & reminders #notifications

- [x] Reminder fired on every nightly cron run: the window is two days wide and the cron is
      daily, so each week's nudge went out twice. Migration 0008 adds `weekly_promises.reminded_at`;
      covered by a regression test #backend
- [x] `sendPush` batched to 100 per request — Expo rejects more, so >100 tokens failed outright #backend
- [x] Dead tokens now disabled: Expo returns 200 with per-ticket errors, so `DeviceNotRegistered`
      devices were retried forever. Ticket statuses are read and those tokens set `enabled = 0` #backend
- [x] Reminder fan-out split at 500 users per queued message #backend
- [x] `enablePushNotifications` returns why it failed instead of a bare boolean, so a build that
      cannot do push no longer tells the user they declined #mobile

## Done — market data #markets

- [x] Public markets showed "Soon" forever: the xStocks catalog is paginated (100 a page,
      ~930 total) and the backend read only page 0. SPYx, QQQx and TSLAx are all on later
      pages, so they looked permanently unavailable #backend
- [x] Catalog pages now fetched in parallel batches and cached in-isolate for an hour —
      upstream is ~2.5s a page, so ten sequential fetches blew the request timeout #backend
- [x] `GET /v1/trades/catalog` — the full universe, searchable, paginated, with live prices.
      No wallet required; only the page being viewed is priced #backend
- [x] Live prices on the Invest shelf and a "Browse all markets" screen with search #screens
- [x] Shared `lib/prices.ts` so the portfolio and the catalog quote identically #backend
- [x] `search` icon added to the Level 1 set #design
- [x] Catalog leads with 34 recognisable tickers instead of opening on Airtel Africa and
      Alcoa; while searching, relevance (exact symbol → prefix → contains) outranks that list #backend
- [x] Browse list is infinite-scroll — `Screen` gained `onEndReached` and the catalog uses
      `useInfiniteQuery`, so pages append instead of asking for a Next button #screens
- [x] `Chip` gained `iconSide`, matching `Button`, so forward arrows trail the label #design

## Done — buying from the catalogue, and real asset artwork #markets

- [x] Tapping an asset in Browse all did nothing. The buy flow lived inside the Invest
      screen, wired to that screen's own `selected` state, so catalogue rows had nothing
      to open. Extracted to `features/trade/purchase-sheet.tsx`; both screens now open the
      same review, risk acknowledgement and confirmation #screens
- [x] `useWalletLink` extracted alongside it — connect and verify were about to be written
      twice, once per screen #mobile
- [x] The sheet resets its quote and its Tessera acknowledgement when the asset changes, so
      a stale route or a stale tick cannot carry across to the next asset #mobile
- [x] Real logos everywhere. `InvestableAsset.logo` had been returned by the API all along
      and simply never rendered — every screen drew initials over the top of it. New
      `AssetLogo` renders xStocks' PNGs, routes Tessera's SVGs through `SvgUri` (`<Image>`
      cannot decode SVG on native), and falls back to the initials plate #design
- [x] Tessera's assets gained their icon URLs, taken from Jupiter's token record #backend
- [x] Private markets is no longer a hardcoded pair. Tessera **does** publish a catalogue —
      `rest-api.tessera.pe/v1/public/token-details` — the earlier check looked at
      `api.tesseralab.co`, which is the lab's corporate site, not the product API. Reading
      the real one added T-SpaceX; the two original mints stay as an offline fallback so the
      lane degrades instead of emptying #backend
- [x] The three T-Tokens lead `FEATURED`. Alphabetically they landed ~800 rows into a
      931-asset list despite being the most recognisable names in it #backend
- [x] Portfolio positions carry artwork too. The portfolio only stores a mint, so it asks
      Jupiter for icons by mint (`lib/tokens.ts`) rather than making a cold portfolio read
      pay for a ten-page catalogue walk #backend
- [x] The portfolio was **not** using the shared `lib/prices.ts` despite the note above
      claiming it did — it had its own copy, which put every mint in one URL with no
      chunking. Now on `fetchQuotes` with the rest #backend

## Done — the buy ticket #trade

- [x] The review sheet was a summary of the promise — "Weekly promise $25", "Circle sees
      progress only" — none of which is what anyone weighs up before spending money. It is
      now a small terminal: price, movement across 5m/1h/6h/24h, a typed amount, and a live
      quote showing what that amount buys and what each unit really costs #screens
- [x] The amount is free, $1–$10,000, with presets. It was pinned at $25 in the client even
      though the server has always accepted a range — the weekly promise is a habit, not a
      price list #screens
- [x] `GET /v1/trades/asset` — price, four change windows, liquidity, 24h volume, holders,
      decimals. Catalog answers for identity and structure, Jupiter for the market #backend
- [x] `GET /v1/trades/quote` — a preview that persists nothing and needs no wallet, so an
      amount can be priced while someone is still deciding whether to connect one. `/order`
      required a verified wallet, which made it useless for trying numbers #backend
- [x] `Sheet` gained `leading` and `footer`, a height cap, a scrollable body and keyboard
      avoidance. The ticket is far taller than the confirmations it was built for, and the
      button that spends the money must never scroll away #design
- [x] Tessera's risk acknowledgement rides in the pinned footer — below the fold it left the
      button asking for something the reader could not see #screens
- [x] `minWidth: 0` on the amount field: react-native-web gives `<input>` an intrinsic width
      flex will not shrink, which pushed the "USDC" suffix out of the field #design
- [x] `DetailTable` retired — the old sheet was its only caller #cleanup

## Done — social audit #social

- [x] The circle roster labelled **the wrong person "You"**. Members come back ordered by
      join date and the row keyed the badge off `index === 0`, so it marked whoever founded
      the circle — right for the founder, wrong for everyone they ever invite. Now keyed off
      the signed-in profile id #screens
- [x] A friend's goal ring could overstate them. The target was read from their newest
      active goal while the completed count summed promises across *every* active goal, and
      nothing stops a user keeping two. Reproduced at 83% where the truth was 25%; both
      halves now hang off the same goal #backend
- [x] The share sheet still offered to share a "Neon Reserve" circle — the one piece of copy
      that leaves the app and lands in someone else's messages #mobile
- [x] Regression test for the invariant the product rests on: a non-member gets 403 on a
      circle, its feed and its live-room ticket, and the circle never appears in their list #verify

Verified working end to end: invite create → preview → accept (idempotent for an existing
member, 404 for a bogus or spent token), the join screen, reactions (422 on an unknown
emoji, 404 on an unknown post, 403 from outside the circle), and the Durable Object live
room — a reaction posted over HTTP arrives on the socket as `reaction.added`.

## Done — awards beyond the streak #awards

- [x] Awards were derived from one number, the week streak, so the only way to earn anything
      was to never miss. That rewards whoever was already consistent and says nothing about
      building the habit *with* people, which is the part of this product that is novel #screens
- [x] `GET /v1/awards` — four counters: week streak, friends, nudges sent, perfect months.
      The streak walk is the same one the Week screen uses, and both endpoints were checked
      to agree rather than assumed to #backend
- [x] Perfect months: a finished calendar month with at least one promise due and none
      missed. Deliberately not the streak — a streak ends for good, a month can be perfect
      again after a bad one. In-progress months are excluded so a good first week cannot
      hand out the award early. Cross-checked against the raw promise rows #backend
- [x] Nudges are a real action, not just a counter: `POST /v1/circles/:id/members/:id/nudge`,
      migration 0009. One per person per week (the UNIQUE key is the rate limit), only into
      an open promise, only inside the circle, never at yourself. Posts to the feed and sends
      a best-effort push, so a nudge still lands for someone with notifications off #backend
- [x] Six new awards across three groups — Together (1, 3 friends), Encouragement (1, 10
      nudges), Whole months (1, 3 perfect months) — and the collection is grouped by what
      each one recognises rather than shown as one ladder of six week-badges #design
- [x] The header no longer claims "Latest award": nothing records when an award was earned,
      and across four metrics the last in the list is not the newest #design
- [x] The nudge button only appears on a member who is not you and whose week is still open,
      so the row never offers a dead action. `IconButton` gained `disabled` #screens
- [x] Regression test drives the whole path — real invite, real goal and promise, then the
      rate limit, the self-nudge refusal and the award counters #verify

## Now — launch, needs the owner #launch

- [x] Production API live at `kept-api.lazydevpro.workers.dev` (23 Sep): mainnet, one `*/5`
      schedule, all three secrets set. Verified end to end: sessions signed with the real secret,
      writes land in `kept-production`, invites + CORS for the site, keyed Jupiter quote and
      price, verification reading a real mainnet transaction through the private RPC in 8s,
      account deletion, sign-in limit 20 then 429 #backend
- [x] Site deployed with `/terms`, `/privacy`, `/join`; a real production invite renders on the
      live join page, a bogus one says it expired #web
- [x] EAS project linked (`@lazydevpro/neon-reserve`, `extra.eas.projectId` in app.json) #mobile
- [x] Release APK 1.0.0 built locally (`npm run release:apk`), signed with a release key kept
      in `~/.kept/android/` — outside the repo. Its fingerprint is in `assetlinks.json`.
      Template permissions KEPT never uses (display over other apps, legacy storage) blocked #mobile
- [x] `~/.kept/android/` (keystore + passwords) backed up by the owner #mobile
- [x] Release key uploaded to EAS as the default production build credentials; EAS reports the
      same SHA-256 (`C0:89:B1:E0:…:EA:59:10`) as the APK and `assetlinks.json` #mobile
- [x] Site redeployed with the release fingerprint in `assetlinks.json`; Google's Digital Asset
      Links check returns `linked: true` for the package and certificate #web
- [ ] Push notifications need FCM: add `google-services.json` (Firebase project) and an
      `EXPO_ACCESS_TOKEN` secret on the Worker #notifications
- [ ] **Device pass with real money**: connect → sign in with wallet → buy $1 → verified → sell →
      settled; plus reinstall → "I already use KEPT" → same account back. Nothing wallet-side has
      run on a phone since 15 Sep #verify
- [ ] **Legal review** of `/terms`, `/privacy` and `RESTRICTED_JURISDICTIONS`
      (`backend/src/lib/terms.ts`, mirrored in `web/lib/terms.ts`, CI checks they agree) against
      the issuers' own restrictions at assets.backed.fi/legal-documentation. Drafted from the
      code, not by a lawyer #launch
- [x] Site offers the Android beta: every "get the app" button opens a notice (beta, real money
      on mainnet, dApp Store coming) whose confirm button downloads the APK from the v1.0.0
      GitHub release. Live and verified #web
- [ ] When the dApp Store listing is live, set `DAPP_STORE_URL` in `web/lib/site.ts` — every
      button becomes a store link. Each new beta: bump `BETA` there (version, URLs, size); the
      tag is pinned because GitHub's `/releases/latest/` skips pre-releases #web
- [ ] Optional: crash reporting (Sentry needs an account/DSN). Render crashes now land on a
      root `ErrorBoundary` instead of closing the app #mobile
- [ ] Staging has ~130 empty anonymous accounts from the rate-limit burst tests (23 Sep). Harmless;
      delete if tidiness matters #backend

## Done — launch readiness (audit fixes, 23 Sep 2026) #launch

- [x] **Wallet sign-in.** A challenge signed by a linked wallet signs this device into that
      wallet's account (`backend/src/wallet-sign-in.ts`). Linking a wallet that already belongs
      to another account offers to switch, reusing the same signature; onboarding has "I already
      use KEPT". The empty account left behind is deleted. Session 7 days → 1 year #backend #mobile
- [x] **Stuck purchases.** A cron every 5 minutes re-queues anything pending > 2 min; a signature
      unseen after 10 min is rejected as never landed; `max_retries` 3 → 10; the verified
      transition is a claim (`AND status = 'pending'`) so a re-queue cannot double-post to feeds;
      the queue handler awaits instead of racing its own implicit ack #backend
- [x] **Rate limits that limit.** Cloudflare's Rate Limiting binding was tried and on staging
      never returned 429 (130+ sign-ins from one address). Replaced with a `RateLimiter` Durable
      Object: sign-ins 20/min per address, Jupiter-backed routes 30/min per user. Verified live:
      20 × 200 then 429 #backend
- [x] **Ways out.** Account screen (header button, replacing the theme toggle): rename, unlink
      wallet, leave circle, appearance, terms, privacy, sign out (only with a linked wallet),
      delete account. Owners can remove members from the circle screen. Server: `DELETE /v1/me`
      (hands owned circles on first), `DELETE /v1/wallets/:address`,
      `DELETE /v1/circles/:id/members/:memberId` #backend #screens
- [x] **Everyone was "Anonymous".** The auth plugin's placeholder name was copied into every
      profile and nothing let anyone change it. Onboarding now asks, Account can edit, defaults
      are "Member XXXX", migration 0011 renames existing ones #backend #screens
- [x] **Terms gate.** Before a first purchase: not a U.S. person, not in a restricted
      jurisdiction, accepts the terms. Enforced server-side (`terms_required`), versioned, never
      on selling #backend #screens
- [x] `/terms`, `/privacy`, `/join` (invite landing), OG/Twitter image, `metadataBase`, canonical
      links, sitemap, `assetlinks.json`, "Get early access" in hero and footer; contact form
      limited to 5 per address per 10 min (KV) — verified 5 × 200 then 429 #web
- [x] `PATCH /v1/me` reset every field it was not sent — changing privacy reset the name #backend
- [x] Share cards were a 500 on every request (`/:postId.svg` is one Hono parameter), said
      "NEON RESERVE", and served any post kind. Fixed, rebranded, kept promises only #backend
- [x] tSpaceX in the Tessera fallback; Jupiter off `lite-api.jup.ag` in backend and site #markets
- [x] Production config: `env.production` (mainnet, `kept-api`), `deploy:staging` /
      `deploy:production`, `eas.json` production → production API on mainnet (APK for the dApp
      Store), MWA identity and invite links on `keptapp.pages.dev` #backend #mobile
- [x] Staging redeployed with 0010 + 0011 applied; sell routes live there #backend
- [x] Root `ErrorBoundary` in the app; CI for all three workspaces plus a terms-sync check #mobile
- [x] **Cron budget.** Workers Free allows 5 cron triggers per account; two per environment
      failed production's deploy. Now one schedule (`*/5`), with the nightly jobs on its 01:15 UTC
      tick (`isNightlyTick`) #backend
- [x] **Fail closed without a secret.** Production, deployed before its secret, issued sessions
      signed with Better Auth's public default key (it only refuses when `NODE_ENV=production`,
      which Workers never sets). Every route but `/` and `/health` now answers 503 until
      `BETTER_AUTH_SECRET` is 32+ characters #backend #security
- [x] Backend tests 16 → 31 #verify

## Now — blocked on hardware or accounts I do not have

- [ ] Push is OFF in local builds: `extra.eas.projectId` is missing from app.json, so
      `getExpoPushTokenAsync` cannot run. EAS builds get it injected; local ones need
      `npx eas init`. Needs the project owner's EAS account #notifications
- [ ] End-to-end reminder delivery is unverified — it needs a real device, an EAS project id
      and `EXPO_ACCESS_TOKEN` on the Worker. Everything up to the Expo API call is tested #verify

- [ ] Verify on a real Android device / Solana Seeker — everything so far was checked on the
      Expo web build. There is no Android SDK on this machine (no `ANDROID_HOME`, no
      `local.properties`, no platform-tools), so the widget rewrite below is **unverified by
      compilation**: its XML is well-formed and every `@color`/`@string`/`R.color` reference
      resolves, but nothing has built it. The adaptive icon and splash have only been checked
      in a simulated launcher mask #verify

- [x] Backfill for pre-0006 holdings: migration 0007 adds `holdings_checked_at`, the daily
      cron queues a bounded batch, and `backfill_holdings` re-reads each transaction from the
      RPC. Rows the RPC can no longer serve are stamped once rather than retried nightly #portfolio
- [x] Widget summary separates live money from devnet rehearsals. `monthUsd`/`recentUsd` are
      live only; `rehearsedMonthUsd`/`rehearsedRecentUsd` are reported alongside. The Week
      tile relabels itself to "Rehearsed this month" when there is no live spend #backend

## Done — clearing the backlog #cleanup

- [x] Reactions toggle. `DELETE /v1/circles/:id/posts/:id/reactions` takes back only your
      own; the chip renders yours as pressed so a second tap is obviously an undo. Covered
      by a test #social
- [x] CORS `allowMethods` did not include DELETE, so the new route was refused in any
      browser before it reached the handler. Found by calling it, not by reading it #backend
- [x] Encouragement shows the feed, capped at 10, instead of only the newest post #screens
- [x] Circles are named on create instead of everyone getting "Slow Money Club", and a
      switcher appears once there is more than one — previously a second circle was created
      silently and then unreachable, because the screen only ever opened `circles[0]` #screens
- [x] Android widget rebuilt in the KEPT identity: `values/colors.xml` +
      `values-night/colors.xml` mirroring the theme tokens, a light card with the app's 24dp
      radius and hairline, "KEPT" in kiwi, and the rings redrawn with the app's own
      geometry, per-ring tinted tracks and gradients. The old widget also drew goal and
      circle **the wrong way round**, so the same week looked different in the two places #widget
- [x] Retired the unused Solana-template scaffolding — all of `features/account/*`, the
      `network-feature-*` screens and `constants/app-styles.ts`. 15 files; `network-provider`
      and `use-network` stay, they are load-bearing #cleanup
- [x] Wire identifiers decided. The `neonreserve:v1:` memo prefix is now `kept:v1:` — safe,
      because verification compares the on-chain memo against the `verification_reference`
      stored on the row, never against a literal, so rows written under the old prefix keep
      verifying. The URL scheme, Android package and Cloudflare resource names stay: they
      identify installs and a live D1 holding real rows, so changing them is a coordinated
      deploy-and-migrate, not a code change. Do it at a real release #brand
- [x] Web auth: the concern was that the session token sat in `localStorage`. It does not —
      checked the live page and the only keys are `kept:theme` and the onboarding flags. The
      session is the httpOnly cookie; the `cookie` header `apiRequest` builds is one browsers
      forbid and drop. The shim is now in-memory so a token cannot be left behind even if
      that changes upstream; verified the session survives a full reload #security

## Next — the landing page #web

Spec agreed: [docs/plans/landing-page.md](docs/plans/landing-page.md). Concept is **scroll is
time** — scrolling the page lives a year of the habit. Reference the user brought was
[gokiwi.in](https://gokiwi.in); its recipe is torn down in §3 of the spec.

- [x] Phase 1 — `web/` workspace stands up. Next.js 16 static export, wrangler configured for
      Workers Assets, tokens generated from `mobile/constants/theme.ts` (35 colours, 12 type
      styles) into `app/tokens.css` + `lib/tokens.generated.ts`, Sora + Inter + Instrument
      Serif self-hosted through `next/font`, Lenis wired into GSAP's ticker, and every scroll
      section gated behind `useScrollScene`. Measured on the built output served through
      wrangler: **Performance 99, Accessibility 100, Best Practices 100, SEO 100, 289 KB
      transferred, CLS 0** on throttled mobile. `npm run check:motion` proves criteria 4 and 5
      against a real browser with the media feature emulated both ways. Not deployed — no
      Cloudflare account, so `npm run deploy` is guarded the same way the backend's is #web
- [ ] `--ink-faint` fails WCAG AA as a text colour on light surfaces — measured **3.10:1** on
      `background` and **3.22:1** on `surface`, against a 4.5:1 floor. It is fine on
      `surfaceInverse` (6.00:1). The site now uses `--ink-muted` (6.17 / 6.41) for quiet text,
      but **the app has the same pairing**: `role="caption"` with `colors.inkFaint` on white
      cards, in `app/awards.tsx` and elsewhere. Either darken `inkFaint` in the palette or stop
      using it for text — a palette change touches every screen, so it wants a deliberate pass
      rather than a drive-by #design #a11y
- [x] Phases 2–5 — **all nine sections built**, 14 screens of scroll. Hero with the rings drawn
      on load, the word-by-word manifesto, the 52-week centerpiece, how-it-works, the live
      market, the privacy toggle, the 12 awards and the home-screen widget. Product UI is
      rebuilt as live HTML from the generated tokens rather than screenshotted #web
- [x] Phase 3 detail — ring geometry **ported** from `mobile/features/progress/rings.tsx`, not
      re-derived: same `width = size * 0.105`, same per-angle segment colouring, same cap
      shadow. Driven imperatively through a ref so a scrub does not re-render 180 paths a
      frame. Every figure on screen comes from one dataset in `web/lib/year.ts`, so the beats,
      the bar strip, the running total and the streak cannot contradict each other #web
- [x] Phase 5 — prices are **live**, but not through our Worker. Jupiter Price v3 is keyless
      and CORS-open, so `web/lib/prices.ts` calls it from the browser. Tessera has no CORS and
      quotes *marks* rather than ticks, so those three are captured with an as-of date and
      labelled as marks. Mints were resolved from Jupiter's token search, not memory — the
      first draft had `XsDoVfqe…` labelled SPYx when it is Tesla #web
- [ ] Backend public read group — still wanted, now as cleanup rather than a blocker.
      `/v1/trades/quote` and `/v1/trades/asset` sit under `app.use("/v1/*", authenticated)`
      (`backend/src/app.ts:59`) so the site cannot use them, even though neither handler reads
      `userId`. Mounting a public group above that middleware would put the mint list back in
      one place and let us rate-limit it ourselves instead of leaning on Jupiter's
      (`backend/src/app.ts:29-37` also pins CORS to a single `APP_ORIGIN`) #web #backend
- [x] **The circle section** — §10, between Privacy and Awards. One Friday evening scrubbed
      across a pinned viewport: four people in a row, promise rings closing one at a time,
      the app's own notifications stacking underneath, reactions popping onto each card, and
      a nudge landing on *you* at 8:15pm. The coral ring was the only one of the three the
      page never explained, because its value comes from other people doing something. Every
      figure comes from one dataset (`web/lib/friday.ts`) and every notification is the
      product's literal copy — the feed row the backend writes, and the two push payloads the
      Worker sends #web
- [x] Two behaviours, one painter. `useMotionScene` gained an optional `when` query ANDed onto
      the reduced-motion gate; ≥72rem scrubs, <72rem autoplays on entry and pauses off-screen.
      Verified both: autoplay walks 5:04pm → 9:40pm in 15s hitting every beat in order, and
      stops when scrolled away #web
- [x] The first layout put the four in a 2×2 with the stack floated over it, Muzzle-style. At
      1024 **and** 1440 the stack landed on the second card and hid the ring it was announcing
      — two elements competing for one column that was never wide enough. Separated onto the
      axis with room: a row of four, notifications beneath #web
- [x] **Contact — floating button, bottom right**, opening a native `<dialog>` (focus trap,
      Escape and `::backdrop` for free) and posting to Discord #web
- [x] The webhook does **not** go in the bundle. A Discord webhook URL *is* the credential —
      shipped to the browser it is one "view source" from permanent spam, and rotating it means
      a redeploy. `web/functions/api/contact.ts` is a Pages Function holding it as a secret.
      Set it with `npx wrangler pages secret put DISCORD_WEBHOOK_URL`; unset, the route answers
      503 and the form says so rather than failing silently #web #security
- [x] `allowed_mentions: { parse: [] }` on the Discord payload, so a message containing
      `@everyone` cannot ping the server. Stripping the text would be a filter to get around;
      this is Discord refusing to resolve any mention at all #web #security
- [x] Honeypot field, hidden from sight *and* from assistive tech (`aria-hidden` + `tabIndex=-1`)
      — a screen-reader user tabbing into an invisible "Website" box would otherwise be flagged
      as a bot by a form they cannot see. A caught bot gets a 200 and no delivery, because a 422
      tells whoever wrote it which field gave them away #web
- [ ] Rate-limit the contact route. Honeypot and length caps are in; there is no per-IP limit
      because Pages Functions have no store bound here. Wants a KV namespace #web
- [ ] Phase 6 — polish and optimise. Deferred deliberately: build first, optimise after.
      Outstanding against §9: **Performance 93, two points under the 95 floor** (Accessibility,
      Best Practices and SEO are all 100; 367 KB transferred, CLS 0; LCP 3.2s is the cost).
      Was 94 / 354 KB / 3.1s before the circle section — so that section cost one point and
      13 KB. Measured three times to be sure: a single run on a loaded machine read 82, which
      was contention, not the page.
      Then: convert the 3D PNGs to WebP, preloader, magnetic cursor, OG image, and a frame
      trace of every pinned section #web

## Done — selling #trade

- [x] There was no way out. Six trade routes, all buy-direction, `inputMint` hardcoded to
      USDC, and no sell affordance anywhere in the app — money went in through KEPT and did
      not come out through it. Self-custody meant nobody was trapped (swap it in any wallet),
      but "open Phantom" is not an answer a consumer product gets to give #trade
- [x] `GET /v1/trades/sell-quote` — priced in asset units, not dollars, because a seller has
      a quantity rather than a budget. The Token-2022 transfer fee is reported on its own
      line rather than netted: Jupiter prices the route, the mint takes the fee outside it,
      and folding them together would put a number on screen Jupiter never quoted #backend
- [x] `POST /v1/trades/sell-order` — verified wallet, mainnet only, and a holding check
      before the wallet opens. The chain would reject an over-sell anyway, but only after
      the reader approved it and paid a fee to find out #backend
- [x] `lib/holdings.ts` — one implementation of "what do you hold", shared by the portfolio
      and the sell check, so the app can never offer a sale it will then refuse. Base units
      are bigint: a 9-decimal position passes 2^53 and SQLite's `SUM()` silently rounds once
      it overflows an integer #backend
- [x] Migration 0010 — `direction` on contributions and trade_orders. Sells sit beside buys
      because holdings are the running sum of both, and splitting them means every read
      joins two tables and every new query is a chance to forget one #backend
- [x] Average-cost accounting. Total spend stops being the cost basis the moment anything is
      sold, so the portfolio now splits unrealised (what is held, against its basis) from
      realised (what sales brought in, against the average cost of those units). Verified
      against a worked example: two buys at $10 and $30 a unit, sell 5 of 20 for $150 →
      $50 realised, 15 units left at a $300 basis #backend
- [x] Verification mirrors rather than branching late: a buy must increase the linked
      wallet's balance of the mint, a sell must decrease it. The old predicate would have
      rejected every sell #backend
- [x] A sell never closes a week and never reaches a feed. Keeping a promise means putting
      money in; taking it out is not an achievement and is nobody else's business #backend
- [x] **The widget counted sells as deposits.** Proceeds live in the same column a buy uses
      for spend, so "put in this month" read $110 after a $20 buy and a $90 sale. Fixed with
      `direction = 'buy'`, and the regression test was checked by removing the filter and
      watching it fail #backend
- [x] Sell sheet on the portfolio, with 25/50/All presets against the holding and a
      secondary button — getting money out has to be possible, not encouraged. Realised P&L
      shows on a position only once something has actually been sold #screens
- [ ] Unverified on-chain: every sell path is mainnet-only and this machine has no mainnet
      key, so the routes are covered by tests and typecheck but no real sale has settled.
      Needs the same device rehearsal the buy path needs #verify
- [ ] No fiat off-ramp. Selling returns USDC to the user's own wallet; turning that into
      money in a bank is a separate integration KEPT does not have #trade

## Done — the purchase moment #screens

- [x] There was no purchase animation. The entire celebration was `Alert.alert()` — a native
      OS dialog with an OK button — and then the sheet closed onto an unchanged screen. No
      haptic, no sound, no ring. Onboarding's **practice** ring fired a success haptic while
      the real purchase fired nothing, so the rehearsal felt better than the event #screens
- [x] Two stages, because signing is instant and verification is not. `KeptMoment` replaces
      the ticket the moment the wallet returns a signature: the promise ring sweeps closed, a
      success haptic fires, and the copy says what is true right then — "that's in",
      "confirming on-chain". The word *kept* is deliberately not used yet #screens
- [x] `settlement.tsx` — a root-level watcher that polls the pending contribution and, when
      the chain agrees, brings a quiet banner, a light haptic, and a refetch of the rings,
      widget and portfolio. It sits above the screens because the reader has closed the sheet
      and changed tabs long before the answer arrives; a celebration that only fires if you
      are still on the screen that started it is one most people never see #screens
- [x] Polling rather than push: notifications are opt-in, off by default in local builds, and
      a permission prompt is not what to spend on a confirmation someone is already waiting
      for. It runs only while something is pending, backs off after 30s and gives up at three
      minutes rather than nagging #mobile
- [x] `Rings` gained `only` in **both** implementations. `goal={0} circle={0}` still draws
      those tracks, so the success screen showed two extra rings sitting visibly unfinished at
      the exact moment it was saying something went right. Caught by looking at it, not by
      reading it #design
- [x] `useSafeAreaInsets` in the banner would have **crashed every screen** — it throws
      without a `SafeAreaProvider` and this app does not mount one, it relies on
      `SafeAreaView`'s native insets. Found before it shipped; the banner uses `SafeAreaView`
      like `components/ui.tsx` does #mobile
- [x] Selling is watched by the same machinery and gets none of the celebration — no ring, no
      success screen, just the settled banner. Getting money out has to be possible, not
      encouraged #screens
- [ ] Verified by rendering the moment in the Expo web export and screenshotting it, plus
      typecheck, lint and an Android export. The **haptics are unverified** — they no-op on
      web, so they need the same device pass everything else is waiting on #verify
- [ ] Still silent. The cup score in `docs/launch-film.md` §2 is the sound this moment wants,
      and the app's confirmation tone should be the same recording as the film's #design