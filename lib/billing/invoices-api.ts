'use client'

import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { gatewayRequest } from '@/lib/gateway/client'

/**
 * Y1-04 customer invoices (`/api/v1/billing-documents`). The gateway issues every document from the payment success
 * paths (plan purchase / renewal, credit top-up) and a credit note for a refund; the customer only lists, views,
 * downloads them and maintains the name / address printed on FUTURE documents. Server state only: nothing here is kept
 * in browser storage. The whole feature is behind `BILLING_INVOICING_ENABLED`: while it is off the list answers
 * `invoicing_enabled: false` and the UI renders nothing.
 */

const BILLING_DOCUMENTS_PATH = '/api/v1/billing-documents'

export const BILLING_INVOICES_QUERY_KEY = ['billing', 'invoices'] as const
export const BILLING_CUSTOMER_PROFILE_QUERY_KEY = [...BILLING_INVOICES_QUERY_KEY, 'profile'] as const
export const BILLING_INVOICE_PAGE_SIZE = 10

export const invoiceSummarySchema = z.object({
  id: z.string(),
  document_type: z.enum(['invoice', 'credit_note']),
  document_number: z.string(),
  // Open on purpose: a source the gateway adds later must not blank the whole list.
  source_type: z.string(),
  issued_at: z.string(),
  tax_point: z.string(),
  description: z.string(),
  currency: z.string(),
  net_minor: z.number().int(),
  vat_minor: z.number().int(),
  gross_minor: z.number().int(),
  vat_registered: z.boolean(),
  vat_rate_bps: z.number().int().nullable(),
  original_document_number: z.string().nullable(),
  payment_reference: z.string(),
})

export type InvoiceSummary = z.infer<typeof invoiceSummarySchema>

const invoiceTaxSchema = z.object({
  vat_registered: z.boolean(),
  vat_rate_bps: z.number().int().nullable(),
})

/** What the supplier charges on top of a net top-up package price (null/absent: nothing). */
export type InvoiceTaxInfo = z.infer<typeof invoiceTaxSchema>

const invoiceListSchema = z.object({
  data: z.object({
    invoicing_enabled: z.boolean(),
    items: z.array(invoiceSummarySchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    tax: invoiceTaxSchema.nullable().optional().catch(null),
  }),
})

export type InvoiceList = z.infer<typeof invoiceListSchema>['data']

export const customerBillingProfileSchema = z.object({
  legal_name: z.string(),
  address_line1: z.string(),
  address_line2: z.string().nullable(),
  city: z.string(),
  postal_code: z.string(),
  country_code: z.string(),
  billing_email: z.string().nullable(),
  vat_number: z.string().nullable(),
  version: z.number().int(),
  updated_at: z.string(),
})

export type CustomerBillingProfile = z.infer<typeof customerBillingProfileSchema>

const profileReadSchema = z.object({ data: z.object({ profile: customerBillingProfileSchema.nullable() }) })
const profileWriteSchema = z.object({ data: z.object({ profile: customerBillingProfileSchema }) })

type RequestOptions = { signal?: AbortSignal }

export async function listInvoices(
  input: { page?: number; limit?: number } = {},
  options: RequestOptions = {},
): Promise<InvoiceList> {
  const params = new URLSearchParams({
    page: String(input.page ?? 1),
    limit: String(input.limit ?? BILLING_INVOICE_PAGE_SIZE),
  })
  const result = await gatewayRequest(`${BILLING_DOCUMENTS_PATH}/invoices?${params.toString()}`, {
    schema: invoiceListSchema,
    signal: options.signal,
  })
  return result.data
}

/** The saved name / address / VAT number, or `null` until the customer saved them. */
export async function getCustomerBillingProfile(options: RequestOptions = {}): Promise<CustomerBillingProfile | null> {
  const result = await gatewayRequest(`${BILLING_DOCUMENTS_PATH}/profile`, {
    schema: profileReadSchema,
    signal: options.signal,
  })
  return result.data.profile
}

export interface CustomerBillingProfileInput {
  legal_name: string
  address_line1: string
  address_line2: string | null
  city: string
  postal_code: string
  country_code: string
  billing_email: string | null
  vat_number: string | null
}

/**
 * Saves the details printed on future documents. `expectedVersion` is the version the form was loaded from (`null`: the
 * customer had saved none); the gateway answers 409 when it changed elsewhere in the meantime. Owner only (403 else).
 */
export async function saveCustomerBillingProfile(
  input: CustomerBillingProfileInput,
  expectedVersion: number | null,
  options: RequestOptions = {},
): Promise<CustomerBillingProfile> {
  const result = await gatewayRequest(`${BILLING_DOCUMENTS_PATH}/profile`, {
    method: 'PUT',
    csrf: true,
    body: { ...input, expected_version: expectedVersion },
    schema: profileWriteSchema,
    signal: options.signal,
  })
  return result.data.profile
}

export interface InvoiceDocumentFile {
  /** The print-ready HTML page exactly as the gateway rendered it. */
  html: string
  blob: Blob
  fileName: string
}

const documentCaptureSchema = z.object({ captured: z.literal(true) })

/**
 * Fetches the print-ready HTML document of one invoice / credit note (for "View / print") through the same authenticated
 * gateway transport as every other call (session cookie, timeouts, rate-limit retry, error mapping). The gateway answers
 * `text/html`, which `gatewayRequest` cannot parse, so its `fetcher` hook takes the body and hands the transport an empty
 * JSON stand-in. The caller opens the result as a Blob: a plain cross-origin link would depend on third-party cookies.
 */
export async function fetchInvoiceDocument(
  invoice: Pick<InvoiceSummary, 'id' | 'document_number'>,
  options: RequestOptions = {},
): Promise<InvoiceDocumentFile> {
  const captured: { html: string | null } = { html: null }
  const captureHtml: typeof fetch = async (input, init) => {
    const response = await fetch(input, init)
    if (!response.ok) return response
    captured.html = await response.text()
    return new Response(JSON.stringify({ captured: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  await gatewayRequest(`${BILLING_DOCUMENTS_PATH}/invoices/${encodeURIComponent(invoice.id)}/document`, {
    schema: documentCaptureSchema,
    fetcher: captureHtml,
    signal: options.signal,
  })
  const html = captured.html
  if (html === null) throw new Error('The invoice document was empty.')
  return {
    html,
    blob: new Blob([html], { type: 'text/html;charset=utf-8' }),
    fileName: `${invoice.document_number}.html`,
  }
}

export interface InvoicePdfFile {
  blob: Blob
  fileName: string
}

/**
 * P7/4: the invoice / credit note PDF — the stored copy the customer was e-mailed — through the authenticated gateway
 * transport, captured as bytes the same way as the HTML document. Owner and admin only (403 otherwise).
 */
export async function fetchInvoicePdf(
  invoice: Pick<InvoiceSummary, 'id' | 'document_number'>,
  options: RequestOptions = {},
): Promise<InvoicePdfFile> {
  const captured: { bytes: ArrayBuffer | null } = { bytes: null }
  const capturePdf: typeof fetch = async (input, init) => {
    const response = await fetch(input, init)
    if (!response.ok) return response
    captured.bytes = await response.arrayBuffer()
    return new Response(JSON.stringify({ captured: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  await gatewayRequest(`${BILLING_DOCUMENTS_PATH}/invoices/${encodeURIComponent(invoice.id)}/pdf`, {
    schema: documentCaptureSchema,
    fetcher: capturePdf,
    signal: options.signal,
  })
  const bytes = captured.bytes
  if (bytes === null || bytes.byteLength === 0) throw new Error('The invoice PDF was empty.')
  return { blob: new Blob([bytes], { type: 'application/pdf' }), fileName: `${invoice.document_number}.pdf` }
}

export function invoiceListQueryOptions(input: { page?: number; limit?: number } = {}) {
  const page = input.page ?? 1
  const limit = input.limit ?? BILLING_INVOICE_PAGE_SIZE
  return queryOptions({
    queryKey: [...BILLING_INVOICES_QUERY_KEY, 'list', { page, limit }] as const,
    queryFn: ({ signal }) => listInvoices({ page, limit }, { signal }),
    staleTime: 60_000,
  })
}

export function customerBillingProfileQueryOptions() {
  return queryOptions({
    queryKey: BILLING_CUSTOMER_PROFILE_QUERY_KEY,
    queryFn: ({ signal }) => getCustomerBillingProfile({ signal }),
    staleTime: 60_000,
  })
}
