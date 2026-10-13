"use client";

import { z } from "zod";

import { gatewayRequest } from "@/lib/gateway/client";

export const ACTION_CENTER_GLOBAL_ALERTS_QUERY_KEY = [
  "action-center",
  "global-alerts",
] as const;

const actionCenterSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
]);
const actionCenterKindSchema = z.enum(["required_action", "warning", "info"]);
const actionCenterCategorySchema = z.enum([
  "billing",
  "storage",
  "channel",
  "workflow",
  "tenant",
  "setup",
]);
const actionCenterSourceBcSchema = z.enum([
  "billing",
  "channel",
  "workflow",
  "storage",
  "tenant",
]);

export const actionCenterItemSchema = z.object({
  id: z.string(),
  priority: z.number().catch(0),
  source_bc: actionCenterSourceBcSchema,
  source_type: z.string(),
  category: actionCenterCategorySchema,
  kind: actionCenterKindSchema,
  severity: actionCenterSeveritySchema,
  surface: z.literal("global_alert"),
  title_key: z.string(),
  message_key: z.string(),
  payload: z.record(z.unknown()).catch({}),
  cta_label_key: z.string().nullable().catch(null),
  cta_url: z.string().nullable().catch(null),
  cta_target: z.enum(["_self", "_blank"]).nullable().catch(null),
  cta_rel: z.literal("noopener noreferrer nofollow").nullable().catch(null),
  dismissible: z.boolean().catch(false),
  blocking: z.boolean().catch(false),
});

const actionCenterItemsResponseSchema = z.object({
  data: z.array(actionCenterItemSchema).catch([]),
});

const actionCenterRepairResponseSchema = z.object({
  data: z.object({
    sources_checked: z.number(),
    items_upserted: z.number(),
    items_resolved: z.number(),
  }),
});

export type ActionCenterItem = z.infer<typeof actionCenterItemSchema>;
type GatewayRequestOptions = { signal?: AbortSignal };

export async function listGlobalActionCenterItems(
  options: GatewayRequestOptions = {},
) {
  const result = await gatewayRequest(
    "/api/v1/action-center/items?status=active&surface=global_alert&limit=10",
    {
      schema: actionCenterItemsResponseSchema,
      signal: options.signal,
    },
  );

  return result.data;
}

export async function repairChannelActionCenterItems(
  options: GatewayRequestOptions = {},
) {
  const result = await gatewayRequest("/api/v1/action-center/repair", {
    method: "POST",
    csrf: true,
    schema: actionCenterRepairResponseSchema,
    signal: options.signal,
  });
  return result.data;
}

export type ActionCenterTextKey =
  | "billingPaymentIssueTitle"
  | "billingPaymentIssueMessage"
  | "storageDebtTitle"
  | "storageDebtMessage"
  | "storageDebtRestrictedMessage"
  | "storageDebtPending"
  | "storageDebtRestricted"
  | "firstChannelTitle"
  | "firstChannelMessage"
  | "createChannel"
  | "connectChannel"
  | "updatePaymentMethod"
  | "payDebt"
  | "topUp"
  | "workflowRuntimeUnavailableTitle"
  | "workflowRuntimeUnavailableMessage"
  | "viewWorkflows"
  | "workflowCostDebtTitle"
  | "workflowCostDebtWithId"
  | "workflowCostDebt"
  | "workflowCostDebtUnknown"
  | "tryContinueWorkflow"
  | "topUpAndContinue"
  | "notFound";

export interface ActionCenterText {
  key: ActionCenterTextKey;
  values?: Record<string, string | number>;
}

export function getActionCenterDisplayTitle(
  item: ActionCenterItem,
): ActionCenterText {
  return resolveActionCenterText(item.title_key, item.payload);
}

export function getActionCenterDisplayMessage(
  item: ActionCenterItem,
): ActionCenterText {
  return resolveActionCenterText(item.message_key, item.payload);
}

export function getActionCenterDisplayCtaLabel(
  item: ActionCenterItem,
): ActionCenterText | null {
  if (!item.cta_label_key) return null;
  if (isWorkflowCostControlItem(item)) return { key: "tryContinueWorkflow" };
  return resolveActionCenterText(item.cta_label_key, item.payload);
}

export function getActionCenterSafeCta(item: ActionCenterItem): {
  href?: string;
  target?: "_self" | "_blank";
  rel?: "noopener noreferrer nofollow";
} {
  if (isWorkflowCostControlItem(item)) {
    const workflowId = getString(item.payload.workflow_id);
    if (!workflowId) return {};
    const next = new URL("/workflows", "https://app.youtorch.local");
    next.searchParams.set("continueWorkflowId", workflowId);
    return { href: `${next.pathname}${next.search}` };
  }

  const normalizedHref = normalizeActionCenterCtaUrl(
    item.cta_url,
    item.cta_target,
  );
  if (!normalizedHref) return {};

  if (normalizedHref.startsWith("/")) {
    return { href: normalizedHref };
  }

  return {
    href: normalizedHref,
    target: "_blank",
    rel: item.cta_rel ?? "noopener noreferrer nofollow",
  };
}

function normalizeActionCenterCtaUrl(
  rawUrl: string | null,
  target: "_self" | "_blank" | null,
) {
  const value = rawUrl?.trim();
  if (!value || hasUnsafeCtaUrlBytes(value)) return null;

  const decodedValue = decodeCtaUrlForSafety(value);
  if (!decodedValue || hasUnsafeCtaUrlBytes(decodedValue)) return null;

  const currentOrigin =
    typeof window === "undefined"
      ? "https://app.youtorch.local"
      : window.location.origin;

  try {
    const parsed = new URL(value, currentOrigin);
    const isExplicitInternalPath =
      value.startsWith("/") && !value.startsWith("//");
    const isSameOrigin = parsed.origin === currentOrigin;

    if (isExplicitInternalPath || isSameOrigin) {
      return rewriteInternalActionCenterPath(
        `${parsed.pathname}${parsed.search}${parsed.hash}`,
      );
    }

    if (target === "_blank" && parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function rewriteInternalActionCenterPath(href: string) {
  const parsed = new URL(href, "https://app.youtorch.local");
  const workflowContinuePath = rewriteLegacyWorkflowContinuePath(parsed);
  if (workflowContinuePath) return workflowContinuePath;

  const rewrittenPath =
    internalCtaPathRewrites[parsed.pathname] ?? parsed.pathname;
  return `${rewrittenPath}${parsed.search}${parsed.hash}`;
}

function isWorkflowCostControlItem(item: ActionCenterItem) {
  return item.source_bc === "workflow" && item.source_type === "cost_debt";
}

function rewriteLegacyWorkflowContinuePath(parsed: URL) {
  const workflowId = parsed.pathname.match(/^\/workflows\/([^/?#]+)$/)?.[1];
  if (!workflowId) return null;

  const next = new URL("/workflows", "https://app.youtorch.local");
  next.searchParams.set("continueWorkflowId", workflowId);
  return `${next.pathname}${next.search}${parsed.hash}`;
}

const internalCtaPathRewrites: Record<string, string> = {
  "/billing/top-up": "/settings/top-up",
  "/billing/payment-methods": "/settings/top-up",
  "/storage/debts": "/settings/top-up",
};

function decodeCtaUrlForSafety(value: string) {
  let current = value;

  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) return decoded;
      current = decoded;
    } catch {
      return null;
    }
  }

  return current;
}

function hasUnsafeCtaUrlBytes(value: string) {
  return value.includes("\\") || /[\u0000-\u001F\u007F]/.test(value);
}

function resolveActionCenterText(
  key: string,
  payload: Record<string, unknown>,
): ActionCenterText {
  if (key === "action_center.billing_payment_issue.title")
    return { key: "billingPaymentIssueTitle" };
  if (key === "action_center.billing_payment_issue.message")
    return { key: "billingPaymentIssueMessage" };
  if (key === "action_center.storage_debt.title")
    return { key: "storageDebtTitle" };
  if (key === "action_center.storage_debt.message") {
    const remainingCredits = getNumber(payload.remaining_credits);
    const status =
      typeof payload.status === "string" ? payload.status : "pending";
    const restricted =
      status === "restricted" || status === "cleanup_scheduled";
    if (remainingCredits !== null) {
      return {
        key: restricted ? "storageDebtRestrictedMessage" : "storageDebtMessage",
        values: { remainingCredits },
      };
    }
    return { key: restricted ? "storageDebtRestricted" : "storageDebtPending" };
  }
  if (key === "action_center.channel_first_channel.title")
    return { key: "firstChannelTitle" };
  if (key === "action_center.channel_first_channel.message")
    return { key: "firstChannelMessage" };
  if (key === "action_center.cta.create_channel")
    return { key: "connectChannel" };
  if (key === "action_center.cta.connect_channel")
    return { key: "connectChannel" };
  if (key === "action_center.cta.update_payment_method")
    return { key: "updatePaymentMethod" };
  if (key === "action_center.cta.pay_debt") return { key: "payDebt" };
  if (key === "action_center.cta.top_up") return { key: "topUp" };
  if (key === "action_center.workflow_runtime_unavailable.title")
    return { key: "workflowRuntimeUnavailableTitle" };
  if (key === "action_center.workflow_runtime_unavailable.message")
    return { key: "workflowRuntimeUnavailableMessage" };
  if (key === "action_center.cta.view_workflows")
    return { key: "viewWorkflows" };
  if (key === "action_center.workflow_cost_debt.title")
    return { key: "workflowCostDebtTitle" };
  if (key === "action_center.workflow_cost_debt.message") {
    const remainingCredits = getNumber(payload.remaining_credits);
    const workflowId = getString(payload.workflow_id);
    if (remainingCredits !== null && workflowId) {
      return {
        key: "workflowCostDebtWithId",
        values: { workflowId, remainingCredits },
      };
    }
    if (remainingCredits !== null)
      return { key: "workflowCostDebt", values: { remainingCredits } };
    return { key: "workflowCostDebtUnknown" };
  }
  if (key === "action_center.cta.try_continue_workflow")
    return { key: "tryContinueWorkflow" };
  if (key === "action_center.cta.top_up_and_continue")
    return { key: "topUpAndContinue" };
  return { key: "notFound" };
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
