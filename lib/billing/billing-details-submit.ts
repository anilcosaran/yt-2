import {
  saveCustomerBillingProfile,
  type CustomerBillingProfile,
  type CustomerBillingProfileInput,
} from './invoices-api'
import {
  describeBillingDetailsError,
  validateBillingDetails,
  type BillingDetailsErrorKind,
  type BillingDetailsErrors,
  type BillingDetailsValues,
} from './invoices-view'

export type BillingDetailsSubmitResult =
  | { ok: true; profile: CustomerBillingProfile }
  | { ok: false; reason: 'validation'; errors: BillingDetailsErrors }
  | { ok: false; reason: BillingDetailsErrorKind }

/**
 * The form's submit: check the values locally (the gateway re-checks), then PUT them with the version the form was
 * loaded from. A failed check never reaches the network. A refusal comes back as a stable reason the form words.
 */
export async function submitBillingDetails(
  values: BillingDetailsValues,
  expectedVersion: number | null,
  save: (input: CustomerBillingProfileInput, expectedVersion: number | null) => Promise<CustomerBillingProfile> = saveCustomerBillingProfile,
): Promise<BillingDetailsSubmitResult> {
  const checked = validateBillingDetails(values)
  if (!checked.ok) return { ok: false, reason: 'validation', errors: checked.errors }
  try {
    return { ok: true, profile: await save(checked.input, expectedVersion) }
  } catch (error) {
    return { ok: false, reason: describeBillingDetailsError(error) }
  }
}
