'use client'

import {
  fetchInvoiceDocument,
  fetchInvoicePdf,
  type InvoiceDocumentFile,
  type InvoicePdfFile,
  type InvoiceSummary,
} from './invoices-api'

/**
 * Y1-04: "View / print" (the HTML page) and, since P7/4, "Download PDF" (the stored PDF the customer was e-mailed) of
 * one invoice document. Both are fetched through the authenticated gateway transport and handed to the browser as a
 * Blob, never as a cross-origin link (that would need third-party cookies). The browser parts sit behind
 * `InvoiceDocumentEnvironment` so the flow runs without a DOM in tests.
 */

type DocumentRef = Pick<InvoiceSummary, 'id' | 'document_number'>

/** The browser refused to open a window (pop-up blocker); the customer can still use Download PDF. */
export class InvoicePopupBlockedError extends Error {
  constructor() {
    super('The browser blocked the pop-up window for the invoice.')
    this.name = 'InvoicePopupBlockedError'
  }
}

export interface InvoiceWindow {
  navigate(url: string): void
  close(): void
}

export interface InvoiceDocumentEnvironment {
  /** Opens an empty window; must be called synchronously inside the click handler or pop-up blockers refuse it. */
  openWindow(): InvoiceWindow | null
  createObjectUrl(blob: Blob): string
  revokeObjectUrl(url: string): void
  saveFile(url: string, fileName: string): void
  later(callback: () => void, delayMs: number): void
}

export interface InvoiceDocumentDependencies {
  environment?: InvoiceDocumentEnvironment
  fetchDocument?: (invoice: DocumentRef) => Promise<InvoiceDocumentFile>
  fetchPdf?: (invoice: DocumentRef) => Promise<InvoicePdfFile>
}

/** How long a Blob URL stays valid: long enough for the new window to load it, short enough not to leak. */
export const INVOICE_BLOB_URL_LIFETIME_MS = 60_000

export function browserInvoiceDocumentEnvironment(): InvoiceDocumentEnvironment {
  return {
    openWindow() {
      const opened = window.open('', '_blank')
      if (!opened) return null
      try {
        // The document comes from our own origin as a Blob URL: the new window must not reach back into this app.
        opened.opener = null
      } catch {
        // Some browsers refuse to write `opener`; the page has no script and its markup is escaped.
      }
      return {
        navigate: (url) => opened.location.replace(url),
        close: () => opened.close(),
      }
    },
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    saveFile(url, fileName) {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.rel = 'noopener'
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    },
    later: (callback, delayMs) => {
      window.setTimeout(callback, delayMs)
    },
  }
}

/**
 * Opens the print-ready invoice in a new tab (the customer prints it or saves it as PDF from the browser). The empty
 * window is opened BEFORE the request starts so the pop-up blocker still sees the click; it is closed again on failure.
 */
export async function viewInvoiceDocument(invoice: DocumentRef, dependencies: InvoiceDocumentDependencies = {}): Promise<void> {
  const environment = dependencies.environment ?? browserInvoiceDocumentEnvironment()
  const fetchDocument = dependencies.fetchDocument ?? fetchInvoiceDocument
  const target = environment.openWindow()
  if (!target) throw new InvoicePopupBlockedError()
  try {
    const file = await fetchDocument(invoice)
    const url = environment.createObjectUrl(file.blob)
    target.navigate(url)
    environment.later(() => environment.revokeObjectUrl(url), INVOICE_BLOB_URL_LIFETIME_MS)
  } catch (error) {
    target.close()
    throw error
  }
}

/** P7/4: saves the stored PDF as `<document number>.pdf`. */
export async function downloadInvoicePdf(invoice: DocumentRef, dependencies: InvoiceDocumentDependencies = {}): Promise<void> {
  const environment = dependencies.environment ?? browserInvoiceDocumentEnvironment()
  const fetchPdf = dependencies.fetchPdf ?? fetchInvoicePdf
  const file = await fetchPdf(invoice)
  const url = environment.createObjectUrl(file.blob)
  environment.saveFile(url, file.fileName)
  environment.later(() => environment.revokeObjectUrl(url), INVOICE_BLOB_URL_LIFETIME_MS)
}
