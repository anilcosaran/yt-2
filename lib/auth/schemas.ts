import { z } from 'zod'

export const planTypeSchema = z.enum(['basic', 'starter', 'pro', 'max', 'enterprise'])

export const accountStatusSchema = z.enum([
  'active',
  'restricted',
  'suspended',
  'deleted',
  'pending_billing',
  'billing_failed',
])

const tenantBaseSchema = z
  .object({
    id: z.string().min(1).optional(),
    client_mutation_scope: z.string().regex(/^tenant-scope:v1:[A-Za-z0-9_-]{43}$/).optional(),
    name: z.string().min(1),
    email: z.string().min(1),
    preferred_locale: z.enum(['en', 'tr']).nullable().optional(),
    plan_type: planTypeSchema,
    account_status: accountStatusSchema,
    onboarding_completed: z.boolean().optional(),
    restriction_reason: z.string().nullable().optional(),
    plan_ends_at: z.string().nullable().optional(),
    billing_period: z.string().nullable().optional(),
    scheduled_cleanup_at: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough()

type TenantBase = z.output<typeof tenantBaseSchema>

export const tenantSchema = z
  .union([
    tenantBaseSchema,
    z.object({ props: tenantBaseSchema }).passthrough(),
  ])
  .transform((tenant): TenantBase => (('props' in tenant ? tenant.props : tenant) as TenantBase))

export const authSessionDataSchema = z.object({
  tenant: tenantSchema,
  tokenMeta: z
    .object({
      exp: z.number().optional(),
      iat: z.number().optional(),
    })
    .optional(),
  authStrategy: z
    .object({
      refreshHandledBy: z.string().optional(),
      backendRole: z.string().optional(),
    })
    .optional(),
})

export const authSessionResponseSchema = z.object({
  data: authSessionDataSchema,
})

export const authRegisterResponseSchema = z.object({
  data: z.object({
    tenant: tenantSchema,
  }),
})

export const authLogoutResponseSchema = z.object({
  data: z.object({
    message: z.string(),
    note: z.string().optional(),
    refreshHandledBy: z.string().optional(),
  }),
})

export const csrfResponseSchema = z.object({
  data: z.object({
    csrfToken: z.string().min(32),
  }),
})

export const gatewayErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    public_error_code: z.string().optional(),
    details: z.unknown().optional(),
    context: z.unknown().optional(),
  }),
})

export type Tenant = z.output<typeof tenantSchema>
export type AuthSessionData = z.output<typeof authSessionDataSchema>
