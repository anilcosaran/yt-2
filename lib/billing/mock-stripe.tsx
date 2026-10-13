'use client'

// yt-2: stand-in for @stripe/react-stripe-js and @stripe/stripe-js. Same names and the call shapes the
// billing screens use; every confirmation succeeds locally. The card form is a static, read-only preview —
// it never accepts or sends card details.

import * as React from 'react'

export type StripeElementsOptions = {
  clientSecret?: string
  appearance?: Record<string, unknown>
  [key: string]: unknown
}

type MockIntentResult<TKey extends 'setupIntent' | 'paymentIntent'> = {
  error?: { message?: string }
} & { [K in TKey]?: { id: string; status: 'succeeded' } }

export type MockStripe = {
  confirmSetup(options: unknown): Promise<MockIntentResult<'setupIntent'>>
  confirmCardPayment(clientSecret: string, data?: unknown): Promise<MockIntentResult<'paymentIntent'>>
  confirmPayment(options: unknown): Promise<MockIntentResult<'paymentIntent'>>
}

export type MockElements = {
  submit(): Promise<{ error?: { message?: string } }>
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const mockStripe: MockStripe = {
  async confirmSetup() {
    await wait(500)
    return { setupIntent: { id: 'seti_mock_yt2', status: 'succeeded' } }
  },
  async confirmCardPayment() {
    await wait(500)
    return { paymentIntent: { id: 'pi_mock_yt2', status: 'succeeded' } }
  },
  async confirmPayment() {
    await wait(500)
    return { paymentIntent: { id: 'pi_mock_yt2', status: 'succeeded' } }
  },
}

const mockElements: MockElements = {
  async submit() {
    return {}
  },
}

/** Nullable like the original `key ? loadStripe(key) : null`, so the "payments not configured" branches still type-check. */
export function loadStripe(_publishableKey: string): Promise<MockStripe | null> | null {
  return Promise.resolve(mockStripe)
}

const ElementsContext = React.createContext(false)

export function Elements({ children }: { stripe: unknown; options?: StripeElementsOptions | null; children: React.ReactNode }) {
  return <ElementsContext.Provider value>{children}</ElementsContext.Provider>
}

export function useStripe(): MockStripe | null {
  return React.useContext(ElementsContext) ? mockStripe : null
}

export function useElements(): MockElements | null {
  return React.useContext(ElementsContext) ? mockElements : null
}

export function PaymentElement(_props: { options?: Record<string, unknown> }) {
  return (
    <div className="space-y-3" aria-label="Mock card form">
      <MockField label="Card number" value="4242 4242 4242 4242" />
      <div className="grid grid-cols-2 gap-3">
        <MockField label="Expiry" value="12 / 34" />
        <MockField label="CVC" value="123" />
      </div>
      <p className="text-xs text-muted-foreground">Mock payment form (yt-2) — no card data is collected.</p>
    </div>
  )
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        readOnly
        tabIndex={-1}
        value={value}
        className="h-10 w-full rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground"
      />
    </label>
  )
}
