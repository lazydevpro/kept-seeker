# KEPT for Seeker — _Promises compound._

KEPT is a private social investing habit app for Solana Mobile. You make one small weekly
promise — *$20, every Friday* — and keep it by buying a tokenized stock, a crypto asset or a
private-market token from your own wallet. A few people you trust see **that** you kept it,
never **how much**.

## Clock In — a Solana Mobile hackathon

| | |
|---|---|
| APK | [KEPT 1.1.0 for Android](https://github.com/lazydevpro/kept-seeker/releases/tag/v1.1.0) — install on a Seeker or any Android 7.0+ phone |
| Demo video | _added with the submission_ |
| Deck | [docs/kept-deck.pdf](docs/kept-deck.pdf) |
| Site | <https://kept-seeker.pages.dev> |
| Network | Solana mainnet; every purchase is real USDC from the user's own wallet |

**How it uses the Solana Mobile Stack.**
- **Wallet:** connecting and signing go through Mobile Wallet Adapter (`@wallet-ui/react-native-kit`),
  so on a Seeker approvals use Seed Vault. Phantom or Solflare work the same on any Android phone.
- **Buying:** a purchase is a Jupiter swap from USDC. The user signs it in their own wallet
  (MWA `signTransactions`), and it lands through Jupiter's execute endpoint. KEPT never holds
  funds or keys.
- **Verification:** the backend reads the confirmed transaction back from the chain before the
  week counts. It checks the wallet and the balance change of the asset bought, and SOL is
  read from lamports. Nobody can tick a box.
- **Native Android:**
  - a home-screen widget drawing the week's rings (`mobile/modules/neon-widget`);
  - invite links that open the app (Android App Links);
  - nothing that works only in a browser.

**New for Clock In.** The Seeker edition adds a **crypto shelf**: SOL, bitcoin as Coinbase's
cbBTC, and SKR, the Solana Mobile ecosystem's own asset. It sits beside tokenized stocks
(xStocks) and private markets (Tessera). This edition also runs on a stack of its own, listed
below.

**Try it.**
1. Install the APK and allow the install when Android asks.
2. Have a wallet app with a few dollars of USDC and a little SOL for fees.
3. Set a goal and a weekly promise, connect the wallet, and keep week one with a $1 buy.

Buying isn't offered to U.S. persons or in a few restricted countries. The stock and
private-market issuers don't allow it, and this edition applies the same terms to crypto. Goals,
circles, cheers and nudges work everywhere.

## Workspace

- `mobile/` — Expo/React Native app (`com.lazydevpro.keptseeker`), Mobile Wallet Adapter, SVG progress rings, and a native Android home-screen widget.
- `backend/` — Cloudflare Worker API using D1, Durable Objects, Queues, Better Auth, and scheduled jobs.
- `web/` — the landing page, `/terms`, `/privacy` and the `/join` invite page, on Cloudflare Pages.
- `docs/design/` — the KEPT design system, the source of truth for the interface.
- `docs/private-markets.md` — Tessera and PreStocks compared, down to the mint extensions.

Where things run:

| | |
|---|---|
| Site | <https://kept-seeker.pages.dev> — Cloudflare Pages, `cd web && npm run deploy` |
| API, staging (devnet) | `https://kept-seeker-api-staging.keptseeker.workers.dev` (not deployed) — `cd backend && npm run deploy:staging` |
| API, production (mainnet) | <https://kept-seeker-api.keptseeker.workers.dev> — `cd backend && npm run deploy:production` |
| Release APK | `cd mobile && npm run release:apk` — signed with this app's own key (`npm run release:key`, once) |
| Cloudflare | its own account, pinned by `account_id` in every `wrangler.jsonc`; the `kept-seeker` wrangler profile is bound to this folder |

CI (`.github/workflows/ci.yml`) runs every workspace's gates on each push; deploys stay manual.

## Local start

Start the backend first:

```bash
cd backend
npm install
cp .dev.vars.example .dev.vars
# Put a random 32+ character value in BETTER_AUTH_SECRET.
npm run db:migrate:local
npm run dev
```

Then run the Android development build:

```bash
cd ../mobile
npm install
npm run android
```

An Android emulator reaches the local Worker at `http://10.0.2.2:8787`. For a physical Solana phone, copy `mobile/.env.example` to `.env` and replace the URL with the computer's LAN address.

## Safe defaults

- Local chain is Solana devnet.
- Live xStocks purchases are rejected unless the backend is explicitly configured for `mainnet-beta` and given a Jupiter API key.
- Social posts and widgets expose progress only unless the user changes privacy settings.
- A submitted signature remains pending until a queue consumer checks the confirmed Solana transaction and linked wallet.
- Auth identities and Solana wallets are separate and linked using an expiring signed-message challenge.

See [backend/README.md](./backend/README.md) and [mobile/README.md](./mobile/README.md) for details.

Some internal names (the widget module `neon-widget`, the backend package `@neon-reserve/backend`)
keep the project's original codename; nothing user-facing does.
