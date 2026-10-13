import type { CustomerBillingProfile, InvoiceSummary, InvoiceTaxInfo } from '../invoices-api'

/**
 * Test double for the `/api/v1/billing-documents` routes at the `fetch` boundary: it answers like the Y1-04 gateway
 * (envelope shapes, `issuer`-free list, HTML document, stored PDF, version-checked owner-only profile PUT, CSRF token). Tests install
 * it with `vi.stubGlobal('fetch', gateway.fetch)` so the REAL `gatewayRequest`, schemas and screens run on top of it.
 */

export interface RecordedRequest {
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
  credentials: RequestCredentials | undefined
}

export interface FakeBillingGatewayOptions {
  enabled?: boolean
  invoices?: InvoiceSummary[]
  profile?: CustomerBillingProfile | null
  tax?: InvoiceTaxInfo | null
  /** The session role. Y1R-MONEY-6: only owner and admin read the profile and the documents; only the owner writes the profile. */
  role?: 'owner' | 'admin' | 'member'
  /** Makes the invoice list answer 500 (an outage) instead of data. */
  listFails?: boolean
}

const JSON_HEADERS = { 'content-type': 'application/json' }
const REQUIRED_PROFILE_FIELDS = ['legal_name', 'address_line1', 'city', 'postal_code', 'country_code'] as const

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS })
}

function failure(status: number, code: string, message: string) {
  return json(status, { error: { code, message } })
}

export function documentHtmlFor(invoice: Pick<InvoiceSummary, 'document_number'>) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${invoice.document_number}</title></head><body><main>${invoice.document_number}</main></body></html>`
}

/** P7/4: the bytes the fake gateway serves as an invoice's stored PDF. */
export function documentPdfFor(invoice: Pick<InvoiceSummary, 'document_number'>): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.7\n% ${invoice.document_number}\n%%EOF\n`)
}

export function createFakeBillingGateway(options: FakeBillingGatewayOptions = {}) {
  const state = {
    enabled: options.enabled ?? true,
    invoices: options.invoices ?? [],
    profile: options.profile ?? null,
    tax: options.tax ?? { vat_registered: false, vat_rate_bps: null },
    role: options.role ?? 'owner',
    listFails: options.listFails ?? false,
  }
  const requests: RecordedRequest[] = []

  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([key, value]) => [key.toLowerCase(), value]))
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined
    requests.push({ method, path: `${url.pathname}${url.search}`, headers, body, credentials: init?.credentials })

    if (url.pathname === '/api/v1/auth/csrf') return json(200, { data: { csrfToken: 'c'.repeat(40) } })
    const base = '/api/v1/billing-documents'
    if (!url.pathname.startsWith(`${base}/`)) return failure(404, 'NOT_FOUND', 'Unknown route')
    const route = url.pathname.slice(base.length)

    if (method === 'GET' && route === '/invoices') {
      if (state.listFails) return failure(500, 'INTERNAL_ERROR', 'boom')
      const page = Number(url.searchParams.get('page') ?? 1)
      const limit = Number(url.searchParams.get('limit') ?? 20)
      if (!state.enabled) {
        return json(200, { data: { invoicing_enabled: false, tax: null, items: [], total: 0, page, limit } })
      }
      return json(200, {
        data: {
          invoicing_enabled: true,
          tax: state.tax,
          items: state.invoices.slice((page - 1) * limit, page * limit),
          total: state.invoices.length,
          page,
          limit,
        },
      })
    }

    const documentMatch = /^\/invoices\/([^/]+)\/document$/.exec(route)
    if (method === 'GET' && documentMatch) {
      if (state.role === 'member') return failure(403, 'FORBIDDEN', 'Requires owner or admin role')
      const invoice = state.enabled ? state.invoices.find((candidate) => candidate.id === decodeURIComponent(documentMatch[1]!)) : undefined
      if (!invoice) return failure(404, 'NOT_FOUND', 'Invoice not found')
      const disposition = url.searchParams.get('download') === '1' ? 'attachment' : 'inline'
      return new Response(documentHtmlFor(invoice), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8', 'content-disposition': `${disposition}; filename="${invoice.document_number}.html"` },
      })
    }

    const pdfMatch = /^\/invoices\/([^/]+)\/pdf$/.exec(route)
    if (method === 'GET' && pdfMatch) {
      if (state.role === 'member') return failure(403, 'FORBIDDEN', 'Requires owner or admin role')
      const invoice = state.enabled ? state.invoices.find((candidate) => candidate.id === decodeURIComponent(pdfMatch[1]!)) : undefined
      if (!invoice) return failure(404, 'NOT_FOUND', 'Invoice not found')
      return new Response(documentPdfFor(invoice), {
        status: 200,
        headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${invoice.document_number}.pdf"` },
      })
    }

    if (route === '/profile' && method === 'GET') {
      if (state.role === 'member') return failure(403, 'FORBIDDEN', 'Requires owner or admin role')
      return json(200, { data: { profile: state.profile } })
    }

    if (route === '/profile' && method === 'PUT') {
      if (!headers['x-csrf-token']) return failure(403, 'CSRF_INVALID', 'Missing CSRF token')
      if (state.role !== 'owner') return failure(403, 'FORBIDDEN', 'Requires owner role')
      const input = (body ?? {}) as Record<string, unknown>
      for (const field of REQUIRED_PROFILE_FIELDS) {
        if (typeof input[field] !== 'string' || (input[field] as string).trim() === '') {
          return failure(400, 'VALIDATION_ERROR', `${field} is required`)
        }
      }
      const expectedVersion = (input['expected_version'] ?? null) as number | null
      if ((state.profile?.version ?? null) !== expectedVersion) {
        return failure(409, 'CONFLICT', 'Billing details were changed elsewhere; reload and try again')
      }
      state.profile = {
        legal_name: String(input['legal_name']),
        address_line1: String(input['address_line1']),
        address_line2: (input['address_line2'] ?? null) as string | null,
        city: String(input['city']),
        postal_code: String(input['postal_code']),
        country_code: String(input['country_code']),
        billing_email: (input['billing_email'] ?? null) as string | null,
        vat_number: (input['vat_number'] ?? null) as string | null,
        version: (state.profile?.version ?? 0) + 1,
        updated_at: '2026-10-12T11:00:00.000Z',
      }
      return json(200, { data: { profile: state.profile } })
    }
    return failure(404, 'NOT_FOUND', 'Unknown route')
  }) as typeof fetch

  return { fetch: fetcher, requests, state }
}

export function sampleInvoice(overrides: Partial<InvoiceSummary> = {}): InvoiceSummary {
  return {
    id: 'inv-1',
    document_type: 'invoice',
    document_number: 'YT-INV-000001',
    source_type: 'plan_purchase',
    issued_at: '2026-10-12T10:30:00.000Z',
    tax_point: '2026-10-12T10:29:00.000Z',
    description: 'Pro plan - monthly subscription',
    currency: 'GBP',
    net_minor: 5000,
    vat_minor: 0,
    gross_minor: 5000,
    vat_registered: false,
    vat_rate_bps: null,
    original_document_number: null,
    payment_reference: 'pi_1',
    ...overrides,
  }
}

export function sampleProfile(overrides: Partial<CustomerBillingProfile> = {}): CustomerBillingProfile {
  return {
    legal_name: 'Acme Studios Ltd',
    address_line1: '1 Example Street',
    address_line2: null,
    city: 'London',
    postal_code: 'EC1A 1BB',
    country_code: 'GB',
    billing_email: 'accounts@acme.test',
    vat_number: null,
    version: 1,
    updated_at: '2026-10-12T09:00:00.000Z',
    ...overrides,
  }
}
