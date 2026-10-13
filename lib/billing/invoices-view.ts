import { isAuthClientError } from '@/lib/auth/errors'

import type { CustomerBillingProfile, CustomerBillingProfileInput, InvoiceSummary } from './invoices-api'

/**
 * Y1-04: pure rules behind the invoice screens (what kind of document a row is, what amount and VAT line it shows,
 * how the billing-details form is checked and how a refusal is described). No React, no browser: the settings section
 * and the checkout note only render what these return, and the gateway re-checks everything it is sent.
 */

export type InvoiceKind = 'plan' | 'credit_top_up' | 'usage_charge' | 'credit_note' | 'other'

/**
 * Plan purchase / renewal, credit top-up, usage charged to the card (overage or an outstanding debt the credits did not
 * cover), credit note (a refund of any of them) or anything a later gateway adds.
 */
export function invoiceKind(invoice: Pick<InvoiceSummary, 'document_type' | 'source_type'>): InvoiceKind {
  if (invoice.document_type === 'credit_note') return 'credit_note'
  if (invoice.source_type === 'plan_purchase' || invoice.source_type === 'plan_renewal') return 'plan'
  if (invoice.source_type === 'credit_top_up') return 'credit_top_up'
  if (invoice.source_type === 'usage_charge') return 'usage_charge'
  return 'other'
}

/** Pounds from integer pence; a credit note is a negative amount (the document prints it with a minus sign too). */
export function invoiceAmountGbp(invoice: Pick<InvoiceSummary, 'document_type' | 'gross_minor'>): number {
  const pounds = invoice.gross_minor / 100
  return invoice.document_type === 'credit_note' ? -pounds : pounds
}

export function minorToGbp(minor: number): number {
  return minor / 100
}

/** 2000 -> "20", 1250 -> "12.5". */
export function vatRatePercentLabel(rateBps: number): string {
  return String(Number((rateBps / 100).toFixed(2)))
}

export interface InvoiceVatLine {
  netGbp: number
  vatGbp: number
  ratePercent: string | null
}

/**
 * The VAT breakdown of a row, only while the supplier was VAT-registered when the document was issued. A document of an
 * unregistered supplier has no VAT line at all (UK rule: no VAT may be shown or charged without a registration).
 */
export function invoiceVatLine(invoice: Pick<InvoiceSummary, 'vat_registered' | 'vat_rate_bps' | 'net_minor' | 'vat_minor' | 'document_type'>): InvoiceVatLine | null {
  if (!invoice.vat_registered) return null
  const sign = invoice.document_type === 'credit_note' ? -1 : 1
  return {
    netGbp: (sign * invoice.net_minor) / 100,
    vatGbp: (sign * invoice.vat_minor) / 100,
    ratePercent: invoice.vat_rate_bps === null ? null : vatRatePercentLabel(invoice.vat_rate_bps),
  }
}

/** VAT added on top of a NET top-up package price (null while the supplier is not VAT-registered). */
export function topUpVatQuote(
  netGbp: number,
  tax: { vat_registered: boolean; vat_rate_bps: number | null } | null | undefined,
): { vatGbp: number; totalGbp: number; ratePercent: string } | null {
  if (!tax || !tax.vat_registered || tax.vat_rate_bps === null || tax.vat_rate_bps <= 0) return null
  const netMinor = Math.round(netGbp * 100)
  // Same integer half-up rounding as the gateway (addVatToNet) so the quoted total equals the card charge.
  const vatMinor = Math.floor((2 * netMinor * tax.vat_rate_bps + 10_000) / 20_000)
  return {
    vatGbp: vatMinor / 100,
    totalGbp: (netMinor + vatMinor) / 100,
    ratePercent: vatRatePercentLabel(tax.vat_rate_bps),
  }
}

/** ISO 3166-1 alpha-2 codes (officially assigned). Labels come from `Intl.DisplayNames` in the user's language. */
export const BILLING_COUNTRY_CODES: readonly string[] = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ '
  + 'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR '
  + 'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP '
  + 'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT '
  + 'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW '
  + 'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG '
  + 'UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ')

export interface CountryOption {
  code: string
  label: string
}

/** Country names in `locale`, sorted for that language; a code the runtime cannot name falls back to the code. */
export function billingCountryOptions(locale: string): CountryOption[] {
  let names: Intl.DisplayNames | null = null
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' })
  } catch {
    names = null
  }
  const label = (code: string) => {
    try {
      return names?.of(code) ?? code
    } catch {
      return code
    }
  }
  return BILLING_COUNTRY_CODES.map((code) => ({ code, label: label(code) }))
    .sort((left, right) => left.label.localeCompare(right.label, locale))
}

export const BILLING_DETAILS_FIELDS = [
  'legal_name',
  'address_line1',
  'address_line2',
  'city',
  'postal_code',
  'country_code',
  'billing_email',
  'vat_number',
] as const

export type BillingDetailsField = (typeof BILLING_DETAILS_FIELDS)[number]
export type BillingDetailsValues = Record<BillingDetailsField, string>
export type BillingDetailsProblem = 'required' | 'too_long' | 'invalid'
export type BillingDetailsErrors = Partial<Record<BillingDetailsField, BillingDetailsProblem>>

export const BILLING_DETAILS_MAX_LENGTH: Record<BillingDetailsField, number> = {
  legal_name: 255,
  address_line1: 255,
  address_line2: 255,
  city: 128,
  postal_code: 32,
  country_code: 2,
  billing_email: 255,
  vat_number: 32,
}

export function emptyBillingDetailsValues(): BillingDetailsValues {
  return {
    legal_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    country_code: '',
    billing_email: '',
    vat_number: '',
  }
}

export function billingDetailsValuesFromProfile(profile: CustomerBillingProfile | null): BillingDetailsValues {
  if (!profile) return emptyBillingDetailsValues()
  return {
    legal_name: profile.legal_name,
    address_line1: profile.address_line1,
    address_line2: profile.address_line2 ?? '',
    city: profile.city,
    postal_code: profile.postal_code,
    country_code: profile.country_code,
    billing_email: profile.billing_email ?? '',
    vat_number: profile.vat_number ?? '',
  }
}

const REQUIRED_FIELDS: readonly BillingDetailsField[] = ['legal_name', 'address_line1', 'city', 'postal_code', 'country_code']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VAT_NUMBER_PATTERN = /^[A-Z0-9 -]{2,32}$/

export type BillingDetailsValidation =
  | { ok: true; input: CustomerBillingProfileInput }
  | { ok: false; errors: BillingDetailsErrors }

/** Same rules as the gateway (which re-checks): required name/address/country, optional e-mail and VAT number. */
export function validateBillingDetails(values: BillingDetailsValues): BillingDetailsValidation {
  const trimmed = Object.fromEntries(BILLING_DETAILS_FIELDS.map((field) => [field, values[field].trim()])) as BillingDetailsValues
  const country = trimmed.country_code.toUpperCase()
  const vatNumber = trimmed.vat_number.toUpperCase()
  const errors: BillingDetailsErrors = {}

  for (const field of REQUIRED_FIELDS) {
    if (trimmed[field] === '') errors[field] = 'required'
  }
  for (const field of BILLING_DETAILS_FIELDS) {
    if (!errors[field] && trimmed[field].length > BILLING_DETAILS_MAX_LENGTH[field]) errors[field] = 'too_long'
  }
  if (!errors.country_code && !BILLING_COUNTRY_CODES.includes(country)) errors.country_code = 'invalid'
  if (!errors.billing_email && trimmed.billing_email !== '' && !EMAIL_PATTERN.test(trimmed.billing_email)) errors.billing_email = 'invalid'
  if (!errors.vat_number && vatNumber !== '' && !VAT_NUMBER_PATTERN.test(vatNumber)) errors.vat_number = 'invalid'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    input: {
      legal_name: trimmed.legal_name,
      address_line1: trimmed.address_line1,
      address_line2: trimmed.address_line2 === '' ? null : trimmed.address_line2,
      city: trimmed.city,
      postal_code: trimmed.postal_code,
      country_code: country,
      billing_email: trimmed.billing_email === '' ? null : trimmed.billing_email,
      vat_number: vatNumber === '' ? null : vatNumber,
    },
  }
}

export type BillingDetailsErrorKind = 'forbidden' | 'conflict' | 'invalid' | 'failed'

/** Why the gateway refused a save: not the owner (403), changed elsewhere (409), rejected values (400), anything else. */
export function describeBillingDetailsError(error: unknown): BillingDetailsErrorKind {
  if (!isAuthClientError(error)) return 'failed'
  if (error.status === 403) return 'forbidden'
  if (error.status === 409) return 'conflict'
  if (error.status === 400) return 'invalid'
  return 'failed'
}

/**
 * Y1R-MONEY-6: the billing details and the invoice documents (customer name, address, VAT number) are readable only by the
 * workspace owner and admins; the gateway answers 403 to a member. The screens say so instead of a generic failure.
 */
export function isBillingDataForbidden(error: unknown): boolean {
  return isAuthClientError(error) && error.status === 403
}

/** One-line summary of saved details for the checkout note ("Acme Ltd, London"). */
export function billingDetailsSummary(profile: Pick<CustomerBillingProfile, 'legal_name' | 'city'>): string {
  return `${profile.legal_name}, ${profile.city}`
}
