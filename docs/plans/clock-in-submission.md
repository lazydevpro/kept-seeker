# KEPT — submitting to Clock In (Solana Mobile hackathon)

Status: **planned 6 Oct 2026, not started.** Source: <https://solanamobile.radiant.nexus> and its
[Terms](https://solanamobile.radiant.nexus/legal/clock-in-terms.pdf), read 6 Oct.

## 1. The deadline

**Submissions close Fri 9 Oct 2026, 12:29 IST** (06:59 UTC). No late entries. Judging opens
10 Oct, results 10 Nov. Planning on **Thu 8 Oct, 22:00 IST** as our own deadline, leaving a
night and a morning of slack.

Entries go in on **Align** (Radiants): sign in, builder profile, register from the Clock In
Registration screen, then submit. A submission can be edited while it is a draft; accepting the
final submission agreement locks it. Align's AI Coach reviews a draft against the rubric, so
a draft should be in by Wednesday to get that feedback.

## 2. What they ask for, and where KEPT stands

| Requirement | KEPT today | Gap |
|---|---|---|
| Functional Android APK | v1.0.1 on GitHub releases (pre-release, mainnet, 81 MB) | Never had a wallet-side pass on a phone (TODO: "Device pass with real money"). Built before the last day of work, so it doesn't match the repo |
| Solana Mobile Stack + Mobile Wallet Adapter | `@wallet-ui/react-native-kit` (MWA), Seed Vault / Phantom / Solflare | None, but the video has to *show* the wallet approval |
| Meaningful Solana interaction | Real xStocks / Tessera buys from the user's wallet, verified on-chain by the backend | Show one transaction on an explorer in the video |
| Mobile-first, not a PWA | Expo native app, native home-screen widget, MWA | The browser "demo mode" (`mobile/features/demo/`) must **not** be the demo: their rules say a video nobody can install is not a submission, and PWA-looking work scores poorly |
| GitHub repo someone can clone and run | Public `lazydevpro/kept`, README with local start, CI | Last push 24 Sep; **43 files uncommitted** (deck, film, demo mode, circle changes, tests). Judges read the commits up to the deadline |
| Demo video (~3 min) showing functionality | The film "Next week" (73.5 s, animated, voiced) | No screen recording of the real app. The film is the hook, not the demo |
| Pitch deck | `docs/kept-deck.pdf`, 20 slides (uncommitted) | One pass against the four criteria below |

Eligibility: project started 20 Sep 2026, after the 8 Sep launch, so the 3-month rule holds and
all of it is hackathon work. India is an eligible country. USDC prizes need **no VC or angel
funding**. Finalists do KYC through Sumsub. Winners must be **live on the Solana dApp Store
within 30 days of 10 Nov** (by 10 Dec), and merely submitting for review doesn't count.

## 3. How it's judged, and what each criterion needs from us

25% each. They're scored from the demo video (completion), the commits (technical depth),
the mobile experience, the use of Solana, and the deck (clarity and vision).

| Criterion | What KEPT shows |
|---|---|
| Stickiness & PMF (Seeker community, repeated use) | The weekly ring that resets, streak + perfect months, nudges, cheers, the widget. The deck carries the retention argument from `docs/submission.md` |
| User experience | Real phone footage: rings animating, two-tap MWA approval, the widget on the home screen |
| Innovation / X-factor | Private social investing: friends see *that* you kept it, never *how much*; the streak is verified on-chain, not ticked |
| Presentation & demo | The film's 20 s hook into a narrated phone walkthrough; the deck |

## 4. Sponsor tracks and other prizes (researched 6 Oct)

Clock In has **no sponsor tracks beyond SKR and ORE**: Align's API lists one track, and there's
nothing on Superteam Earn. Note that their AI Coach "uses an earlier rubric" (the site says so),
so read its feedback against the four 25% criteria, not literally.

- **SKR integration ($10k in SKR)**: the blog asks for SKR "for in-app purchases, rewards,
  access, or invent your own use case"; staking doesn't qualify, and the form asks "does your
  application have an SKR integration? If so, how?". The mint is
  `SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3` (solanamobile.com/skr). Jupiter routes it (about
  $689k liquidity). **"Pay your promise in SKR"** is the in-app-purchase use the blog names.
  Merely listing SKR as buyable is probably too thin to win.
- **ORE matched prize**: ORE would have to be a core, promoted part of the product. **Skip**:
  it isn't KEPT.

**Colosseum, Crypto World's Fair**: open now, **closes 12 Oct 11:59 pm PT (13 Oct 12:29
IST)**. Clock In's FAQ allows entering both. Prizes:
- Solana track: $10k each to 10 projects;
- 20 global awards of $15k, and a $30k grand champion;
- an accelerator.

It asks for:
- a product demo video of 3 minutes or less;
- a separate 2–3 minute presentation video;
- a go-to-market plan;
- a logo, a repo, and a disclosure of past work (only work from 14 Sep–12 Oct is judged).

Every member must register on colosseum.com by the deadline.

- **Superteam India track** (rides on the Colosseum entry, "India" selected): $2.5k / $1.5k /
  $1k, India-based teams, closes 13 Oct 06:59 UTC.

The Clock In demo video and deck carry straight over. The extra work is the presentation video
and the go-to-market page, in the four days after Clock In closes.

## 4a. Crypto on the shelf (proposed, not decided)

A third shelf next to Public and Private, curated:
- **SOL**: wrapped SOL `So11111111111111111111111111111111111111112`;
- **BTC**: cbBTC `cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij`, issuer-backed with no bridge
  (WBTC `3NZ9…qmJh` is more liquid but bridged);
- **SKR**;
- **ETH, optionally**: Wormhole ETH `7vfC…voxs`, the only liquid ETH, bridged.

What it costs:
- **Most of these need little change.** They're SPL tokens, and verification already counts the
  token received.
- **Native SOL needs its own lamport-based check**, for both buy and sell, with a test.
- **The U.S. gate stays as it is.** Opening crypto to U.S. persons is a legal decision, not a
  hackathon change.
- **Size**: about a day, plus the same device pass.

## 5. The demo video (target 2:45, hard cap 3:00)

| Time | What | Source |
|---|---|---|
| 0:00–0:20 | Problem → "Next week never comes." → kept. | Cut from the film |
| 0:20–0:45 | Onboarding: name, goal, weekly promise | Phone recording |
| 0:45–1:25 | Keep week one: pick a stock, live quote, **approve in the wallet (MWA)**, verified, ring closes | Phone recording |
| 1:25–1:40 | The transaction on Solscan: the user's wallet, the memo | Phone or desktop |
| 1:40–2:15 | The circle: a friend's ring, a cheer, a nudge; the post shows no amount | Two phones or two accounts |
| 2:15–2:30 | The widget on the home screen; the portfolio only you see; sell | Phone recording |
| 2:30–2:45 | Promises compound. KEPT · APK link · repo · "Built for Seeker" | The film's end card |

Recording on the phone: Android's built-in screen recorder (or `adb shell screenrecord`), 1080p,
notifications silenced, real mainnet with $1 buys. The voice comes from the film's pipeline (same
Gemini voice, one take), so the two halves sound like one piece. Built in Remotion as a new
composition in `video/`: phone footage inside the film's `Phone` frame.

**The purchases are made by the owner on their phone.** Claude doesn't execute trades.

## 6. Plan, by day

**Tue 6 Oct (today)**
1. Owner: register on Align and check the sign-up deadline there.
2. Commit and push the 43 pending files in logical commits (on the owner's go-ahead).
3. Fresh-clone check: clone to a temp dir, install, run each workspace's typecheck and tests,
   fix anything a stranger would hit. README: a "Clock In" block at the top (APK, video,
   deck, how to install, how to run).
4. The demo's narration script and a shot list for the phone recording.

**Wed 7 Oct**
5. Owner: device pass on the phone with $1 real money (connect → sign in with wallet → buy →
   verified → sell → reinstall → "I already use KEPT"). Claude fixes anything found.
6. If the app code changed since v1.0.1: EAS production build → v1.0.2 release, bump `BETA` in
   `web/lib/site.ts`, redeploy the site.
7. Owner: record the phone takes from the shot list.
8. Draft the submission on Align (text from `docs/submission.md`); run the AI Coach.

**Thu 8 Oct**
9. Assemble the demo video, verify it (stills, listen-back), render.
10. Deck pass against the rubric; export the PDF; commit.
11. Owner: upload the video (YouTube unlisted, with the showcase thumbnail), paste the links,
    final submit by 22:00 IST.

**Fri 9 Oct**: slack only. Closes 12:29 IST.

## 7. Risks

- **No Android phone or wallet funds available.** Then the fallback is an Android emulator on
  this Mac with a test wallet. That's weaker on camera, and needs ~10 GB of the 11–15 GB free.
  Settle this today.
- **The device pass finds a bug in the buy path.** That's why it's Wednesday morning, not
  Thursday. Allow for one EAS build cycle (~20–30 min).
- **APK ≠ repo.** The technical review may build from source; ship v1.0.2 from the commit
  that's submitted.
- **Claims.** The rules disqualify misleading material: no user counts, no return figures; the
  film's $18,236 stays footnoted as an illustration.
