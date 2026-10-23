"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  ExternalLink,
  Gift,
  Link2,
  Loader2,
  LockKeyhole,
  Mail,
  Palette,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  Upload,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import {
  ACCOUNT_PLAN_SYNC_UPDATED_EVENT,
  ACCOUNT_PROFILE_QUERY_KEY,
  ACCOUNT_PROFILE_UPDATED_EVENT,
  applyAccountPlanSync,
  clearAccountPlanSyncState,
  createBrowserAccountClient,
  readAccountPlanSyncState,
  saveAccountPlanSyncState,
  type AccountPlanSyncState,
  type AccountProfileTenant,
} from "@/components/account/browser-account-client";
import { PaymentMethodCard } from "@/components/billing/payment-method-card";
import { PaymentRiskPanel } from "@/components/billing/payment-risk-panel";
import { WorkspaceRouteLoading } from "@/components/common/workspace-route-loading";
import { BillingInvoicesSection } from "@/components/settings/billing-invoices-section";
import { LanguageSettingRow } from "@/components/settings/language-setting-row";
import { ApprovalsSettingsSection } from "@/components/settings/assistant-approvals-settings";
import { SettingRow, SettingsList } from "@/components/settings/setting-row";
import {
  INVITE_EARN_HIDDEN_EVENT,
  INVITE_EARN_HIDDEN_STORAGE_KEY,
  SIDEBAR_COLLAPSED_EVENT,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
} from "@/components/layout/layout-preferences";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createFirebaseAuthDriver } from "@/lib/auth/firebase-client";
import { ACTION_CENTER_GLOBAL_ALERTS_QUERY_KEY } from "@/lib/action-center/api";
import { getSafeAuthMessage } from "@/lib/auth/errors";
import {
  CHANNELS_QUERY_KEY,
  CHANNEL_SLOT_SELECTION_CHECK_EVENT,
  listChannels,
} from "@/lib/channel/api";
import { WORKSPACE_BOOTSTRAP_QUERY_KEY } from "@/lib/workspace/api";
import {
  getStorageUsageAggregate,
  storageUsageAggregateQueryKey,
} from "@/lib/storage/api";
import {
  BILLING_PAYMENT_METHODS_QUERY_KEY,
  BILLING_PAYMENT_METHOD_STATUS_QUERY_KEY,
  BILLING_QUERY_KEY,
  BILLING_QUOTA_USAGE_QUERY_KEY,
  BILLING_BALANCE_UPDATED_EVENT,
  STORAGE_DEBT_STATUS_QUERY_KEY,
  billingOverviewQueryKey,
  billingTransactionSummaryQueryKey,
  billingTransactionsQueryKey,
  getBillingOverview,
  getBillingQuotaUsage,
  getBillingTransactionSummary,
  getBillingTransactions,
  removePaymentMethod,
  setDefaultPaymentMethod,
  type BillingQuotaUsage,
  type BillingTransaction,
  type BillingTransactionSummary,
  type PaymentMethod,
  type PaymentMethodStatus,
  type StorageDebtStatus,
} from "@/lib/billing/api";
import { payStorageDebtWithStableOperation } from "@/lib/billing/storage-debt-payment";
import {
  MY_FEATURE_LIMITS_QUERY_KEY,
  MY_QUOTA_GRANTS_QUERY_KEY,
  getMyFeatureLimits,
  getMyQuotaGrants,
  type FeatureLimit,
  type QuotaGrant,
} from "@/lib/feature-control/api";
import {
  MY_OFFERS_QUERY_KEY,
  cancelTenantOffer,
  undoCancelTenantOffer,
  type MyOffer,
} from "@/lib/offer/api";
import {
  INBOX_NOTIFICATION_SOUND_CHANGED_EVENT,
  readInboxNotificationSoundEnabled,
  writeInboxNotificationSoundEnabled,
} from "@/lib/review/notification-preferences";
import { cn } from "@/lib/utils";
import { UiText } from "@/components/i18n/ui-text";
import { DeveloperSettingsSection } from "@/components/settings/developer/developer-settings-section";
import { useLocalizedError } from "@/hooks/use-localized-error";
import { useFormatter, useTranslations } from "next-intl";
import { SidebarToggleIcon } from "@/components/layout/sidebar-toggle-icon";

export type SettingsSection =
  | "general"
  | "preferences"
  | "approvals"
  | "notifications"
  | "billing"
  | "limits"
  | "transactions"
  | "usage"
  | "security"
  | "developer";

interface SettingsPageProps {
  tenant: AccountProfileTenant | null;
}

const SECTION_SHIMMER_MS = 220;
const BILLING_PAGE_SIZE = 6;
const BILLING_INVOICE_PAGE_SIZE = 10;
const BILLING_INVOICE_FETCH_LIMIT = 100;
const PROFILE_NAME_MAX_LENGTH = 25;
const PROFILE_NAME_PATTERN = /^[\p{L}]+(?: [\p{L}]+)*$/u;
const profileNameErrorKeys = {
  required: "profileNameRequired",
  tooLong: "profileNameTooLong",
  invalidCharacters: "profileNameInvalidCharacters",
} as const;
type ProfileNameErrorCode = keyof typeof profileNameErrorKeys;

const AddPaymentMethodDialog = dynamic(
  () =>
    import("@/components/billing/add-payment-method-dialog").then(
      (mod) => mod.AddPaymentMethodDialog,
    ),
  { ssr: false, loading: () => null },
);

const OfferPlanPage = dynamic(
  () =>
    import("@/components/offer-plan/offer-plan-page").then(
      (mod) => mod.OfferPlanPage,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center bg-[#f4f3f0]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

const planCopy: Record<
  string,
  { labelKey: string; monthlyPrice: number | null; allowanceKey: string }
> = {
  basic: {
    labelKey: "planBasic",
    monthlyPrice: 0,
    allowanceKey: "planBasicAllowance",
  },
  starter: {
    labelKey: "planStarter",
    monthlyPrice: 20,
    allowanceKey: "planStarterAllowance",
  },
  pro: {
    labelKey: "planPro",
    monthlyPrice: 50,
    allowanceKey: "planProAllowance",
  },
  max: {
    labelKey: "planMax",
    monthlyPrice: 79,
    allowanceKey: "planMaxAllowance",
  },
  enterprise: {
    labelKey: "planEnterprise",
    monthlyPrice: null,
    allowanceKey: "planEnterpriseAllowance",
  },
};

const featureControlLabelKeyByKey: Record<string, string> = {
  max_youtube_channels: "featureConnectedChannels",
  max_storage_mb: "featureStorage",
  storage_included_storage_mb: "featureIncludedStorage",
  max_concurrent_nodes: "featureConcurrentWorkflows",
  max_concurrent_workflows: "featureConcurrentWorkflows",
  "billing:plan_included_credits": "featurePlanIncludedCredits",
  "workflow:monthly_runs": "featureWorkflowRuns",
  "node:render_v1": "featureRenderQuota",
  "agent:chat_v1": "featureAgentChatQuota",
  "storage:monthly_io_gb": "featureStorageIo",
};

export function SettingsPage(props: SettingsPageProps) {
  return (
    <Suspense fallback={<WorkspaceRouteLoading />}>
      <SettingsContent {...props} />
    </Suspense>
  );
}

function SettingsContent({ tenant }: SettingsPageProps) {
  const searchParams = useSearchParams();
  const activeSection = getSettingsSection(searchParams.get("section"));
  const previousSectionRef = React.useRef(activeSection);
  const [loadingSection, setLoadingSection] =
    React.useState<SettingsSection | null>(null);

  React.useEffect(() => {
    if (previousSectionRef.current === activeSection) return;

    previousSectionRef.current = activeSection;
    setLoadingSection(activeSection);
    const timeout = window.setTimeout(() => {
      setLoadingSection((currentSection) =>
        currentSection === activeSection ? null : currentSection,
      );
    }, SECTION_SHIMMER_MS);

    return () => window.clearTimeout(timeout);
  }, [activeSection]);

  const sectionIsLoading = loadingSection === activeSection;

  return (
    <SettingsFrame activeSection={activeSection} tenant={tenant}>
      {sectionIsLoading ? (
        <SettingsSectionSkeleton section={activeSection} />
      ) : (
        <>
          {activeSection === "general" && <GeneralSection tenant={tenant} />}
          {activeSection === "preferences" && <PreferencesSection />}
          {activeSection === "approvals" && <ApprovalsSettingsSection />}
          {activeSection === "notifications" && <NotificationsSection />}
          {activeSection === "billing" && <BillingSection tenant={tenant} />}
          {activeSection === "limits" && <LimitsSection />}
          {activeSection === "transactions" && <TransactionsSection />}
          {activeSection === "usage" && <UsageSection />}
          {activeSection === "security" && <SecuritySection tenant={tenant} />}
          {activeSection === "developer" && <DeveloperSettingsSection />}
        </>
      )}
    </SettingsFrame>
  );
}

export function SettingsFrame({
  activeSection,
  children,
}: {
  activeSection: SettingsSection;
  tenant?: AccountProfileTenant | null;
  children: React.ReactNode;
}) {
  return (
    <div
      className="hg-scrollbar relative h-full min-h-full overflow-y-auto bg-background"
      data-settings-section={activeSection}
    >
      <div className="hg-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="relative mx-auto min-h-full w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8 xl:px-10">
        <main className="min-w-0 w-full">{children}</main>
      </div>
    </div>
  );
}

function SettingsSectionSkeleton({ section }: { section: SettingsSection }) {
  if (section === "billing") return <BillingSectionSkeleton />;
  if (section === "limits") return <LimitsSectionSkeleton />;
  if (section === "transactions") return <TransactionsSectionSkeleton />;
  if (section === "usage") return <UsageSectionSkeleton />;
  if (section === "general") return <GeneralSectionSkeleton />;
  return <SettingsListSkeleton />;
}

function GeneralSectionSkeleton() {
  return (
    <div className="w-full" aria-busy="true">
      <div className="flex items-center justify-between gap-4 border-b border-border py-5">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <SettingsSkeletonRow />
      <SettingsSkeletonRow />
      <SettingsSkeletonRow />
    </div>
  );
}

function SettingsListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="w-full" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <SettingsSkeletonRow key={index} />
      ))}
    </div>
  );
}

function SettingsSkeletonRow() {
  return (
    <div className="grid gap-3 border-b border-border py-4 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-center">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex justify-start sm:justify-end">
        <Skeleton className="h-8 w-full max-w-[260px]" />
      </div>
    </div>
  );
}

function BillingSectionSkeleton() {
  return (
    <div className="w-full" aria-busy="true">
      <div className="mb-5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-3 h-7 w-40" />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36 w-full rounded-lg" />
        <Skeleton className="h-36 w-full rounded-lg" />
      </div>
    </div>
  );
}

function LimitsSectionSkeleton() {
  return (
    <div className="w-full" aria-busy="true">
      <SectionHeaderSkeleton titleWidth="w-20" descriptionWidth="w-96" />
      <MetricCardsSkeleton />

      <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
        <PanelHeaderSkeleton
          titleWidth="w-24"
          detailWidth="w-80"
          badgeWidth="w-16"
        />
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="px-4 py-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="mt-2 h-3 w-28" />
                </div>
                <div className="shrink-0 space-y-2">
                  <Skeleton className="ml-auto h-4 w-20" />
                  <Skeleton className="ml-auto h-3 w-28" />
                </div>
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-32 sm:ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
        <PanelHeaderSkeleton
          titleWidth="w-28"
          detailWidth="w-72"
          badgeWidth="w-16"
        />
        <Table>
          <TableBody>
            {Array.from({ length: 4 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell className="px-4">
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function TransactionsSectionSkeleton() {
  return (
    <div className="w-full" aria-busy="true">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-24" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableBody>
            <TransactionTableSkeletonRows rows={6} />
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-16" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
}

function UsageSectionSkeleton() {
  return (
    <div className="w-full" aria-busy="true">
      <SectionHeaderSkeleton titleWidth="w-20" descriptionWidth="w-80" />
      <MetricCardsSkeleton />

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <PanelHeaderSkeleton titleWidth="w-24" />
          <div className="space-y-5 p-4">
            <div>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-3 w-44" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="ml-auto h-4 w-20" />
                  <Skeleton className="ml-auto h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
            <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <PanelHeaderSkeleton titleWidth="w-24" />
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="px-4 py-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
        <PanelHeaderSkeleton
          titleWidth="w-28"
          detailWidth="w-80"
          badgeWidth="w-20"
        />
        <Table>
          <TableBody>
            <TransactionTableSkeletonRows rows={5} />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SectionHeaderSkeleton({
  titleWidth,
  descriptionWidth,
}: {
  titleWidth: string;
  descriptionWidth: string;
}) {
  return (
    <div className="mb-5">
      <Skeleton className={cn("h-6", titleWidth)} />
      <Skeleton className={cn("mt-2 h-4 max-w-full", descriptionWidth)} />
    </div>
  );
}

function MetricCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-card p-4"
        >
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-3 h-4 w-36 max-w-full" />
        </div>
      ))}
    </div>
  );
}

function PanelHeaderSkeleton({
  titleWidth,
  detailWidth,
  badgeWidth,
}: {
  titleWidth: string;
  detailWidth?: string;
  badgeWidth?: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Skeleton className={cn("h-4", titleWidth)} />
        {detailWidth && (
          <Skeleton className={cn("mt-2 h-4 max-w-full", detailWidth)} />
        )}
      </div>
      {badgeWidth && (
        <Skeleton className={cn("h-6 rounded-full", badgeWidth)} />
      )}
    </div>
  );
}

function TransactionTableSkeletonRows({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="px-4">
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-36 max-w-full" />
            <Skeleton className="mt-2 h-3 w-28 max-w-full sm:hidden" />
          </TableCell>
          <TableCell className="hidden sm:table-cell">
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-16 rounded-full" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="ml-auto h-4 w-20" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function GeneralSection({ tenant }: { tenant: AccountProfileTenant | null }) {
  const tAuto = useTranslations("Auto");
  const tSettings = useTranslations("Settings");
  const queryClient = useQueryClient();
  const accountClient = React.useMemo(() => createBrowserAccountClient(), []);
  const firebaseAuth = React.useMemo(() => createFirebaseAuthDriver(), []);
  const initialName = getProfileDisplayName(tenant);
  const profileQuery = useQuery({
    queryKey: ACCOUNT_PROFILE_QUERY_KEY,
    queryFn: () => accountClient.getCurrentProfile(),
    initialData: tenant ?? undefined,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
  const profile = profileQuery.data ?? tenant;
  const profileLoading = profileQuery.isLoading && !profile;
  const email = getProfileEmail(profile, tSettings("emailUnavailable"));
  const [profileImageUrl, setProfileImageUrl] = React.useState(() =>
    getTenantProfileImageUrl(tenant),
  );
  const [savedName, setSavedName] = React.useState(initialName);
  const [name, setName] = React.useState(initialName);
  const [editingName, setEditingName] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">(
    "idle",
  );

  React.useEffect(() => {
    const firebasePhotoUrl = firebaseAuth.currentUser()?.photoURL ?? null;
    setProfileImageUrl(firebasePhotoUrl || getTenantProfileImageUrl(profile));
  }, [firebaseAuth, profile]);

  React.useEffect(() => {
    if (!profile) return;
    const nextName = getProfileDisplayName(profile);
    setSavedName(nextName);
    if (!editingName) setName(nextName);
  }, [editingName, profile]);

  const handleSaveName = async () => {
    const nextName = name.trim();
    const validationCode = getProfileNameValidationCode(nextName);
    if (validationCode) {
      showProfileNameError(
        tSettings(profileNameErrorKeys[validationCode], {
          max: PROFILE_NAME_MAX_LENGTH,
        }),
        tSettings("nameNotSaved"),
      );
      return;
    }

    setStatus("saving");
    try {
      const updatedTenant = await accountClient.updateProfile({
        name: nextName,
      });
      queryClient.setQueryData(ACCOUNT_PROFILE_QUERY_KEY, updatedTenant);
      setSavedName(updatedTenant.name);
      setName(updatedTenant.name);
      window.dispatchEvent(
        new CustomEvent<AccountProfileTenant>(ACCOUNT_PROFILE_UPDATED_EVENT, {
          detail: updatedTenant,
        }),
      );
      setEditingName(false);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch (saveError) {
      setStatus("idle");
      const errorCode = getProfileNameSaveErrorCode(saveError);
      showProfileNameError(
        errorCode
          ? tSettings(profileNameErrorKeys[errorCode], {
              max: PROFILE_NAME_MAX_LENGTH,
            })
          : tSettings("nameCouldNotBeSaved"),
        tSettings("nameNotSaved"),
      );
    }
  };

  if (profileLoading) return <GeneralSectionSkeleton />;

  return (
    <SettingsList>
      <div className="flex items-center justify-between gap-4 border-b border-border py-5">
        <Avatar className="h-16 w-16">
          {profileImageUrl && <AvatarImage src={profileImageUrl} alt="" />}
          <AvatarFallback className="bg-muted text-muted-foreground">
            <UserRound className="h-7 w-7" />
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2">
          <IconButton label={tSettings("controlUnavailable", { control: tAuto("remove_photo_c8f5eda8") })} disabled>
            <Trash2 className="h-4 w-4 text-destructive" />
          </IconButton>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled
            title={tSettings("controlUnavailable", { control: tAuto("upload_8bdf057f") })}
          >
            <Upload className="h-3.5 w-3.5" />
            <UiText id="upload_8bdf057f" />
          </Button>
        </div>
      </div>

      <SettingRow label={tAuto("name_709a2322")} icon={UserRound}>
        {editingName ? (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label={tAuto("name_709a2322")}
              className="h-8 w-56 shadow-none"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleSaveName}
              disabled={status === "saving"}
              className="h-8 gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {status === "saving"
                ? tAuto("saving_369c534d")
                : tAuto("save_efc007a3")}
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={tAuto("cancel_editing_name_4fb5a1e5")}
              onClick={() => {
                setName(savedName);
                setEditingName(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <RowValue
            value={
              savedName ||
              (profileLoading
                ? tAuto("loading_account_222d9d5f")
                : tAuto("no_name_set_c66fd0e2"))
            }
            action={
              <SmallAction onClick={() => setEditingName(true)}>
                <UiText id="edit_5301648d" />
              </SmallAction>
            }
          />
        )}
      </SettingRow>

      <SettingRow label={tAuto("contacts_b0dd615c")} icon={Mail}>
        <RowValue
          value={
            profileLoading
              ? tAuto("loading_account_222d9d5f")
              : `Email: ${email}`
          }
          action={
            <Badge variant="secondary">
              <UiText id="locked_a798882f" />
            </Badge>
          }
        />
      </SettingRow>

      <SettingRow label={tAuto("integration_899e5920")} icon={Link2}>
        <RowValue
          value={`Google - ${email}`}
          action={
            <Badge className="bg-success/10 text-success hover:bg-success/10">
              <UiText id="connected_c2f9b7b4" />
            </Badge>
          }
        />
      </SettingRow>

      <LanguageSettingRow />
      <InboxNotificationSoundSettingRow />

      <InlineStatus
        saved={status === "saved"}
        message={tSettings("profileUpdated")}
      />
    </SettingsList>
  );
}

function InboxNotificationSoundSettingRow() {
  const tAuto = useTranslations("Auto");
  const [enabled, setEnabled] = React.useState(true);

  React.useEffect(() => {
    setEnabled(readInboxNotificationSoundEnabled());

    const handlePreferenceChange = (event: Event) => {
      setEnabled(Boolean((event as CustomEvent<boolean>).detail));
    };

    window.addEventListener(
      INBOX_NOTIFICATION_SOUND_CHANGED_EVENT,
      handlePreferenceChange,
    );
    return () =>
      window.removeEventListener(
        INBOX_NOTIFICATION_SOUND_CHANGED_EVENT,
        handlePreferenceChange,
      );
  }, []);

  const updateSoundPreference = (nextEnabled: boolean) => {
    writeInboxNotificationSoundEnabled(nextEnabled);
    setEnabled(nextEnabled);
  };

  return (
    <SettingRow label={tAuto("inbox_sound_c08d084b")} icon={Bell}>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
        <span className="min-w-0 break-words text-right text-sm text-muted-foreground">
          <UiText id="web_notification_chime_c75531c9" />
        </span>
        <Switch
          checked={enabled}
          onCheckedChange={updateSoundPreference}
          aria-label={tAuto("inbox_notification_sound_6e8aa008")}
        />
      </div>
    </SettingRow>
  );
}

function PreferencesSection() {
  return (
    <SettingsList>
      <ThemeSettingRow />
      <SidebarSettingRow />
      <InviteEarnSettingRow />
    </SettingsList>
  );
}

function ThemeSettingRow() {
  const tAuto = useTranslations("Auto");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  return (
    <SettingRow label={tAuto("theme_a797e309")} icon={Palette}>
      <Select
        value={mounted ? (theme ?? "system") : "system"}
        onValueChange={setTheme}
      >
        <SelectTrigger className="h-8 w-full max-w-[180px] shadow-none sm:w-[138px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="light">
            <UiText id="light_mode_3d3791aa" />
          </SelectItem>
          <SelectItem value="dark">
            <UiText id="dark_mode_9cf83d1f" />
          </SelectItem>
          <SelectItem value="paper">
            <UiText id="theme_paper" />
          </SelectItem>
          <SelectItem value="system">
            <UiText id="system_bc0792d8" />
          </SelectItem>
        </SelectContent>
      </Select>
    </SettingRow>
  );
}

function SidebarSettingRow() {
  const tAuto = useTranslations("Auto");
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  React.useEffect(() => {
    setSidebarCollapsed(
      window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true",
    );

    const handleSidebarPreference = (event: Event) => {
      setSidebarCollapsed(Boolean((event as CustomEvent<boolean>).detail));
    };

    window.addEventListener(SIDEBAR_COLLAPSED_EVENT, handleSidebarPreference);
    return () =>
      window.removeEventListener(
        SIDEBAR_COLLAPSED_EVENT,
        handleSidebarPreference,
      );
  }, []);

  const updateSidebarPreference = (collapsed: boolean) => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(collapsed),
    );
    window.dispatchEvent(
      new CustomEvent(SIDEBAR_COLLAPSED_EVENT, { detail: collapsed }),
    );
    setSidebarCollapsed(collapsed);
  };

  return (
    <SettingRow label={tAuto("sidebar_f5171c93")} icon={SidebarToggleIcon}>
      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-muted-foreground">
          <UiText id="collapsed_by_default_65a57c6a" />
        </span>
        <Switch
          checked={sidebarCollapsed}
          onCheckedChange={updateSidebarPreference}
          aria-label={tAuto("collapse_sidebar_9e687628")}
        />
      </div>
    </SettingRow>
  );
}

function InviteEarnSettingRow() {
  const tAuto = useTranslations("Auto");
  const [showInviteEarn, setShowInviteEarn] = React.useState(true);

  React.useEffect(() => {
    setShowInviteEarn(
      window.localStorage.getItem(INVITE_EARN_HIDDEN_STORAGE_KEY) !== "true",
    );

    const handleInviteEarnPreference = (event: Event) => {
      setShowInviteEarn(!Boolean((event as CustomEvent<boolean>).detail));
    };

    window.addEventListener(
      INVITE_EARN_HIDDEN_EVENT,
      handleInviteEarnPreference,
    );
    return () =>
      window.removeEventListener(
        INVITE_EARN_HIDDEN_EVENT,
        handleInviteEarnPreference,
      );
  }, []);

  const updateInviteEarnPreference = (show: boolean) => {
    const hidden = !show;
    window.localStorage.setItem(INVITE_EARN_HIDDEN_STORAGE_KEY, String(hidden));
    window.dispatchEvent(
      new CustomEvent(INVITE_EARN_HIDDEN_EVENT, { detail: hidden }),
    );
    setShowInviteEarn(show);
  };

  return (
    <SettingRow label={tAuto("invite_earn_25b8348e")} icon={Gift}>
      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-muted-foreground">
          <UiText id="show_in_sidebar_914e4685" />
        </span>
        <Switch
          checked={showInviteEarn}
          onCheckedChange={updateInviteEarnPreference}
          aria-label={tAuto("show_invite_and_earn_in_sidebar_c1b71eef")}
        />
      </div>
    </SettingRow>
  );
}

function NotificationsSection() {
  const tAuto = useTranslations("Auto");
  const tSettings = useTranslations("Settings");
  return (
    <SettingsList>
      <SettingRow label={tAuto("product_updates_67f10cb7")} icon={Bell}>
        <UnavailableSettingControl label={tAuto("product_updates_67f10cb7")} message={tSettings("preferenceUnavailable")} />
      </SettingRow>
      <SettingRow label={tAuto("workflow_alerts_2fd1f988")} icon={Bell}>
        <UnavailableSettingControl label={tAuto("workflow_alerts_2fd1f988")} message={tSettings("preferenceUnavailable")} />
      </SettingRow>
      <SettingRow label={tAuto("billing_emails_6ff5bef1")} icon={ReceiptText}>
        <UnavailableSettingControl label={tAuto("billing_emails_6ff5bef1")} message={tSettings("preferenceUnavailable")} />
      </SettingRow>
    </SettingsList>
  );
}

function UnavailableSettingControl({ label, message }: { label: string; message: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
      <span className="text-right text-xs text-muted-foreground">{message}</span>
      <Switch checked disabled aria-label={`${label}: ${message}`} />
    </div>
  );
}

function BillingSection({ tenant }: { tenant: AccountProfileTenant | null }) {
  const tAuto = useTranslations("Auto");
  const tSettings = useTranslations("Settings");
  const {
    credits: formatCredits,
    date: formatDate,
    money: formatMoney,
  } = useSettingsFormats();
  const localizeError = useLocalizedError();
  const queryClient = useQueryClient();
  const accountClient = React.useMemo(() => createBrowserAccountClient(), []);
  const [planSyncState, setPlanSyncState] =
    React.useState<AccountPlanSyncState | null>(null);
  const profileQuery = useQuery({
    queryKey: ACCOUNT_PROFILE_QUERY_KEY,
    queryFn: () => accountClient.getCurrentProfile(),
    initialData: tenant ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
  const activeTenant = applyAccountPlanSync(
    profileQuery.data ?? tenant,
    planSyncState,
  );
  const email = getProfileEmail(activeTenant, tSettings("emailUnavailable"));
  const planKey = activeTenant?.plan_type ?? "basic";
  const plan = planCopy[planKey] ?? planCopy.basic;
  const cycle = React.useMemo(() => getCurrentCycleRange(), []);
  const [cardDialogOpen, setCardDialogOpen] = React.useState(false);
  const [planDialogOpen, setPlanDialogOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [invoicePage, setInvoicePage] = React.useState(1);
  const overviewInput = React.useMemo(
    () => ({
      cycle_start: cycle.start,
      cycle_end: cycle.end,
      invoice_limit: BILLING_INVOICE_PAGE_SIZE,
      invoice_page: invoicePage,
    }),
    [cycle.end, cycle.start, invoicePage],
  );
  const overviewQuery = useQuery({
    queryKey: billingOverviewQueryKey(overviewInput),
    queryFn: () => getBillingOverview(overviewInput),
    staleTime: 2 * 60_000,
  });

  React.useEffect(() => {
    const overview = overviewQuery.data;
    if (!overview) return;

    queryClient.setQueryData(
      BILLING_QUOTA_USAGE_QUERY_KEY,
      overview.quota_usage,
    );
    queryClient.setQueryData(
      BILLING_PAYMENT_METHODS_QUERY_KEY,
      overview.payment_methods,
    );
    queryClient.setQueryData(
      BILLING_PAYMENT_METHOD_STATUS_QUERY_KEY,
      overview.payment_method_status,
    );
    queryClient.setQueryData(
      billingTransactionsQueryKey({
        page: overview.transactions.page,
        limit: overview.transactions.limit,
      }),
      overview.transactions,
    );
    queryClient.setQueryData(
      billingTransactionSummaryQueryKey({
        cycle_start: cycle.start,
        cycle_end: cycle.end,
      }),
      overview.transaction_summary,
    );
    queryClient.setQueryData(
      STORAGE_DEBT_STATUS_QUERY_KEY,
      overview.debt_status,
    );
    queryClient.setQueryData(MY_OFFERS_QUERY_KEY, overview.my_offers);
  }, [cycle.end, cycle.start, overviewQuery.data, queryClient]);

  const data: BillingSettingsData = {
    loading: isInitialQueryLoading(overviewQuery),
    error: overviewQuery.error ? localizeError(overviewQuery.error) : null,
    quotaUsage: overviewQuery.data?.quota_usage ?? null,
    paymentMethods: overviewQuery.data?.payment_methods ?? [],
    methodStatus: overviewQuery.data?.payment_method_status ?? null,
    transactions: (
      overviewQuery.data?.transactions ?? {
        transactions: [],
        page: 1,
        limit: BILLING_INVOICE_FETCH_LIMIT,
        total: 0,
      }
    ).transactions,
    transactionSummary: overviewQuery.data?.transaction_summary ?? null,
    debtStatus: overviewQuery.data?.debt_status ?? null,
    myOffers: overviewQuery.data?.my_offers ?? [],
  };

  React.useEffect(() => {
    setPlanSyncState(readAccountPlanSyncState());

    const handlePlanSyncUpdate = (event: Event) => {
      setPlanSyncState(
        (event as CustomEvent<AccountPlanSyncState | null>).detail ??
          readAccountPlanSyncState(),
      );
    };

    window.addEventListener(
      ACCOUNT_PLAN_SYNC_UPDATED_EVENT,
      handlePlanSyncUpdate,
    );
    return () =>
      window.removeEventListener(
        ACCOUNT_PLAN_SYNC_UPDATED_EVENT,
        handlePlanSyncUpdate,
      );
  }, []);

  const refreshBillingData = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BILLING_QUERY_KEY }),
      queryClient.invalidateQueries({
        queryKey: STORAGE_DEBT_STATUS_QUERY_KEY,
      }),
      queryClient.invalidateQueries({ queryKey: MY_OFFERS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: WORKSPACE_BOOTSTRAP_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY }),
      queryClient.invalidateQueries({
        queryKey: ACTION_CENTER_GLOBAL_ALERTS_QUERY_KEY,
      }),
    ]);
  }, [queryClient]);

  const setAccountProfile = React.useCallback(
    (profile: AccountProfileTenant) => {
      queryClient.setQueryData(ACCOUNT_PROFILE_QUERY_KEY, profile);
      window.dispatchEvent(
        new CustomEvent<AccountProfileTenant>(ACCOUNT_PROFILE_UPDATED_EVENT, {
          detail: profile,
        }),
      );
    },
    [queryClient],
  );

  const reconcileAccountProfile = React.useCallback(
    (expectedPlan?: string) => {
      if (!expectedPlan) return;

      void (async () => {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 900));
          try {
            const profile = await accountClient.getCurrentProfile();
            if (profile.plan_type === expectedPlan) {
              clearAccountPlanSyncState();
              setPlanSyncState(null);
              setAccountProfile(profile);
              return;
            }
          } catch {
            // Keep the optimistic profile until the next explicit refresh.
          }
        }
      })();
    },
    [accountClient, setAccountProfile],
  );

  const applyCompletedPlanProfile = React.useCallback(
    (completion: { plan: string; billingPeriod?: string }) => {
      const existingProfile =
        queryClient.getQueryData<AccountProfileTenant>(
          ACCOUNT_PROFILE_QUERY_KEY,
        ) ?? activeTenant;
      if (!existingProfile) return;

      const nextSyncState = saveAccountPlanSyncState({
        planType: completion.plan,
        billingPeriod:
          completion.billingPeriod ?? existingProfile.billing_period,
      });
      setPlanSyncState(nextSyncState);
      setAccountProfile({
        ...existingProfile,
        plan_type: completion.plan,
        billing_period:
          completion.billingPeriod ?? existingProfile.billing_period,
      });
      reconcileAccountProfile(completion.plan);
    },
    [activeTenant, queryClient, reconcileAccountProfile, setAccountProfile],
  );

  const currentOffer = getCurrentOffer(data.myOffers);
  const renewalDate =
    formatDate(currentOffer?.expires_at ?? activeTenant?.plan_ends_at) ??
    tSettings("notScheduled");
  const activePricing = currentOffer?.pricing_snapshot ?? null;
  const billingCycle = formatBillingCycle(
    activePricing?.billing_period ?? activeTenant?.billing_period,
    tSettings,
  );
  const planCost = activePricing
    ? tSettings("pricePerPeriod", {
        price: formatMoney(
          activePricing.discounted_price,
          activePricing.currency,
        ),
        period: formatBillingPeriodUnit(
          activePricing.billing_period,
          tSettings,
        ),
      })
    : plan.monthlyPrice === null
      ? tSettings("customPrice")
      : tSettings("pricePerMonth", {
          price: formatMoney(plan.monthlyPrice, "GBP"),
        });
  const pendingCancellation = currentOffer?.status === "pending_cancellation";
  const creditQuota = getCreditLikeQuotaTotals(data.quotaUsage);
  const includedPlanCredits = Math.max(
    resolveCurrentIncludedPlanCredits(activePricing),
    creditQuota.total,
  );
  const outstandingDebts =
    data.debtStatus?.debts.filter((debt) => debt.remaining_credits > 0) ?? [];
  const totalDebtCredits = data.debtStatus?.total_debt_credits ?? 0;
  const availableCredits = getAvailableCredits(data.quotaUsage);
  const usedCredits = data.transactionSummary?.total_spent_credits ?? 0;
  const creditUsageTotal = Math.max(availableCredits + usedCredits, 1);
  const creditUsagePercent = getUsagePercent(usedCredits, creditUsageTotal);
  const hasOutstandingDebt =
    outstandingDebts.length > 0 ||
    Boolean(data.debtStatus?.has_outstanding_debt);
  const canCoverDebt = totalDebtCredits <= availableCredits;
  const invoiceCollection = overviewQuery.data?.invoices ?? {
    transactions: [],
    items: [],
    total: 0,
    page: invoicePage,
    limit: BILLING_INVOICE_PAGE_SIZE,
  };
  const invoiceTransactions = invoiceCollection.transactions;
  const invoiceTotalPages = Math.max(
    1,
    Math.ceil(invoiceCollection.total / Math.max(1, invoiceCollection.limit)),
  );
  const invoiceStartIndex = (invoiceCollection.page - 1) * invoiceCollection.limit;
  const visibleInvoiceTransactions = invoiceTransactions;
  const showInvoicePagination = invoiceCollection.total > invoiceCollection.limit;

  React.useEffect(() => {
    setInvoicePage((currentPage) => Math.min(currentPage, invoiceTotalPages));
  }, [invoiceTotalPages]);

  const runAction = async (
    key: string,
    message: string,
    action: () => Promise<unknown>,
  ) => {
    setPendingAction(key);
    setActionError(null);
    setActionMessage(null);
    try {
      await action();
      setActionMessage(message);
      await refreshBillingData();
      window.dispatchEvent(new CustomEvent(BILLING_BALANCE_UPDATED_EVENT));
    } catch (error) {
      setActionError(localizeError(error));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="w-full">
      <SectionHeader
        title={tAuto("billing_abaec452")}
        description={tAuto(
          "manage_your_plan_renewal_and_payment_method_e9b1318c",
        )}
      />

      <PaymentRiskPanel />

      {data.loading && <BillingSectionSkeleton />}
      {!data.loading && (
        <>
          <InlineStatus
            error={actionError ?? data.error}
            saved={Boolean(actionMessage)}
            message={actionMessage ?? undefined}
          />

          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <WalletCards className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">
                    <UiText id="current_plan_440a9f2c" />
                  </h2>
                  <Badge
                    className={cn(
                      pendingCancellation
                        ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
                        : "bg-success/10 text-success hover:bg-success/10",
                    )}
                  >
                    {pendingCancellation
                      ? tAuto("cancels_at_period_end_2ae0ac5d")
                      : tAuto("active_a733b809")}
                  </Badge>
                </div>
                <p className="mt-2 text-xl font-semibold leading-7 text-foreground">
                  {tSettings(plan.labelKey)} <UiText id="plan_ae2f98a0" />
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <PlanStat
                    label={tAuto("billing_cycle_b493d8ac")}
                    value={billingCycle}
                  />
                  <PlanStat
                    label={tAuto("plan_cost_01839ef2")}
                    value={planCost}
                  />
                  <PlanStat
                    label={tAuto("included_credits_e73abba7")}
                    value={formatCredits(includedPlanCredits)}
                  />
                  <PlanStat
                    label={
                      pendingCancellation
                        ? tAuto("access_until_ffc1ab2f")
                        : tAuto("renewal_578e19a8")
                    }
                    value={renewalDate}
                  />
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 px-3 text-sm font-medium"
                >
                  <Link href="/settings?section=usage">
                    <ReceiptText className="h-3.5 w-3.5" />
                    <UiText id="view_usage_972c8f47" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 px-3 text-sm font-medium"
                  onClick={() => setPlanDialogOpen(true)}
                >
                  <WalletCards className="h-3.5 w-3.5" />
                  <UiText id="change_plan_5dccc310" />
                </Button>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">
                      <UiText id="billing_credit_384e9a18" />
                    </h2>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                    <p className="text-3xl font-semibold leading-none text-foreground">
                      {formatCredits(availableCredits)}
                    </p>
                    <p className="pb-1 text-sm text-muted-foreground">
                      <UiText id="available_credits_3fa50669" />
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-4">
                  <Button
                    asChild
                    variant="link"
                    size="sm"
                    className="h-auto px-0 py-0 text-xs text-muted-foreground hover:text-primary"
                  >
                    <Link href="/settings/top-up#auto-topup">
                      <UiText id="auto_topup_settings_4efbdb04" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="h-9 gap-1.5">
                    <Link href="/settings/top-up">
                      <Plus className="h-3.5 w-3.5" />
                      <UiText id="add_credit_e89c5ab0" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="w-full">
                <div className="mb-2 flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-muted-foreground">
                    <UiText id="used_02c0e4a1" />
                  </span>
                  <span className="font-semibold text-foreground sm:text-right">
                    {tSettings("creditUsageSummary", {
                      percent: creditUsagePercent,
                      credits: formatCredits(usedCredits),
                    })}
                  </span>
                </div>
                <Progress value={creditUsagePercent} className="h-3 w-full" />
              </div>
            </div>
          </section>

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  <UiText id="payment_methods_ad68e79c" />
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <UiText id="manage_cards_used_for_renewals_and_plan_changes_9e91bd9b" />
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 cursor-pointer gap-1.5"
                disabled={
                  data.methodStatus?.can_add === false || Boolean(pendingAction)
                }
                onClick={() => setCardDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                <UiText id="add_card_91edf1fe" />
              </Button>
            </div>

            {data.paymentMethods.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {data.paymentMethods.map((method) => {
                  const canRemove =
                    !method.is_default || data.paymentMethods.length === 1;

                  return (
                    <PaymentMethodCard
                      key={method.payment_method_id}
                      brand={method.brand}
                      last4={method.last4}
                      expiry={formatCardExpiry(
                        method.exp_month,
                        method.exp_year,
                      )}
                      isDefault={method.is_default}
                      actionLabel={
                        method.is_default
                          ? tAuto("default_808d7dca")
                          : tAuto("make_default_7b2628d1")
                      }
                      actionDisabled={
                        method.is_default || Boolean(pendingAction)
                      }
                      onEdit={() => {
                        void runAction(
                          `default:${method.payment_method_id}`,
                          tSettings("defaultPaymentMethodUpdated"),
                          () =>
                            setDefaultPaymentMethod(method.payment_method_id),
                        );
                      }}
                      secondaryActionLabel={tAuto("remove_e963907d")}
                      secondaryActionDisabled={
                        !canRemove || Boolean(pendingAction)
                      }
                      onSecondaryAction={() => {
                        void runAction(
                          `remove:${method.payment_method_id}`,
                          tSettings("paymentMethodRemoved"),
                          () => removePaymentMethod(method.payment_method_id),
                        );
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyBillingPanel
                title={tAuto("no_payment_method_2fd7d8a4")}
                detail={tSettings("addCardBeforePaidPlan")}
              />
            )}
          </div>

          <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  <UiText id="balance_due_bebeab86" />
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <UiText id="unpaid_storage_usage_is_settled_from_your_availa_d3b3dd53" />
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hasOutstandingDebt && (
                  <>
                    <Badge
                      variant="destructive"
                      className="h-8 px-3 text-sm font-semibold"
                    >
                      {tSettings("creditsDue", {
                        credits: formatCredits(totalDebtCredits),
                      })}
                    </Badge>
                    <Button
                      type="button"
                      variant={canCoverDebt ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      disabled={Boolean(pendingAction)}
                      onClick={() => {
                        void runAction(
                          "debt:all",
                          tSettings("balancePaymentApplied"),
                          () =>
                            payStorageDebtWithStableOperation(
                              activeTenant?.client_mutation_scope ?? "",
                              "debt:all",
                              {},
                            ).then(() => undefined),
                        );
                      }}
                    >
                      {pendingAction === "debt:all"
                        ? tAuto("paying_9d75e060")
                        : tAuto("pay_balance_d478ccb9")}
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="p-4">
              {outstandingDebts.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <DebtMetric
                      label={tAuto("due_now_ffec2f4a")}
                      value={formatCredits(totalDebtCredits)}
                      tone="danger"
                    />
                    <DebtMetric
                      label={tAuto("available_credits_18001da8")}
                      value={formatCredits(availableCredits)}
                      tone={canCoverDebt ? "success" : "warning"}
                    />
                    <DebtMetric
                      label={tAuto("open_cycles_9c5d12c3")}
                      value={tSettings("plainCount", {
                        count: outstandingDebts.length,
                      })}
                    />
                  </div>
                  {!canCoverDebt && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        <UiText id="your_available_credits_are_below_the_outstanding_2a4d1d67" />
                      </p>
                    </div>
                  )}
                  {outstandingDebts.map((debt) => (
                    <DebtRow
                      key={debt.debt_id}
                      debt={debt}
                      pending={pendingAction === `debt:${debt.debt_id}`}
                      onPay={() => {
                        void runAction(
                          `debt:${debt.debt_id}`,
                          tSettings("debtPaymentApplied"),
                          () =>
                            payStorageDebtWithStableOperation(
                              activeTenant?.client_mutation_scope ?? "",
                              `debt:${debt.debt_id}`,
                              { debt_id: debt.debt_id },
                            ).then(() => undefined),
                        );
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-md border border-success/20 bg-success/5 px-3 py-4 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <div>
                    <p className="font-medium text-foreground">
                      <UiText id="no_balance_due_3d1bfbf3" />
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      <UiText id="your_workspace_has_no_unpaid_storage_usage_right_8710cc88" />
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <BillingInvoicesSection />

          <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                <UiText id="invoices_35f8f37b" />
              </h2>
              <SmallAction href="/settings/transactions">
                <UiText id="transactions_1e3281a9" />
              </SmallAction>
            </div>
            <div className="divide-y divide-border">
              {visibleInvoiceTransactions.map((transaction, index) => (
                <InvoiceRow
                  key={getTransactionKey(
                    transaction,
                    invoiceStartIndex + index,
                  )}
                  transaction={transaction}
                />
              ))}
              {invoiceTransactions.length === 0 && (
                <div className="p-4">
                  <EmptyBillingPanel
                    title={tAuto("no_invoices_yet_5e193a73")}
                    detail={tSettings("billingTransactionsAppearHere")}
                  />
                </div>
              )}
            </div>
            {showInvoicePagination && (
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {tSettings("pageOf", {
                    page: invoicePage,
                    total: invoiceTotalPages,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    disabled={invoicePage <= 1}
                    onClick={() =>
                      setInvoicePage((currentPage) =>
                        Math.max(1, currentPage - 1),
                      )
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <UiText id="previous_50f94286" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    disabled={invoicePage >= invoiceTotalPages}
                    onClick={() =>
                      setInvoicePage((currentPage) =>
                        Math.min(invoiceTotalPages, currentPage + 1),
                      )
                    }
                  >
                    <UiText id="next_bc981983" />
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </section>

          <PlanManagementPanel
            currentOffer={currentOffer}
            pendingAction={pendingAction}
            onCancel={() => {
              if (!currentOffer) return;
              void runAction(
                "plan:cancel",
                tSettings("planCancellationScheduled"),
                () =>
                  cancelTenantOffer({
                    tenant_offer_id: currentOffer.id,
                  }),
              );
            }}
            onUndoCancel={() => {
              if (!currentOffer) return;
              void runAction(
                "plan:undo-cancel",
                tSettings("planReactivated"),
                () =>
                  undoCancelTenantOffer({
                    tenant_offer_id: currentOffer.id,
                  }),
              );
            }}
          />

          <AddPaymentMethodDialog
            open={cardDialogOpen}
            email={email}
            onOpenChange={setCardDialogOpen}
            onSaved={async () => {
              setCardDialogOpen(false);
              setActionMessage(tSettings("paymentMethodAdded"));
              await refreshBillingData();
            }}
          />

          <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
            <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-[1180px]">
              <DialogHeader className="sr-only">
                <DialogTitle>
                  <UiText id="change_plan_5dccc310" />
                </DialogTitle>
                <DialogDescription>
                  <UiText id="compare_plans_and_change_your_current_subscripti_f2b3b736" />
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[92vh] overflow-y-auto">
                {planDialogOpen && (
                  <OfferPlanPage
                    billingEmail={email}
                    context="change-plan"
                    onCompleted={async (completion) => {
                      applyCompletedPlanProfile(completion);
                      setPlanDialogOpen(false);
                      await refreshBillingData();
                      window.dispatchEvent(
                        new CustomEvent(BILLING_BALANCE_UPDATED_EVENT),
                      );
                      window.dispatchEvent(
                        new CustomEvent(CHANNEL_SLOT_SELECTION_CHECK_EVENT),
                      );
                      toast.success(tSettings("planUpdated"), {
                        description: tSettings("planUpdatedDescription"),
                      });
                    }}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function LimitsSection() {
  const tAuto = useTranslations("Auto");
  const tSettings = useTranslations("Settings");
  const formats = useSettingsFormats();
  const limitsQuery = useQuery({
    queryKey: MY_FEATURE_LIMITS_QUERY_KEY,
    queryFn: getMyFeatureLimits,
    staleTime: 5 * 60_000,
  });
  const channelsQuery = useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: listChannels,
    staleTime: 5 * 60_000,
  });
  const featureLimits = React.useMemo(
    () =>
      [...(limitsQuery.data?.features ?? [])].sort((a, b) =>
        getFeatureLimitName(a, tSettings).localeCompare(
          getFeatureLimitName(b, tSettings),
        ),
      ),
    [limitsQuery.data?.features, tSettings],
  );
  const planType = limitsQuery.data?.plan_type ?? "current";
  const limitsSyncing = Boolean(limitsQuery.error);
  const channelLimit = featureLimits.find(
    (feature) => feature.key === "max_youtube_channels",
  );
  const storageLimit =
    featureLimits.find((feature) => feature.key === "max_storage_mb") ??
    featureLimits.find(
      (feature) => feature.key === "storage_included_storage_mb",
    );
  const featureUsageByKey = React.useMemo(
    () =>
      buildFeatureUsageByKey({
        features: featureLimits,
        channelCount: channelsQuery.data?.length,
        channelUsageSynced: channelsQuery.isSuccess,
      }),
    [channelsQuery.data?.length, channelsQuery.isSuccess, featureLimits],
  );

  const loading = limitsQuery.isLoading || channelsQuery.isLoading;
  if (loading) return <LimitsSectionSkeleton />;

  return (
    <div className="w-full">
      <SectionHeader
        title={tAuto("limits_61a0ae3b")}
        description={tAuto(
          "effective_plan_feature_limits_and_overrides_quot_76a3e887",
        )}
      />

      {limitsSyncing && (
        <SyncNotice>
          <UiText id="limits_will_appear_here_once_your_plan_data_fini_3fb3f0e5" />
        </SyncNotice>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <UsageMetricCard
          label={tAuto("current_plan_ec5cfba8")}
          value={formatPlanName(planType, tSettings)}
          detail={tSettings("featureLimitsCount", {
            count: featureLimits.length,
          })}
        />
        <UsageMetricCard
          label={tAuto("youtube_channels_d807f579")}
          value={
            channelLimit
              ? formatFeatureUsageValue(
                  channelLimit,
                  featureUsageByKey.get(channelLimit.key),
                  formats,
                  tSettings,
                )
              : tAuto("not_configured_811931bb")
          }
          detail={tSettings("currentChannelWorkspaces")}
        />
        <UsageMetricCard
          label={tAuto("storage_limit_b7f02c9d")}
          value={
            storageLimit
              ? formatFeatureLimitValue(storageLimit, formats, tSettings)
              : tAuto("not_configured_811931bb")
          }
          detail={tSettings("storedFileCapacityNotIo")}
        />
      </div>

      <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              <UiText id="feature_limits_c2e36aab" />
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <UiText id="effective_plan_limits_with_active_overrides_incl_08023d70" />
            </p>
          </div>
          <Badge variant="secondary">
            {tSettings("limitsCount", { count: featureLimits.length })}
          </Badge>
        </div>
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="px-4">
                <UiText id="limit_24d948e4" />
              </TableHead>
              <TableHead>
                <UiText id="value_8dce170d" />
              </TableHead>
              <TableHead>
                <UiText id="usage_0bb18642" />
              </TableHead>
              <TableHead>
                <UiText id="status_bae7d5be" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {featureLimits.map((feature) => (
              <FeatureLimitTableRow
                key={feature.key}
                feature={feature}
                usage={featureUsageByKey.get(feature.key)}
              />
            ))}
            {featureLimits.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  <UiText id="no_feature_limits_found_3d974db1" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function UsageSection() {
  const tAuto = useTranslations("Auto");
  const tSettings = useTranslations("Settings");
  const { credits: formatCredits, date: formatDate } = useSettingsFormats();
  const localizeError = useLocalizedError();
  const cycle = React.useMemo(() => getCurrentCycleRange(), []);
  const quotaUsageQuery = useQuery({
    queryKey: BILLING_QUOTA_USAGE_QUERY_KEY,
    queryFn: getBillingQuotaUsage,
    staleTime: 5 * 60_000,
  });
  const transactionsQuery = useQuery({
    queryKey: billingTransactionsQueryKey({ page: 1, limit: 20 }),
    queryFn: () => getBillingTransactions({ page: 1, limit: 20 }),
    staleTime: 2 * 60_000,
  });
  const summaryQuery = useQuery({
    queryKey: billingTransactionSummaryQueryKey({
      cycle_start: cycle.start,
      cycle_end: cycle.end,
    }),
    queryFn: () =>
      getBillingTransactionSummary({
        cycle_start: cycle.start,
        cycle_end: cycle.end,
      }),
    staleTime: 2 * 60_000,
  });
  const quotaGrantsQuery = useQuery({
    queryKey: MY_QUOTA_GRANTS_QUERY_KEY,
    queryFn: getMyQuotaGrants,
    staleTime: 5 * 60_000,
  });
  const storageAggregateQuery = useQuery({
    queryKey: storageUsageAggregateQueryKey,
    queryFn: getStorageUsageAggregate,
    staleTime: 60_000,
    retry: 1,
  });
  const usageQueries = [
    quotaUsageQuery,
    transactionsQuery,
    summaryQuery,
    quotaGrantsQuery,
  ];
  const loading = usageQueries.some(isInitialQueryLoading);
  const queryError = getFirstQueryError([
    quotaUsageQuery,
    transactionsQuery,
    summaryQuery,
  ]);
  const error = queryError ? localizeError(queryError) : null;
  const quotaUsage = quotaUsageQuery.data ?? null;
  const transactions = transactionsQuery.data?.transactions ?? [];
  const summary = summaryQuery.data ?? null;
  const quotaNameByKey = React.useMemo(
    () => buildQuotaNameByKey(quotaGrantsQuery.data?.quotas ?? [], tSettings),
    [quotaGrantsQuery.data?.quotas, tSettings],
  );
  const nonStorageQuotas = React.useMemo(
    () => buildNonStorageQuotaRows(quotaUsage),
    [quotaUsage],
  );
  const storageUsedBytes = Number(storageAggregateQuery.data?.used_bytes ?? 0);
  const storageIncludedBytes = Number(
    storageAggregateQuery.data?.included_storage_bytes ?? 0,
  );
  const streamStorageBytes = Number(
    storageAggregateQuery.data?.stream_storage_bytes ?? 0,
  );
  const includedStreamStorageBytes = Number(
    storageAggregateQuery.data?.included_stream_storage_bytes ?? 0,
  );
  const storageIoBytes = Number(
    storageAggregateQuery.data?.monthly_io_bytes ??
      storageAggregateQuery.data?.monthly_delivery_io_bytes ??
      0,
  );
  const storageIncludedIoBytes = Number(
    storageAggregateQuery.data?.included_io_bytes ?? 0,
  );

  if (loading) return <UsageSectionSkeleton />;

  const creditQuota = getCreditLikeQuotaTotals(quotaUsage);
  const topUpBalance = getTopUpBalance(quotaUsage);
  const availableCredits = getAvailableCredits(quotaUsage);
  const addedCredits =
    (summary?.total_topup_credits ?? 0) + (summary?.total_grant_credits ?? 0);
  const spentCredits = summary?.total_spent_credits ?? 0;
  const cycleLabel = tSettings("dateRange", {
    start: formatDate(cycle.start) ?? tSettings("current"),
    end: formatDate(cycle.end) ?? tSettings("current"),
  });

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Coins className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <UiText id="billing_usage_bb178db2" />
            </p>
            <h2 className="mt-1 font-display text-2xl text-foreground sm:text-3xl">
              <UiText id="usage_overview_fc2eefcb" />
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              <UiText id="keep_track_of_your_credits_plan_allowance_and_wo_aa971f1d" />
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="rounded-xl border border-border bg-panel/55 px-3 py-2 text-xs font-medium text-muted-foreground">
            <UiText id="current_cycle_d391fdbb" /> {cycleLabel}
          </span>
          <Button
            asChild
            className="h-9 rounded-xl px-3 text-sm font-semibold shadow-sm"
          >
            <Link href="/settings/top-up">
              <Plus className="size-4" />
              <UiText id="add_credits_5367d642" />
            </Link>
          </Button>
        </div>
      </div>

      {error && !quotaUsage && transactions.length === 0 && (
        <SyncNotice>
          <UiText id="usage_activity_will_appear_here_after_your_first_7eb26b35" />
        </SyncNotice>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <UsageMetricCard
          label={tAuto("available_credits_18001da8")}
          value={formatCredits(availableCredits)}
          detail={tSettings("creditBalanceBreakdown", {
            plan: formatCredits(creditQuota.remaining),
            topUp: formatCredits(topUpBalance),
          })}
        />
        <UsageMetricCard
          label={tAuto("plan_credits_left_5f9108a3")}
          value={formatCredits(creditQuota.remaining)}
          detail={tSettings("includedCreditQuota", {
            credits: formatCredits(creditQuota.total),
          })}
        />
        <UsageMetricCard
          label={tAuto("credits_added_this_cycle_fee3e2bf")}
          value={formatCredits(addedCredits)}
          detail={tSettings("spentThisCycle", {
            credits: formatCredits(spentCredits),
          })}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-border bg-panel/40 p-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg text-foreground">
              <UiText id="credit_quota_d377b96f" />
            </h2>
          </div>
          <div className="mt-5 space-y-5 rounded-xl border border-border/70 bg-background/35 p-4">
            <QuotaProgressRow
              label={tAuto("available_credits_18001da8")}
              used={spentCredits}
              total={Math.max(spentCredits + availableCredits, 1)}
              remaining={availableCredits}
              detail={tSettings("balanceAfterCycleSpend")}
            />
            <div className="grid gap-2 border-t border-border/70 pt-4 sm:grid-cols-2">
              <PaymentDetail
                label={tAuto("credits_spent_this_cycle_0ec1a5d3")}
                value={formatCredits(spentCredits)}
              />
              <PaymentDetail
                label={tAuto("credits_added_this_cycle_fee3e2bf")}
                value={formatCredits(addedCredits)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-panel/40 p-4">
          <div>
            <h2 className="font-display text-lg text-foreground">
              <UiText id="workspace_quota_0981b9de" />
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              <UiText id="storage_io_is_cdn_delivery_download_playback_all_e6675a9a" />
            </p>
          </div>
          <div className="mt-4 grid gap-2">
            {storageAggregateQuery.data && (
              <>
                <NodeUsageRow
                  quotaKey="storage:used_bytes"
                  name={tSettings("storedBytes")}
                  used={storageUsedBytes / 1024 ** 3}
                  limit={Math.max(storageIncludedBytes / 1024 ** 3, 0)}
                />
                <NodeUsageRow
                  quotaKey="storage:stream_storage_gb"
                  name={tSettings("streamStorage")}
                  used={streamStorageBytes / 1024 ** 3}
                  limit={Math.max(includedStreamStorageBytes / 1024 ** 3, 0)}
                />
                <NodeUsageRow
                  quotaKey="storage:monthly_delivery_io_gb"
                  name={tSettings("monthlyDeliveryIo")}
                  used={storageIoBytes / 1024 ** 3}
                  limit={Math.max(storageIncludedIoBytes / 1024 ** 3, 0)}
                  zeroLimitLabel={tSettings("noIncludedAllowance")}
                />
              </>
            )}
            {nonStorageQuotas.map((quota) => (
              <NodeUsageRow
                key={quota.quota_key}
                quotaKey={quota.quota_key}
                name={formatQuotaName(
                  quota.quota_key,
                  quotaNameByKey,
                  tSettings,
                )}
                used={quota.used_quota}
                limit={quota.total_quota}
              />
            ))}
            {nonStorageQuotas.length === 0 && !storageAggregateQuery.data && (
              <div className="rounded-xl border border-dashed border-border p-4">
                <EmptyBillingPanel
                  title={tAuto("no_quota_usage_b1e239d0")}
                  detail={tSettings("usageRecordsAppearAfterActivity")}
                />
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-panel/40">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg text-foreground">
              <UiText id="credit_activity_05b17cea" />
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              <UiText id="top_ups_and_spend_are_shown_together_for_easier__8dd9d3f3" />
            </p>
          </div>
          <Badge
            variant="secondary"
            className="w-fit rounded-full bg-background/60 px-2.5 py-1"
          >
            {tSettings("recordsCount", { count: transactions.length })}
          </Badge>
        </div>

        <Table>
          <TableHeader className="bg-background/35">
            <TableRow>
              <TableHead className="w-[132px] px-4">
                <UiText id="date_eb9a4bc1" />
              </TableHead>
              <TableHead>
                <UiText id="activity_81c0d915" />
              </TableHead>
              <TableHead className="hidden md:table-cell">
                <UiText id="source_6da13add" />
              </TableHead>
              <TableHead>
                <UiText id="status_bae7d5be" />
              </TableHead>
              <TableHead className="text-right">
                <UiText id="credits_bfac50d6" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction, index) => {
              const direction = getTransactionDirection(transaction);
              const isAdded = direction === "credit";
              const transactionSource = formatTransactionSource(
                transaction,
                quotaNameByKey,
                tSettings,
              );

              return (
                <TableRow key={getTransactionKey(transaction, index)}>
                  <TableCell className="px-4 text-muted-foreground">
                    {formatDate(transaction.created_at) ?? "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      {isAdded ? (
                        <ArrowDownCircle className="h-4 w-4 shrink-0 text-success" />
                      ) : direction === "neutral" ? (
                        <ReceiptText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4 shrink-0 text-amber-600" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {formatTransactionType(transaction.type, tSettings)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground md:hidden">
                          {transactionSource}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {transactionSource}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        isAdded
                          ? "bg-success/10 text-success hover:bg-success/10"
                          : direction === "neutral"
                            ? "bg-muted text-muted-foreground hover:bg-muted"
                            : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300",
                      )}
                    >
                      {formatTransactionStatus(transaction, tSettings)}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold",
                      isAdded ? "text-success" : "text-foreground",
                    )}
                  >
                    {isAdded ? "+" : direction === "debit" ? "-" : ""}
                    {formatCredits(Math.abs(transaction.amount_credits))}
                  </TableCell>
                </TableRow>
              );
            })}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  <UiText id="no_billing_activity_yet_b7eaffe5" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface BillingSettingsData {
  loading: boolean;
  error: string | null;
  quotaUsage: BillingQuotaUsage | null;
  paymentMethods: PaymentMethod[];
  methodStatus: PaymentMethodStatus | null;
  transactions: BillingTransaction[];
  transactionSummary: BillingTransactionSummary | null;
  debtStatus: StorageDebtStatus | null;
  myOffers: MyOffer[];
}

function getCurrentOffer(offers: MyOffer[]) {
  return (
    [...offers]
      .filter(
        (offer) =>
          offer.status === "active" || offer.status === "pending_cancellation",
      )
      .sort((left, right) => {
        const statusRank =
          (right.status === "pending_cancellation" ? 1 : 0) -
          (left.status === "pending_cancellation" ? 1 : 0);
        if (statusRank !== 0) return statusRank;
        return Date.parse(right.created_at) - Date.parse(left.created_at);
      })[0] ?? null
  );
}

function resolveCurrentIncludedPlanCredits(
  pricing: MyOffer["pricing_snapshot"] | null,
) {
  if (!pricing) return 0;
  const priceCredits = Math.round(pricing.discounted_price * 100);
  return Math.max(pricing.credit_equivalent, priceCredits);
}

const PLAN_INCLUDED_CREDITS_QUOTA_KEY = "billing:plan_included_credits";
type BillingQuotaUsageItem = BillingQuotaUsage["quotas"][number];

function buildNonStorageQuotaRows(
  quotaUsage: BillingQuotaUsage | null,
): BillingQuotaUsageItem[] {
  const rowsByKey = new Map<string, BillingQuotaUsageItem>();

  for (const quota of quotaUsage?.quotas ?? []) {
    const quotaKey = quota.quota_key.toLowerCase();
    if (
      quotaKey.includes("storage") ||
      quotaKey === PLAN_INCLUDED_CREDITS_QUOTA_KEY
    )
      continue;

    const existing = rowsByKey.get(quota.quota_key);
    if (!existing) {
      rowsByKey.set(quota.quota_key, { ...quota });
      continue;
    }

    rowsByKey.set(quota.quota_key, {
      quota_key: quota.quota_key,
      total_quota: sumCredits(existing.total_quota, quota.total_quota),
      used_quota: sumCredits(existing.used_quota, quota.used_quota),
      remaining_quota: sumCredits(
        existing.remaining_quota,
        quota.remaining_quota,
      ),
    });
  }

  return Array.from(rowsByKey.values()).filter(hasVisibleQuotaUsage);
}

function hasVisibleQuotaUsage(quota: BillingQuotaUsageItem) {
  return (
    quota.total_quota > 0 || quota.used_quota > 0 || quota.remaining_quota > 0
  );
}

function getAvailableCredits(quotaUsage: BillingQuotaUsage | null) {
  if (!quotaUsage) return 0;
  if (typeof quotaUsage.available_credits === "number")
    return quotaUsage.available_credits;
  return sumCredits(
    getCreditLikeQuotaTotals(quotaUsage).remaining,
    getTopUpBalance(quotaUsage),
  );
}

function getTopUpBalance(quotaUsage: BillingQuotaUsage | null) {
  return quotaUsage?.top_up_balance_credits ?? quotaUsage?.credit_balance ?? 0;
}

function getCreditLikeQuotaTotals(quotaUsage: BillingQuotaUsage | null) {
  if (quotaUsage?.plan_included_credits) {
    return {
      total: quotaUsage.plan_included_credits.total,
      used: quotaUsage.plan_included_credits.used,
      remaining: quotaUsage.plan_included_credits.remaining,
    };
  }

  return (
    quotaUsage?.quotas.reduce(
      (totals, quota) => {
        if (quota.quota_key !== PLAN_INCLUDED_CREDITS_QUOTA_KEY) return totals;
        return {
          total: sumCredits(totals.total, quota.total_quota),
          used: sumCredits(totals.used, quota.used_quota),
          remaining: sumCredits(totals.remaining, quota.remaining_quota),
        };
      },
      { total: 0, used: 0, remaining: 0 },
    ) ?? { total: 0, used: 0, remaining: 0 }
  );
}

function sumCredits(...values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100;
}

function EmptyBillingPanel({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-sm">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">{detail}</p>
    </div>
  );
}

function SyncNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-md border border-border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function DebtMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        tone === "success" && "border-success/20 bg-success/5",
        tone === "warning" && "border-amber-500/25 bg-amber-500/10",
        tone === "danger" && "border-destructive/20 bg-destructive/5",
        tone === "default" && "border-border bg-muted/20",
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function DebtRow({
  debt,
  pending,
  onPay,
}: {
  debt: StorageDebtStatus["debts"][number];
  pending: boolean;
  onPay: () => void;
}) {
  const tAuto = useTranslations("Auto");
  const tSettings = useTranslations("Settings");
  const { credits: formatCredits, date: formatDate } = useSettingsFormats();
  const paidCredits =
    debt.paid_credits > 0 ? formatCredits(debt.paid_credits) : null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            {tSettings("creditsDue", {
              credits: formatCredits(debt.remaining_credits),
            })}
          </p>
          <Badge variant="secondary">
            {formatDebtStatus(debt.status, tSettings)}
          </Badge>
          {debt.reconciliation_required ? (
            <Badge variant="outline">{tSettings("debtReconciliationRequired")}</Badge>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {tSettings("dateRange", {
              start: formatDate(debt.cycle_start) ?? "-",
              end: formatDate(debt.cycle_end) ?? "-",
            })}
          </span>
          {paidCredits && (
            <span>{tSettings("creditsPaid", { credits: paidCredits })}</span>
          )}
          {debt.attempt_count > 0 && (
            <span>
              {tSettings("paymentAttempts", { count: debt.attempt_count })}
            </span>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0"
        disabled={pending}
        onClick={onPay}
      >
        {pending ? tAuto("paying_9d75e060") : tAuto("pay_this_cycle_202417a6")}
      </Button>
    </div>
  );
}

function InvoiceRow({ transaction }: { transaction: BillingTransaction }) {
  const tSettings = useTranslations("Settings");
  const formats = useSettingsFormats();
  const details = getInvoiceDetails(transaction, formats, tSettings);
  return (
    <div className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{details.title}</p>
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {details.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      <Badge variant="secondary">{details.status}</Badge>
      <p className="text-right font-semibold text-foreground">
        {details.amount}
      </p>
    </div>
  );
}

function getInvoiceDetails(
  transaction: BillingTransaction,
  formats: SettingsFormats,
  t: SettingsTranslator,
) {
  const metadata = transaction.metadata ?? {};
  const isStorage =
    transaction.source_type === "storage_overage" ||
    transaction.source_type === "storage_debt";
  const fundingSource = String(
    transaction.funding_source ?? metadata.funding_source ?? "",
  );
  const cardCredits =
    metadataNumber(metadata, "card_charged_credits") ||
    (fundingSource === "stripe" ? transaction.amount_credits : 0);
  const cardGbp =
    metadataNumber(metadata, "card_charged_gbp") ||
    metadataNumber(metadata, "amount_gbp") ||
    cardCredits / 100;
  const topUpCredits =
    metadataNumber(metadata, "top_up_credits") ||
    (fundingSource === "balance" ? transaction.balance_credits : 0);
  const planCredits =
    metadataNumber(metadata, "plan_credits") ||
    (fundingSource === "quota" ? transaction.quota_credits : 0);
  const cycleStart = metadataString(metadata, "cycle_start");
  const cycleEnd = metadataString(metadata, "cycle_end");
  const usageCategory = metadataString(metadata, "usage_category");
  const billingReason = metadataString(metadata, "billing_reason");

  const title = isStorage
    ? billingReason === "Outstanding storage usage balance"
      ? t("outstandingStorageBalance")
      : t("storageUsageOverage")
    : formatTransactionType(transaction.type, t);
  const lines = [
    t("recordedOn", { date: formats.date(transaction.created_at) ?? "-" }),
  ];
  if (cycleStart || cycleEnd) {
    lines.push(
      t("billingPeriodRange", {
        start: formats.date(cycleStart) ?? t("unknown"),
        end: formats.date(cycleEnd) ?? t("unknown"),
      }),
    );
  }
  if (usageCategory)
    lines.push(
      t("reasonValue", { reason: formatSystemKeyLabel(usageCategory) }),
    );

  const ioOverageGb = metadataNumber(metadata, "io_overage_gb");
  const cumulativeIoGb = metadataNumber(metadata, "cumulative_io_gb");
  const includedIoGb = metadataNumber(metadata, "included_io_gb");
  if (ioOverageGb > 0) {
    lines.push(
      cumulativeIoGb > 0
        ? includedIoGb > 0
          ? t("cdnIoOverageWithIncluded", {
              overage: formats.number(ioOverageGb),
              used: formats.number(cumulativeIoGb),
              included: formats.number(includedIoGb),
            })
          : t("cdnIoOverageWithUsed", {
              overage: formats.number(ioOverageGb),
              used: formats.number(cumulativeIoGb),
            })
        : t("cdnIoOverage", { overage: formats.number(ioOverageGb) }),
    );
  }
  const storageOverageGb = metadataNumber(metadata, "storage_overage_gb");
  const storageAverageGb = metadataNumber(metadata, "storage_daily_average_gb");
  if (storageOverageGb > 0) {
    lines.push(
      storageAverageGb > 0
        ? t("storageOverageWithAverage", {
            overage: formats.number(storageOverageGb),
            average: formats.number(storageAverageGb),
          })
        : t("storageOverage", { overage: formats.number(storageOverageGb) }),
    );
  }
  if (cardCredits > 0) {
    lines.push(
      t("cardChargeCredits", {
        amount: formats.gbp(cardGbp),
        credits: formats.credits(cardCredits),
      }),
    );
  }
  if (topUpCredits > 0)
    lines.push(
      t("topUpCreditsUsed", { credits: formats.credits(topUpCredits) }),
    );
  if (planCredits > 0)
    lines.push(t("planCreditsUsed", { credits: formats.credits(planCredits) }));

  return {
    title,
    lines,
    status:
      cardCredits > 0
        ? t("chargedToCard")
        : planCredits > 0 && topUpCredits > 0
          ? t("paidWithCredits")
          : planCredits > 0
            ? t("paidWithPlanCredits")
            : topUpCredits > 0
              ? t("paidWithTopUpCredits")
              : formatTransactionStatus(transaction, t),
    amount:
      cardCredits > 0
        ? t("cardAndCreditsAmount", {
            amount: formats.gbp(cardGbp),
            credits: formats.credits(cardCredits),
          })
        : t("creditsAmount", {
            value: formats.credits(transaction.amount_credits),
          }),
  };
}

function metadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = Number(metadata[key]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function PlanManagementPanel({
  currentOffer,
  pendingAction,
  onCancel,
  onUndoCancel,
}: {
  currentOffer: MyOffer | null;
  pendingAction: string | null;
  onCancel: () => void;
  onUndoCancel: () => void;
}) {
  const tAuto = useTranslations("Auto");
  const tSettings = useTranslations("Settings");
  const { date: formatDate } = useSettingsFormats();
  const pendingCancellation = currentOffer?.status === "pending_cancellation";
  const action = pendingCancellation
    ? {
        icon: CheckCircle2,
        title: tSettings("reactivatePlan"),
        description: tSettings("reactivatePlanDescription", {
          date:
            formatDate(
              currentOffer?.effective_cancellation_at ??
                currentOffer?.expires_at,
            ) ?? tSettings("currentPeriod"),
        }),
        actionLabel:
          pendingAction === "plan:undo-cancel"
            ? tSettings("reactivating")
            : tSettings("reactivatePlan"),
        confirmTitle: tSettings("reactivatePlanConfirmTitle"),
        confirmDescription: tSettings("reactivatePlanConfirmDescription"),
        confirmAction: tSettings("reactivatePlan"),
        onConfirm: onUndoCancel,
        disabled: pendingAction !== null,
      }
    : {
        icon: Ban,
        title: tSettings("cancelPlan"),
        description: currentOffer
          ? tSettings("cancelPlanDescription", {
              date:
                formatDate(currentOffer.expires_at) ??
                tSettings("currentPeriodEnds"),
            })
          : tSettings("noActivePaidPackage"),
        actionLabel:
          pendingAction === "plan:cancel"
            ? tSettings("scheduling")
            : tSettings("cancelPlan"),
        confirmTitle: tSettings("cancelPlanConfirmTitle"),
        confirmDescription: tSettings("cancelPlanConfirmDescription"),
        confirmAction: tSettings("cancelPlanConfirmAction"),
        destructive: true,
        onConfirm: onCancel,
        disabled: !currentOffer || pendingAction !== null,
      };

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-border bg-card px-4">
      <DangerCollapse
        title={tAuto("plan_management_8b07722d")}
        description={
          pendingCancellation
            ? tAuto("reactivate_options_are_hidden_here_762e7579")
            : tAuto("cancel_options_are_hidden_here_65c7b8f8")
        }
        actions={[action]}
      />
    </section>
  );
}

export function TransactionsSection() {
  const tAuto = useTranslations("Auto");
  const tSettings = useTranslations("Settings");
  const { credits: formatCredits, date: formatDate } = useSettingsFormats();
  const localizeError = useLocalizedError();
  const searchParams = useSearchParams();
  const page = getPage(searchParams.get("page"));
  const transactionsQuery = useQuery({
    queryKey: billingTransactionsQueryKey({ page, limit: BILLING_PAGE_SIZE }),
    queryFn: () => getBillingTransactions({ page, limit: BILLING_PAGE_SIZE }),
    staleTime: 2 * 60_000,
  });
  const quotaGrantsQuery = useQuery({
    queryKey: MY_QUOTA_GRANTS_QUERY_KEY,
    queryFn: getMyQuotaGrants,
    staleTime: 5 * 60_000,
  });
  const loading = isInitialQueryLoading(transactionsQuery);
  const error = transactionsQuery.error
    ? localizeError(transactionsQuery.error)
    : null;
  const result = transactionsQuery.data ?? {
    transactions: [],
    page,
    limit: BILLING_PAGE_SIZE,
    total: 0,
  };
  const quotaNameByKey = React.useMemo(
    () => buildQuotaNameByKey(quotaGrantsQuery.data?.quotas ?? [], tSettings),
    [quotaGrantsQuery.data?.quotas, tSettings],
  );

  const totalPages =
    result.total > result.transactions.length
      ? Math.max(1, Math.ceil(result.total / BILLING_PAGE_SIZE))
      : null;
  const canGoNext = totalPages
    ? page < totalPages
    : result.transactions.length === BILLING_PAGE_SIZE;

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2 h-8 gap-1.5 px-2"
          >
            <Link href="/settings?section=billing">
              <ChevronLeft className="h-4 w-4" />
              <UiText id="billing_abaec452" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              <UiText id="transactions_1e3281a9" />
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <UiText id="paginated_subscription_top_up_and_usage_billing__620e2e66" />
          </p>
        </div>
        {loading ? (
          <Skeleton className="h-6 w-20 rounded-full" />
        ) : (
          <Badge variant="secondary">
            {tSettings("recordsCount", {
              count: result.total || result.transactions.length,
            })}
          </Badge>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[132px] px-4">
                <UiText id="date_eb9a4bc1" />
              </TableHead>
              <TableHead>
                <UiText id="description_55f8ebc8" />
              </TableHead>
              <TableHead className="hidden sm:table-cell">
                <UiText id="source_6da13add" />
              </TableHead>
              <TableHead>
                <UiText id="status_bae7d5be" />
              </TableHead>
              <TableHead className="text-right">
                <UiText id="credits_bfac50d6" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TransactionTableSkeletonRows rows={BILLING_PAGE_SIZE} />
            ) : result.transactions.length > 0 ? (
              result.transactions.map((transaction, index) => {
                const direction = getTransactionDirection(transaction);

                return (
                  <TableRow key={getTransactionKey(transaction, index)}>
                    <TableCell className="px-4 text-muted-foreground">
                      {formatDate(transaction.created_at) ?? "-"}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {formatTransactionType(transaction.type, tSettings)}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                        {formatTransactionSource(
                          transaction,
                          quotaNameByKey,
                          tSettings,
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatTransactionSource(
                        transaction,
                        quotaNameByKey,
                        tSettings,
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          direction === "credit"
                            ? "bg-success/10 text-success hover:bg-success/10"
                            : "bg-muted text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {formatTransactionStatus(transaction, tSettings)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {direction === "credit"
                        ? "+"
                        : direction === "debit"
                          ? "-"
                          : ""}
                      {formatCredits(Math.abs(transaction.amount_credits))}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  {error
                    ? tAuto("no_transactions_to_show_yet_fcce1a8e")
                    : tAuto("no_billing_transactions_yet_895f51ae")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {totalPages
            ? tSettings("pageOf", { page, total: totalPages })
            : tSettings("pageNumber", { page })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={page <= 1}
          >
            <Link
              href={`/settings/transactions?page=${Math.max(1, page - 1)}`}
              aria-disabled={page <= 1}
              tabIndex={page <= 1 ? -1 : undefined}
            >
              <ChevronLeft className="h-4 w-4" />
              <UiText id="previous_50f94286" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={!canGoNext}
          >
            <Link
              href={`/settings/transactions?page=${page + 1}`}
              aria-disabled={!canGoNext}
              tabIndex={!canGoNext ? -1 : undefined}
            >
              <UiText id="next_bc981983" />
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface FeatureLimitUsage {
  used: number;
  total: number;
  synced: boolean;
}

function FeatureLimitTableRow({
  feature,
  usage,
}: {
  feature: FeatureLimit;
  usage?: FeatureLimitUsage;
}) {
  const tAuto = useTranslations("Auto");
  const tSettings = useTranslations("Settings");
  const formats = useSettingsFormats();
  return (
    <TableRow>
      <TableCell className="px-4">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {getFeatureLimitName(feature, tSettings)}
          </p>
        </div>
      </TableCell>
      <TableCell className="font-semibold text-foreground">
        {formatFeatureLimitValue(feature, formats, tSettings)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatFeatureUsageValue(feature, usage, formats, tSettings)}
      </TableCell>
      <TableCell>
        {feature.has_override ? (
          <Badge variant="secondary">
            {feature.expires_at
              ? tSettings("untilDate", {
                  date: formats.date(feature.expires_at) ?? feature.expires_at,
                })
              : tAuto("override_84219262")}
          </Badge>
        ) : (
          <Badge className="bg-success/10 text-success hover:bg-success/10">
            <UiText id="plan_ae2f98a0" />
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

function QuotaProgressRow({
  label,
  used,
  total,
  remaining,
  detail,
}: {
  label: string;
  used: number;
  total: number;
  remaining: number;
  detail: string;
}) {
  const tSettings = useTranslations("Settings");
  const { credits: formatCredits } = useSettingsFormats();
  const usagePercent = getUsagePercent(used, total);

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-foreground">
            {tSettings("amountLeft", { amount: formatCredits(remaining) })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tSettings("usedOfTotal", {
              used: formatCredits(used),
              total: formatCredits(total),
            })}
          </p>
        </div>
      </div>
      <Progress value={usagePercent} className="h-2.5" />
    </div>
  );
}

function NodeUsageRow({
  quotaKey,
  name,
  used,
  limit,
  zeroLimitLabel,
}: {
  quotaKey: string;
  name: string;
  used: number;
  limit: number;
  zeroLimitLabel?: string;
}) {
  const tSettings = useTranslations("Settings");
  const formats = useSettingsFormats();
  const hasLimit = limit > 0;
  const remaining = hasLimit ? Math.max(0, limit - used) : 0;
  const usagePercent = hasLimit ? getUsagePercent(used, limit) : 0;

  return (
    <div className="rounded-xl border border-border/70 bg-background/35 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasLimit
              ? tSettings("remainingAmount", {
                  amount: formatQuotaAmount(
                    quotaKey,
                    remaining,
                    formats,
                    tSettings,
                  ),
                })
              : (zeroLimitLabel ?? tSettings("noIncludedAllowance"))}
          </p>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">
          {hasLimit
            ? tSettings("amountOfTotal", {
                amount: formatQuotaAmount(quotaKey, used, formats, tSettings),
                total: formatQuotaAmount(quotaKey, limit, formats, tSettings),
              })
            : tSettings("usedAmount", {
                amount: formatQuotaAmount(quotaKey, used, formats, tSettings),
              })}
        </p>
      </div>
      <Progress value={usagePercent} className="h-2" />
    </div>
  );
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function PaymentDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/55 px-3 py-2.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm text-foreground">{value}</p>
    </div>
  );
}

function UsageMetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-panel/40 p-4 transition-colors hover:border-primary/35">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl leading-none text-foreground">
        {value}
      </p>
      <p className="mt-3 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

type SettingsFormats = ReturnType<typeof useSettingsFormats>;
type SettingsTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function useSettingsFormats() {
  const formatter = useFormatter();
  return React.useMemo(
    () => ({
      credits: (value: number) =>
        formatter.number(value, { maximumFractionDigits: 4 }),
      date: (value?: string | null) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return formatter.dateTime(date, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      },
      gbp: (value: number) =>
        formatter.number(value, { style: "currency", currency: "GBP" }),
      money: (amount: number, currency = "GBP") =>
        formatter.number(amount, {
          style: "currency",
          currency,
          maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
        }),
      number: (value: number) =>
        formatter.number(value, { maximumFractionDigits: 4 }),
    }),
    [formatter],
  );
}

function getUsagePercent(used: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function formatBillingCycle(
  value: string | null | undefined,
  t: SettingsTranslator,
) {
  const normalized = value?.toLowerCase() ?? "monthly";
  if (normalized === "yearly" || normalized === "annual")
    return t("billingCycleYearly");
  if (normalized === "quarterly") return t("billingCycleQuarterly");
  if (normalized === "monthly") return t("billingCycleMonthly");
  return value ?? t("billingCycleMonthly");
}

function formatBillingPeriodUnit(
  value: string | null | undefined,
  t: SettingsTranslator,
) {
  const normalized = value?.toLowerCase() ?? "monthly";
  if (normalized === "yearly" || normalized === "annual")
    return t("periodYear");
  if (normalized === "quarterly") return t("periodQuarter");
  return t("periodMonth");
}

function isInitialQueryLoading(query: { data: unknown; isLoading: boolean }) {
  return query.isLoading && query.data === undefined;
}

function getFirstQueryError(queries: Array<{ error: unknown }>) {
  const failed = queries.find((query) => query.error);
  return failed?.error ?? null;
}

function getCurrentCycleRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: start.toISOString(),
    end: now.toISOString(),
  };
}

function formatCardExpiry(month?: number | null, year?: number | null) {
  if (!month || !year) return null;
  return `${String(month).padStart(2, "0")}/${year}`;
}

function formatDebtStatus(
  status: string | null | undefined,
  t: SettingsTranslator,
) {
  const key = status?.toLowerCase() ?? "open";
  const statusKeyByValue: Record<string, string> = {
    open: "debtStatusOpen",
    pending: "debtStatusPending",
    partial: "debtStatusPartial",
    paid: "debtStatusPaid",
    settled: "debtStatusSettled",
    failed: "debtStatusFailed",
    cancelled: "debtStatusCancelled",
    canceled: "debtStatusCancelled",
  };
  const translationKey = statusKeyByValue[key];
  return translationKey ? t(translationKey) : t("unknownStatus");
}

function buildQuotaNameByKey(grants: QuotaGrant[], t: SettingsTranslator) {
  return new Map(
    grants.map((grant) => [grant.key, getQuotaGrantName(grant, t)]),
  );
}

function buildFeatureUsageByKey(input: {
  features: FeatureLimit[];
  channelCount?: number;
  channelUsageSynced: boolean;
}) {
  const usageByKey = new Map<string, FeatureLimitUsage>();
  const channelLimit = input.features.find(
    (feature) => feature.key === "max_youtube_channels",
  );
  if (channelLimit) {
    usageByKey.set(channelLimit.key, {
      used: input.channelUsageSynced ? (input.channelCount ?? 0) : 0,
      total: channelLimit.value,
      synced: input.channelUsageSynced,
    });
  }
  return usageByKey;
}

function formatPlanName(planType: string, t: (key: string) => string) {
  const plan = planCopy[planType];
  if (plan) return t(plan.labelKey);
  return planType
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getFeatureLimitName(feature: FeatureLimit, t: SettingsTranslator) {
  return getDisplayLabel(feature.name, feature.key, t);
}

function getQuotaGrantName(grant: QuotaGrant, t: SettingsTranslator) {
  return getDisplayLabel(grant.name, grant.key, t);
}

function formatQuotaName(
  value: string,
  quotaNameByKey: Map<string, string> | undefined,
  t: SettingsTranslator,
) {
  return quotaNameByKey?.get(value) ?? getDisplayLabel(null, value, t);
}

function getDisplayLabel(
  name: string | null | undefined,
  key: string,
  t: SettingsTranslator,
) {
  const translationKey = featureControlLabelKeyByKey[key];
  if (translationKey) return t(translationKey);
  const trimmedName = name?.trim();
  if (trimmedName && !looksLikeSystemKey(trimmedName)) return trimmedName;
  return formatSystemKeyLabel(key);
}

function looksLikeSystemKey(value: string) {
  return (
    /^[a-z]+:[a-z0-9_:-]+$/i.test(value) ||
    /^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(value)
  );
}

function formatSystemKeyLabel(value: string) {
  return value
    .replace(/^node:/, "")
    .replace(/^agent:/, "")
    .replace(/^workflow:/, "")
    .replace(/^storage:/, "")
    .replace(/[_:-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTransactionSource(
  transaction: BillingTransaction,
  quotaNameByKey: Map<string, string> | undefined,
  t: SettingsTranslator,
) {
  if (transaction.source_type) {
    const sourceKeyByValue: Record<string, string> = {
      storage_overage: "sourceStorageOverage",
      storage_debt: "sourceStorageDebt",
      stripe: "sourceCard",
      balance: "sourceBalance",
      quota: "sourceQuota",
    };
    const translationKey = sourceKeyByValue[transaction.source_type];
    return translationKey
      ? t(translationKey)
      : formatSystemKeyLabel(transaction.source_type);
  }
  if (transaction.quota_key)
    return formatQuotaName(transaction.quota_key, quotaNameByKey, t);
  if (transaction.workflow_id) return t("sourceWorkflow");
  return t("sourceBilling");
}

function formatFeatureLimitValue(
  feature: FeatureLimit,
  formats: SettingsFormats,
  t: SettingsTranslator,
) {
  const key = feature.key.toLowerCase();
  const value = feature.value;

  if (key.includes("enabled")) return value > 0 ? t("enabled") : t("off");
  if (key.includes("percent")) return `${formats.credits(value)}%`;
  if (key.endsWith("_mb") || key.includes("_mb_"))
    return formatMegabytes(value, formats);
  if (key.endsWith("_gb") || key.includes("_gb_"))
    return `${formats.credits(value)} GB`;
  if (key.includes("seconds"))
    return t("secondsAmount", { value: formats.credits(value) });
  if (key.includes("minutes"))
    return t("minutesAmount", { value: formats.credits(value) });
  if (key.includes("credit"))
    return t("creditsAmount", { value: formats.credits(value) });
  return formats.credits(value);
}

function formatFeatureUsageValue(
  feature: FeatureLimit,
  usage: FeatureLimitUsage | undefined,
  formats: SettingsFormats,
  t: SettingsTranslator,
) {
  if (!usage) return "-";
  if (!usage.synced) return t("syncing");
  return `${formatFeatureUsageAmount(feature, usage.used, formats)} / ${formatFeatureUsageAmount(feature, usage.total, formats)}`;
}

function formatFeatureUsageAmount(
  feature: FeatureLimit,
  value: number,
  formats: SettingsFormats,
) {
  const key = feature.key.toLowerCase();
  if (key.endsWith("_mb") || key.includes("_mb_"))
    return formatMegabytes(value, formats);
  if (key.endsWith("_gb") || key.includes("_gb_"))
    return `${formats.credits(value)} GB`;
  return formats.credits(value);
}

function formatQuotaAmount(
  quotaKey: string,
  value: number,
  formats: SettingsFormats,
  t: SettingsTranslator,
) {
  const key = quotaKey.toLowerCase();
  if (key === PLAN_INCLUDED_CREDITS_QUOTA_KEY || key.includes("credit"))
    return t("creditsAmount", { value: formats.credits(value) });
  if (
    key === "storage:monthly_io_gb" ||
    key.endsWith("_gb") ||
    key.includes("storage")
  )
    return `${formats.credits(value)} GB`;
  if (key.includes("workflow") || key.includes("runs"))
    return t("runsAmount", { value: formats.credits(value) });
  if (key.startsWith("node:") || key.startsWith("agent:"))
    return t("usesAmount", { value: formats.credits(value) });
  return formats.credits(value);
}

function formatMegabytes(value: number, formats: SettingsFormats) {
  if (value >= 1024)
    return `${formats.credits(Math.round((value / 1024) * 10) / 10)} GB`;
  return `${formats.credits(value)} MB`;
}

function formatTransactionType(type: string, t: SettingsTranslator) {
  const typeKeyByValue: Record<string, string> = {
    topup: "transactionTopUp",
    auto_topup: "transactionAutoTopUp",
    grant: "transactionGrant",
    refund: "transactionRefund",
    release: "transactionRelease",
    plan_change: "transactionPlanCredits",
    reserve: "transactionReserve",
    commit: "transactionUsage",
    overage_charge: "transactionOverageCharge",
    account_created: "transactionAccountCreated",
  };
  const translationKey = typeKeyByValue[type];
  return translationKey ? t(translationKey) : formatSystemKeyLabel(type);
}

function formatTransactionStatus(
  transaction: BillingTransaction,
  t: SettingsTranslator,
) {
  if (transaction.type === "refund") return t("statusRefunded");
  if (transaction.type === "grant") return t("statusGranted");
  if (transaction.type === "account_created") return t("statusCreated");
  if (transaction.type === "plan_change") return t("statusApplied");
  if (getTransactionDirection(transaction) === "credit") return t("statusPaid");
  return t("statusRecorded");
}

function getTransactionDirection(
  transaction: BillingTransaction,
): "credit" | "debit" | "neutral" {
  if (
    transaction.type === "topup" ||
    transaction.type === "auto_topup" ||
    transaction.type === "grant" ||
    transaction.type === "refund" ||
    transaction.type === "release" ||
    transaction.type === "plan_change"
  ) {
    return "credit";
  }
  if (
    transaction.type === "reserve" ||
    transaction.type === "commit" ||
    transaction.type === "overage_charge"
  ) {
    return "debit";
  }
  return "neutral";
}

function isInvoiceTransaction(transaction: BillingTransaction) {
  return (
    transaction.type === "topup" ||
    transaction.type === "auto_topup" ||
    transaction.type === "plan_change" ||
    transaction.type === "overage_charge"
  );
}

function getTransactionKey(transaction: BillingTransaction, index: number) {
  return [
    transaction.id,
    transaction.source_id,
    transaction.idempotency_key,
    transaction.created_at,
    index,
  ]
    .filter(Boolean)
    .join(":");
}

function getPage(value: string | null) {
  const parsed = Number(value ?? "1");
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

function SecuritySection({ tenant }: { tenant: AccountProfileTenant | null }) {
  const tAuto = useTranslations("Auto");
  const tSettings = useTranslations("Settings");
  return (
    <SettingsList>
      <SettingRow label={tAuto("login_email_5887f632")} icon={LockKeyhole}>
        <RowValue
          value={getProfileEmail(tenant, tSettings("emailUnavailable"))}
          action={
            <Badge variant="secondary">
              <UiText id="locked_a798882f" />
            </Badge>
          }
        />
      </SettingRow>
      <DangerCollapse
        title={tAuto("account_danger_zone_2177bc23")}
        description={tAuto("account_deletion_is_hidden_here_0818d009")}
        actions={[
          {
            icon: Trash2,
            title: tSettings("deleteAccount"),
            description: tSettings("deleteAccountDescription"),
            actionLabel: tSettings("deleteAccount"),
            confirmTitle: tSettings("deleteAccountConfirmTitle"),
            confirmDescription: tSettings("deleteAccountConfirmDescription"),
            confirmAction: tSettings("deleteAccountConfirmAction"),
            destructive: true,
            disabled: true,
          },
        ]}
      />
    </SettingsList>
  );
}

function DangerCollapse({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: Array<{
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    actionLabel: string;
    confirmTitle: string;
    confirmDescription: string;
    confirmAction: string;
    destructive?: boolean;
    disabled?: boolean;
    onConfirm?: () => void;
  }>;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 border-b border-border py-4 text-left transition-colors hover:bg-muted/35"
        >
          <span className="flex min-w-0 items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {title}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {description}
              </span>
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 border-b border-border py-3">
          {actions.map((action) => (
            <DangerAction key={action.title} {...action} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DangerAction({
  icon: Icon,
  title,
  description,
  actionLabel,
  confirmTitle,
  confirmDescription,
  confirmAction,
  destructive,
  disabled,
  onConfirm,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmAction: string;
  destructive?: boolean;
  disabled?: boolean;
  onConfirm?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={destructive ? "destructive" : "outline"}
            className={cn(
              "h-8 shrink-0",
              destructive && "text-destructive-foreground",
            )}
            disabled={disabled}
          >
            {actionLabel}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <UiText id="keep_workspace_16698660" />
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                destructive &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
              onClick={() => {
                if (!onConfirm) return;
                onConfirm();
              }}
            >
              {confirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowValue({
  value,
  detail,
  action,
}: {
  value: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left sm:text-right">
      <span className="min-w-0">
        <span className="block truncate text-sm text-foreground">{value}</span>
        {detail && (
          <span className="block truncate text-xs text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
      {action}
    </div>
  );
}

function SmallAction({
  children,
  href,
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  if (href) {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
      >
        <Link href={href}>
          {children}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className="h-7 px-2 text-xs"
    >
      {children}
    </Button>
  );
}

function IconButton({
  label,
  disabled = false,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="h-8 w-8"
    >
      {children}
    </Button>
  );
}

function InlineStatus({
  saved,
  error,
  message,
}: {
  saved: boolean;
  error?: string | null;
  message?: string;
}) {
  if (!saved && !error) return null;

  return (
    <div className="flex min-h-10 items-center border-b border-border py-3 text-sm">
      <span
        className={cn(
          "inline-flex items-center gap-1.5",
          error ? "text-destructive" : "text-success",
        )}
      >
        {error ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {error ?? message}
      </span>
    </div>
  );
}

function getProfileNameValidationCode(
  value: string,
): ProfileNameErrorCode | null {
  if (!value) return "required";
  if (value.length > PROFILE_NAME_MAX_LENGTH) return "tooLong";
  if (!PROFILE_NAME_PATTERN.test(value)) return "invalidCharacters";
  return null;
}

function showProfileNameError(message: string, title: string) {
  toast.error(title, { description: message });
}

function getProfileNameSaveErrorCode(
  error: unknown,
): ProfileNameErrorCode | null {
  const message = getSafeAuthMessage(error);
  const issueMessage = getFirstZodIssueMessage(message);
  const safeMessage = issueMessage ?? message;

  if (safeMessage.includes("String must contain at most")) return "tooLong";
  if (safeMessage.includes("Name must be")) return "tooLong";
  if (safeMessage.includes("Name can contain only")) return "invalidCharacters";
  if (safeMessage.includes("Name is required")) return "required";

  return null;
}

function getFirstZodIssueMessage(message: string) {
  try {
    const issues = JSON.parse(message) as Array<{ message?: unknown }>;
    const firstMessage = issues[0]?.message;
    return typeof firstMessage === "string" ? firstMessage : null;
  } catch {
    return null;
  }
}

function getSettingsSection(section: string | null): SettingsSection {
  if (
    section === "general" ||
    section === "preferences" ||
    section === "approvals" ||
    section === "notifications" ||
    section === "billing" ||
    section === "limits" ||
    section === "transactions" ||
    section === "usage" ||
    section === "security" ||
    section === "developer"
  ) {
    return section;
  }

  if (section === "profile") return "general";
  if (section === "danger") return "billing";
  return "general";
}

function getProfileDisplayName(tenant: AccountProfileTenant | null) {
  return tenant?.name?.trim() || "";
}

function getProfileEmail(
  tenant: AccountProfileTenant | null,
  fallback: string,
) {
  return tenant?.email?.trim() || fallback;
}

function getTenantProfileImageUrl(tenant: AccountProfileTenant | null) {
  return tenant?.picture_url ?? tenant?.photo_url ?? tenant?.avatar_url ?? null;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
