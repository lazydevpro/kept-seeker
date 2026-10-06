'use client'

import { useEffect, useId, useState } from 'react'
import { Card, Chip } from '@/components/ui'
import {
  CAPTURED_ON,
  LISTINGS,
  MARKS_CAPTURED_ON,
  PRIVATE_MARKS,
  fetchQuotes,
  money,
  units,
  type Quote,
} from '@/lib/prices'
import styles from './market.module.css'

/**
 * The proof section. Everything above this is a story; this is the part a sceptic checks.
 *
 * The prices are real, fetched in the reader's browser from Jupiter, and the calculator quotes
 * a real amount against them. A landing page that shows live market data it actually reads is
 * worth more than three paragraphs claiming the product is on-chain.
 *
 * The resting state is the captured price rather than a skeleton, so the section is complete
 * before the fetch resolves, complete if the fetch fails, and complete with JavaScript off.
 * The only thing the fetch changes is whether it says "live" or "as of 21 September".
 */

const REST: Quote[] = LISTINGS.map((l) => ({
  symbol: l.symbol,
  name: l.name,
  kind: l.kind,
  price: l.capturedPrice,
  change24h: null,
  stale: true,
}))

const PRESETS = [10, 20, 50, 100]

export function Market() {
  const [quotes, setQuotes] = useState<Quote[]>(REST)
  const [amount, setAmount] = useState(20)
  const [pick, setPick] = useState(LISTINGS[0]!.symbol)
  const inputId = useId()
  const assetId = useId()

  useEffect(() => {
    const controller = new AbortController()
    fetchQuotes(controller.signal).then(setQuotes)
    // One fetch per visit. This is a shelf for a weekly habit, not a trading screen — polling
    // would add load and change nothing the reader would notice.
    return () => controller.abort()
  }, [])

  const selected = quotes.find((q) => q.symbol === pick) ?? quotes[0]!
  const live = quotes.some((q) => !q.stale)
  const received = amount / selected.price

  return (
    <section className={styles.section} aria-labelledby="market-heading">
      <div className="shell">
        <header className={styles.head}>
          <p className="eyebrow">What you are actually buying</p>
          <h2 id="market-heading">
            Real assets, <em className="serif">real chain.</em>
          </h2>
          <p className="lede">
            Tokenised equities, crypto and private-market names, settled on Solana from a wallet only you hold
            the keys to.
          </p>
        </header>

        <div className={styles.grid}>
          {/* ── Live ticker ── */}
          <Card className={styles.ticker}>
            <div className={styles.tickerHead}>
              <h3 className={styles.cardTitle}>Public markets</h3>
              <Chip label={live ? 'Live · Jupiter' : `As of ${CAPTURED_ON}`} tone={live ? 'kiwi' : 'neutral'} />
            </div>
            <ul className={styles.rows}>
              {quotes
                .filter((quote) => quote.kind === 'stock')
                .map((quote) => (
                  <Row key={quote.symbol} quote={quote} />
                ))}
            </ul>
            <h4 className={styles.subhead}>Crypto</h4>
            <ul className={styles.rows}>
              {quotes
                .filter((quote) => quote.kind === 'crypto')
                .map((quote) => (
                  <Row key={quote.symbol} quote={quote} />
                ))}
            </ul>
          </Card>

          {/* ── Buy ticket ── */}
          <Card className={styles.ticket}>
            <h3 className={styles.cardTitle}>Your weekly $20</h3>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={inputId}>
                You pay
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.currency}>$</span>
                <input
                  id={inputId}
                  className={`${styles.input} numeric`}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={10000}
                  step={1}
                  value={amount}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    setAmount(Number.isFinite(next) ? Math.min(10000, Math.max(0, next)) : 0)
                  }}
                />
                <span className={styles.suffix}>USDC</span>
              </div>
            </div>

            <div className={styles.presets} role="group" aria-label="Common amounts">
              {PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={styles.preset}
                  data-active={amount === value}
                  onClick={() => setAmount(value)}
                >
                  ${value}
                </button>
              ))}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={assetId}>
                You buy
              </label>
              <select
                id={assetId}
                className={styles.select}
                value={pick}
                onChange={(event) => setPick(event.target.value)}
              >
                {quotes.map((quote) => (
                  <option key={quote.symbol} value={quote.symbol}>
                    {quote.symbol} — {quote.name}
                  </option>
                ))}
              </select>
            </div>

            <dl className={styles.receipt}>
              <div>
                <dt>You receive</dt>
                <dd className="numeric">
                  {amount > 0 ? units(received) : '—'} {selected.symbol}
                </dd>
              </div>
              <div>
                <dt>Price each</dt>
                <dd className="numeric">${money(selected.price)}</dd>
              </div>
            </dl>

            <p className={styles.fine}>
              {live
                ? 'Priced against a live Jupiter quote. Nothing is submitted from this page.'
                : `Priced against the ${CAPTURED_ON} capture — the live quote could not be reached.`}
            </p>
          </Card>

          {/* ── Private marks ── */}
          <Card className={styles.privates}>
            <div className={styles.tickerHead}>
              <h3 className={styles.cardTitle}>Private markets</h3>
              <Chip label="Marked, not traded" tone="grape" />
            </div>
            <ul className={styles.rows}>
              {PRIVATE_MARKS.map((item) => (
                <li key={item.symbol} className={styles.row}>
                  <span className={styles.rowSymbol}>{item.symbol}</span>
                  <span className={styles.rowName}>{item.sector}</span>
                  <span className={`${styles.rowPrice} numeric`}>${money(item.mark)}</span>
                  <span className={`${styles.rowChange} numeric`} data-dir="flat">
                    {item.valuation}
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.fine}>
              Loan participation rights in pre-IPO names, marked periodically rather than quoted continuously.
              Held through Tessera, as of {MARKS_CAPTURED_ON}.
            </p>
          </Card>
        </div>
      </div>
    </section>
  )
}

function Row({ quote }: { quote: Quote }) {
  return (
    <li className={styles.row}>
      <span className={styles.rowSymbol}>{quote.symbol}</span>
      <span className={styles.rowName}>{quote.name}</span>
      <span className={`${styles.rowPrice} numeric`}>${money(quote.price)}</span>
      <span
        className={`${styles.rowChange} numeric`}
        data-dir={quote.change24h === null ? 'flat' : quote.change24h >= 0 ? 'up' : 'down'}
      >
        {quote.change24h === null ? '—' : `${quote.change24h >= 0 ? '+' : ''}${quote.change24h.toFixed(2)}%`}
      </span>
    </li>
  )
}
