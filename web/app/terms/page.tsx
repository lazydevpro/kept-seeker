import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal'
import { CRYPTO_RESTRICTED_JURISDICTIONS, RESTRICTED_JURISDICTIONS } from '@/lib/terms'

export const metadata: Metadata = {
  title: 'Terms of use — KEPT',
  description: 'The terms for using KEPT, including who may buy through it and the risks of doing so.',
  alternates: { canonical: '/terms' },
}

const listOf = (items: readonly string[]) => `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`
const restricted = listOf(RESTRICTED_JURISDICTIONS)
const cryptoRestricted = listOf(CRYPTO_RESTRICTED_JURISDICTIONS)

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="7 October 2026">
      <p className="summary">
        KEPT helps you keep a weekly investing habit. It is not a broker, bank or adviser, it never holds your
        money, and what you buy can lose value. Tokenized stocks and private-market tokens are not available to
        U.S. persons or to residents of {restricted}. Crypto is not available to residents of {cryptoRestricted}
        .
      </p>

      <h2>1. Agreeing to these terms</h2>
      <p>
        By using KEPT you agree to these terms. You must be at least 18 and legally able to agree to them where
        you live. If you do not agree, do not use KEPT.
      </p>

      <h2>2. What KEPT is — and is not</h2>
      <p>
        KEPT is software. It helps you set a goal, make a weekly promise to yourself, share progress with
        friends you invite, and buy or sell tokens from your own Solana wallet through third-party routing.
      </p>
      <ul>
        <li>KEPT does not hold, control or have access to your funds, tokens or private keys.</li>
        <li>
          KEPT does not execute trades on your behalf. Every transaction is signed by you, in your wallet.
        </li>
        <li>
          KEPT is not a broker, exchange, bank or investment adviser, and nothing in the app is investment,
          legal or tax advice.
        </li>
      </ul>

      <h2>3. Who may buy through KEPT</h2>
      <p>
        Before your first purchase you will be asked to confirm, and by buying you confirm, that you are not on
        any sanctions list, that buying what you buy is lawful where you are, and:
      </p>
      <ul>
        <li>
          <strong>for crypto,</strong> that you are not resident in, located in or a citizen of{' '}
          {cryptoRestricted}. These are the regions under U.S. embargo, which the Solana dApp Store also
          excludes, and the United Kingdom, whose rules on promoting crypto to consumers KEPT does not meet;
        </li>
        <li>
          <strong>for tokenized stocks and private-market tokens,</strong> that you are not a U.S. person, are
          not acting for or on behalf of one, and are not resident in, located in or a citizen of {restricted}.
          Their issuers restrict who may acquire them.
        </li>
      </ul>
      <p>
        Issuers publish their own, authoritative restrictions — for xStocks, at{' '}
        <a href="https://assets.backed.fi/legal-documentation">assets.backed.fi/legal-documentation</a>. Where
        they are stricter than this list, theirs apply. Selling what you already hold is never restricted by
        KEPT.
      </p>

      <h2>4. The assets</h2>
      <ul>
        <li>
          <strong>xStocks</strong> are tokens issued by a third party that track the price of a listed share or
          fund. They are not the share itself, and do not give you the rights of a shareholder.
        </li>
        <li>
          <strong>Tessera T-Tokens</strong> are loan participation rights whose value is linked to a private
          company’s valuation. They are not equity in that company, can be illiquid, and carry a 0.20% fee on
          every transfer that the token itself charges.
        </li>
        <li>
          <strong>Crypto</strong> means the crypto assets offered in KEPT: SOL, the Solana network’s native
          asset; cbBTC, a token issued by Coinbase, which states that it is backed one for one by bitcoin it
          holds — it is not bitcoin itself, and depends on Coinbase; and SKR, the native token of the Solana
          Mobile ecosystem. None of them is a share, a deposit or a claim on KEPT or anyone else, and none pays
          interest or carries ownership rights.
        </li>
      </ul>
      <p>
        All of them depend on the Solana network and the liquidity available when you trade, and, where they
        have one, on their issuer. KEPT does not issue, guarantee or stand behind any of them.
      </p>

      <h2>5. Risk</h2>
      <p>
        Investing involves risk, including losing everything you put in. Prices move, sometimes sharply — crypto
        prices can rise or fall by a large share of their value within hours; routes can fail; networks can
        congest; issuers can halt, freeze or redeem tokens under their own terms. Past performance says nothing
        about the future. Only invest what you can afford to lose.
      </p>

      <h2>6. Your wallet and transactions</h2>
      <p>
        You are responsible for your wallet, its keys and every transaction you approve. Blockchain transactions
        are final — KEPT cannot reverse, cancel or refund one. Network fees and any fees charged by routes or
        tokens are yours.
      </p>

      <h2>7. Your circle</h2>
      <p>
        Be decent to the people you invite. Do not use KEPT to harass anyone, to impersonate anyone, or to share
        anything unlawful. A circle’s owner can remove members, and anyone can leave a circle at any time.
      </p>

      <h2>8. Your account</h2>
      <p>
        Your account is created anonymously and is tied to your device until you link a wallet. If you lose your
        device without a linked wallet, the account cannot be recovered. You can delete your account at any time
        from the app; see the <a href="/privacy">privacy policy</a> for what that removes.
      </p>
      <p>We may suspend or close accounts used to break these terms or the law.</p>

      <h2>9. No warranty</h2>
      <p>
        KEPT is provided “as is”. We do our best to keep it running and accurate, but we do not promise it will
        be uninterrupted, error-free, or that prices, quotes and figures shown are current. To the fullest
        extent the law allows, we are not liable for losses arising from your use of KEPT, from the assets you
        buy, or from the networks and third parties it relies on.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these terms. If a change matters, the app will ask you to agree again before your next
        purchase.
      </p>
    </LegalPage>
  )
}
