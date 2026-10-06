'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import styles from './contact.module.css'

/**
 * A floating contact button, bottom right, and the panel it opens.
 *
 * Fixed rather than parked in the footer because the page is fourteen screens of scroll and
 * the moment someone wants to get in touch is not reliably at the end of it.
 *
 * ── Why `<dialog>` ──
 *
 * The native element, opened with `showModal()`, brings focus containment, Escape-to-close,
 * `inert` on everything behind it and a `::backdrop` to style — all the parts of a modal that
 * are tedious to write and easy to write *almost* correctly. A hand-rolled div would need a
 * focus trap, a key handler, an aria-modal, a scroll lock and a focus-return, and would still
 * be worse for a screen reader.
 *
 * ── Where it posts ──
 *
 * `/api/contact`, a Pages Function in the same project, which forwards to Discord. The
 * webhook URL is a Pages secret and never reaches this file — see `functions/api/contact.ts`
 * for why that matters more than it might look.
 */

type Status = 'idle' | 'sending' | 'sent' | 'error'

const OPEN_EVENT = 'kept:contact'

/**
 * Open the contact panel from anywhere on the page, optionally with a message already
 * written — "Get early access" uses it so asking is one tap. An event rather than shared
 * state because the panel is mounted once, at the root, and its callers are scattered
 * through sections that have no other reason to know about each other.
 */
export function openContact(message?: string) {
  window.dispatchEvent(new CustomEvent<{ message?: string }>(OPEN_EVENT, { detail: { message } }))
}

export function Contact() {
  const pathname = usePathname()
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const messageField = useRef<HTMLTextAreaElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const headingId = useId()

  const open = () => {
    setStatus('idle')
    setError(null)
    dialog.current?.showModal()
  }

  useEffect(() => {
    const onOpen = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message
      setStatus('idle')
      setError(null)
      dialog.current?.showModal()
      // After the panel renders its form (it may have been showing "Sent" last time).
      requestAnimationFrame(() => {
        if (message && messageField.current && !messageField.current.value) messageField.current.value = message
      })
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  const close = () => {
    dialog.current?.close()
    // Escape and the backdrop both close natively, and both leave focus nowhere useful.
    opener.current?.focus()
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)

    setStatus('sending')
    setError(null)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          message: data.get('message'),
          website: data.get('website'),
        }),
      })
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null

      if (!response.ok || !payload?.ok) {
        setStatus('error')
        setError(payload?.error ?? 'That did not send. Try again in a moment.')
        return
      }

      form.reset()
      setStatus('sent')
    } catch {
      setStatus('error')
      setError('That did not send — check your connection and try again.')
    }
  }

  return (
    <>
      {/* Not on the deck: it would sit on every slide, and in the PDF. */}
      {pathname?.startsWith('/deck') ? null : (
        <button type="button" className={styles.fab} onClick={open} ref={opener}>
          <span className={styles.fabMark} aria-hidden="true" />
          Get in touch
        </button>
      )}

      <dialog className={styles.dialog} ref={dialog} aria-labelledby={headingId}>
        <div className={styles.panel}>
          <header className={styles.head}>
            <div>
              <p className="eyebrow">Contact</p>
              <h2 id={headingId} className={styles.heading}>
                Say hello.
              </h2>
            </div>
            <button type="button" className={styles.close} onClick={close} aria-label="Close contact form">
              <span aria-hidden="true">×</span>
            </button>
          </header>

          {status === 'sent' ? (
            <div className={styles.done} role="status">
              <p className={styles.doneTitle}>Sent. Thank you.</p>
              <p className={styles.doneBody}>We&rsquo;ll get back to you as soon as possible.</p>
              <button type="button" className={styles.secondary} onClick={close}>
                Close
              </button>
            </div>
          ) : (
            <form className={styles.form} onSubmit={submit} noValidate>
              <label className={styles.field}>
                <span>Name</span>
                <input name="name" type="text" required maxLength={80} autoComplete="name" />
              </label>

              <label className={styles.field}>
                <span>Email</span>
                <input name="email" type="email" required maxLength={160} autoComplete="email" />
              </label>

              <label className={styles.field}>
                <span>Message</span>
                <textarea name="message" required maxLength={2000} rows={4} ref={messageField} />
              </label>

              {/*
                The honeypot. Hidden from sight and from assistive tech, and skipped in the tab
                order, so nobody using this page can fill it in by accident — only something
                filling every field it finds. `aria-hidden` plus `tabIndex={-1}` matters as
                much as the CSS: a screen-reader user tabbing into an invisible "Website" box
                would be flagged as a bot by a form they could not see.
              */}
              <div className={styles.trap} aria-hidden="true">
                <label>
                  Website
                  <input name="website" type="text" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              {error ? (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className={styles.submit} disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  )
}
