"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Elements,
  PaymentElement,
  loadStripe,
  useElements,
  useStripe,
  type StripeElementsOptions,
} from "@/lib/billing/mock-stripe";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  Check,
  Coins,
  CreditCard,
  Info,
  LoaderCircle,
  X,
} from "lucide-react";

import { BillingDetailsCheckoutNote } from "@/components/billing/billing-details-form";
import {
  abandonCheckout,
  completeOfferPurchase,
  getOfferPurchaseStatus,
  cancelScheduledPlanChange,
  getPlanPackages,
  getPublicPlanCatalog,
  postAssignmentPresentation,
  postOfferPageExit,
  redeemOffer,
  refreshOnboardingAssignment,
  type BillingPeriod,
  type PendingPlanChange,
  type PersonalOfferWindow,
  type PlanPackage,
  type PublicPlanCatalogItem,
  type RedeemOfferResult,
} from "@/lib/offer/api";
import { getSafeAuthMessage, isAuthClientError } from "@/lib/auth/errors";
import { readAccountPlanSyncState } from "@/components/account/browser-account-client";
import { CatalogOfferWidget } from "@/components/offer-plan/catalog-offer-widget";
import {
  isSellableCatalogPrice,
  replaceExpiredPlanPeriodsWithDefaults,
  resolveCampaignInvalidVariant,
  type CampaignInvalidVariant,
} from "@/lib/offer/catalog-expiry";
import { resolvePlanTransition } from "@/lib/offer/plan-transition";
import { registerBrowserPrincipalLifecycleResetter } from "@/lib/auth/browser-principal-storage";
import {
  BILLING_BALANCE_UPDATED_EVENT,
  getBillingQuotaUsage,
  getPaymentMethods,
  type BillingQuotaUsage,
  type PaymentMethod,
} from "@/lib/billing/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { UiText } from "@/components/i18n/ui-text";
import { useFormatter, useLocale, useTranslations } from "next-intl";

const visiblePlanOrder = ["starter", "pro", "max"] as const;
type OfferPlanFormatter = ReturnType<typeof useFormatter>;
type OfferPlanTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;
type VisiblePlan = (typeof visiblePlanOrder)[number];

const visiblePlans = new Set<string>(visiblePlanOrder);
const billingPeriods: BillingPeriod[] = ["monthly", "yearly"];
const stripePromise = loadStripe("pk_mock_yt2");
const CREDIT_SYNC_POLL_ATTEMPTS = 20;
const CREDIT_SYNC_POLL_INTERVAL_MS = 1500;
const CREDIT_SYNC_EPSILON = 0.01;
const PENDING_PURCHASE_SYNC_STORAGE_KEY =
  "youtorch:pending-offer-purchase-sync";
const PENDING_PURCHASE_SYNC_MAX_AGE_MS = 30 * 60 * 1000;
const ONBOARDING_ASSIGNMENT_REFRESH_STORAGE_KEY =
  "youtorch:onboarding-assignment-refresh";
const ONBOARDING_ASSIGNMENT_REFRESH_TTL_MS = 60 * 1000;
const OFFER_PAGE_EXIT_STORAGE_PREFIX = "youtorch:offer-page-exit:";

const planLabels: Record<VisiblePlan, string> = {
  starter: "Starter",
  pro: "Pro",
  max: "Max",
};

const fallbackDescriptions: Record<VisiblePlan, string> = {
  starter: "For solo creators starting consistent YouTube production.",
  pro: "For creators growing multiple channels with stronger output.",
  max: "For high-volume creators, teams and agency-style production.",
};

const sortOrder: Record<VisiblePlan, number> = {
  starter: 1,
  pro: 2,
  max: 3,
};

type PurchaseState =
  | { status: "idle" }
  | { status: "pending"; plan: string }
  | { status: "redeemed"; plan: string }
  | { status: "scheduled"; plan: string; scheduledFor: string }
  | {
      status: "requires_payment_confirmation";
      plan: string;
      billingPeriod: BillingPeriod;
      clientSecret: string;
      offerId?: string;
      purchaseIntentId?: string;
      amountGbp?: number;
      currency?: string;
      includedCredits?: number;
      checkoutExpiresAt?: string;
    }
  | {
      status: "syncing";
      plan: string;
      billingPeriod?: BillingPeriod;
      includedCredits?: number;
    }
  | { status: "error"; message: string; plan?: string };

type FeatureItem = {
  label: string;
  included: boolean;
  muted?: boolean;
  strong?: boolean;
  badgeText?: string;
  caption?: string;
};

type DisplaySection = NonNullable<
  NonNullable<PlanPackage["periods"][BillingPeriod]>["display_sections"][number]
>;
type DisplayPrice = NonNullable<ReturnType<typeof resolveDisplayPrice>>;
type PendingPlanTransition = {
  pkg: PlanPackage;
  price: DisplayPrice;
};

type OfferPlanContext = "standalone" | "change-plan";
type OfferPlanCompletion = {
  plan: string;
  billingPeriod?: BillingPeriod;
  includedCredits?: number;
  purchaseIntentId?: string;
};
type CurrentCreditSnapshot = {
  available: number;
  planRemaining: number;
  topUpBalance: number;
};

export function OfferPlanPage({
  billingEmail,
  context = "standalone",
  onCompleted,
}: {
  billingEmail: string;
  context?: OfferPlanContext;
  onCompleted?: (completion: OfferPlanCompletion) => Promise<void> | void;
}) {
  const tAuto = useTranslations("Auto");
  const tPlan = useTranslations("OfferPlan");
  const uiLanguage = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [packages, setPackages] = React.useState<PlanPackage[]>([]);
  const [currentPlan, setCurrentPlan] = React.useState("basic");
  const [currentBillingPeriod, setCurrentBillingPeriod] =
    React.useState<BillingPeriod | null>(null);
  const [currentPlanEndsAt, setCurrentPlanEndsAt] = React.useState<string | null>(
    null,
  );
  const [currentCredits, setCurrentCredits] =
    React.useState<CurrentCreditSnapshot>(() => emptyCreditSnapshot());
  const [billingPeriod, setBillingPeriod] =
    React.useState<BillingPeriod>("monthly");
  const [selectedPlan, setSelectedPlan] = React.useState<string>("pro");
  const [offerLoading, setOfferLoading] = React.useState(true);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  const [catalogNotice, setCatalogNotice] = React.useState<string | null>(null);
  const [campaignInvalid, setCampaignInvalid] =
    React.useState<CampaignInvalidVariant | null>(null);
  const [pendingChange, setPendingChange] = React.useState<PendingPlanChange | null>(null);
  const [purchaseState, setPurchaseState] = React.useState<PurchaseState>({
    status: "idle",
  });
  const [pendingTransition, setPendingTransition] =
    React.useState<PendingPlanTransition | null>(null);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>(
    [],
  );
  const [redeemSubmitting, setRedeemSubmitting] = React.useState(false);
  const [personalOffer, setPersonalOffer] = React.useState<PersonalOfferWindow | null>(null);
  const [viewContextId, setViewContextId] = React.useState<string | null>(null);
  const [serverNow, setServerNow] = React.useState<string | null>(null);
  const [exitPopupOpen, setExitPopupOpen] = React.useState(false);
  const [exitBusy, setExitBusy] = React.useState(false);
  const catalogSignatureRef = React.useRef<string | null>(null);
  const presentedAssignmentRef = React.useRef<string | null>(null);
  const redeemSubmittingRef = React.useRef(false);
  const userSelectedPlanRef = React.useRef(false);
  const handledStripeReturnRef = React.useRef(false);
  const principalGenerationRef = React.useRef(0);
  const purchaseOperationGenerationRef = React.useRef(0);
  const packageLoadSequenceRef = React.useRef(0);

  const isCurrentPrincipal = React.useCallback((generation: number) => {
    return principalGenerationRef.current === generation;
  }, []);

  const beginPurchaseOperation = React.useCallback(() => {
    const generation = principalGenerationRef.current;
    purchaseOperationGenerationRef.current = generation;
    return generation;
  }, []);
  const baseCatalogPackagesRef = React.useRef<PlanPackage[]>([]);
  const isChangePlanContext = context === "change-plan";
  const exitPath = React.useMemo(
    () => getSafeOfferPlanExitPath(searchParams.get("next")),
    [searchParams],
  );
  const skipOffers = React.useCallback(async () => {
    if (isChangePlanContext) {
      router.push(exitPath);
      return;
    }
    if (offerLoading || exitBusy) return;
    if (!viewContextId) {
      router.push(exitPath);
      return;
    }
    setExitBusy(true);
    try {
      const idempotencyKey = readOrCreatePageExitKey(viewContextId);
      const result = await postOfferPageExit({
        view_context_id: viewContextId,
        idempotency_key: idempotencyKey,
      });
      if (result.server_now) setServerNow(result.server_now);
      const assignment = result.assignment;
      if (assignment && !assignment.presented_at) {
        setPersonalOffer({
          assignment_id: assignment.assignment_id,
          offer_id: assignment.offer_id,
          valid_until: assignment.valid_until,
          presented_at: assignment.presented_at,
          dismissed_at: assignment.dismissed_at,
          auto_popup: true,
        });
        setExitPopupOpen(true);
        return;
      }
      router.push(exitPath);
    } catch {
      // An optional exit offer must not prevent the user from leaving the plan page.
      router.push(exitPath);
    } finally {
      setExitBusy(false);
    }
  }, [exitBusy, exitPath, isChangePlanContext, offerLoading, router, viewContextId]);

  const setPreferredSelection = React.useCallback(
    (nextPackages: PlanPackage[]) => {
      if (userSelectedPlanRef.current) return;
      setSelectedPlan(getRecommendedPlan(nextPackages));
    },
    [],
  );

  const loadPackages = React.useCallback(
    async (
      isCancelled: () => boolean,
      showOfferLoading = true,
      forcePublicRefresh = false,
    ): Promise<PlanPackage[] | null> => {
      const requestSequence = ++packageLoadSequenceRef.current;
      const isStale = () =>
        isCancelled() || requestSequence !== packageLoadSequenceRef.current;
      if (showOfferLoading) setOfferLoading(true);
      setCatalogError(null);

      const publicCatalogPromise = getPublicPlanCatalog({
        forceRefresh: forcePublicRefresh,
      })
        .then((response) => {
          const publicPackages = normalizeCatalogPackages(response.data.plans);
          if (!isStale()) {
            baseCatalogPackagesRef.current = publicPackages;
          }
          return publicPackages;
        })
        .catch(() => null);

      const tenantPackagesPromise = refreshOnboardingAssignmentIfNeeded()
        .catch(() => null)
        .then(() => getPlanPackages())
        .catch(() => null);

      const [basePackages, tenantResponse] = await Promise.all([
        publicCatalogPromise,
        tenantPackagesPromise,
      ]);
      if (isStale()) return null;

      const availableBasePackages =
        basePackages ?? baseCatalogPackagesRef.current;

      if (!tenantResponse) {
        if (availableBasePackages.length > 0) {
          const currentBasePackages = replaceExpiredPlanPeriodsWithDefaults(
            availableBasePackages,
            availableBasePackages,
            Date.now(),
          );
          setPackages(currentBasePackages);
          setPreferredSelection(currentBasePackages);
        } else {
          setPackages([]);
          setCatalogError(
            "Plan prices could not be loaded from the catalog. Please retry.",
          );
        }
        setPendingChange(null);
        setCurrentPlanEndsAt(null);
        setPersonalOffer(null);
        setViewContextId(null);
        setServerNow(null);
        setOfferLoading(false);
        return null;
      }

      const tenantPackages = normalizePackageList(tenantResponse.data.packages);
      const mergedPackages =
        availableBasePackages.length > 0
          ? mergeDisplayPackages(availableBasePackages, tenantPackages)
          : tenantPackages;
      const displayPackages = replaceExpiredPlanPeriodsWithDefaults(
        mergedPackages,
        availableBasePackages,
        Date.now(),
      );
      const nextSignature = buildCatalogSignature(displayPackages);
      if (catalogSignatureRef.current && catalogSignatureRef.current !== nextSignature) {
        setCatalogNotice("Prices updated. Current plan pricing is now shown.");
      }
      catalogSignatureRef.current = nextSignature;
      setPackages(displayPackages);
      if (displayPackages.length === 0) {
        setCatalogError(
          "Plan catalog is empty. Seed the default plan offers and retry.",
        );
      }
      const pendingPlanSync = readAccountPlanSyncState();
      setCurrentPlan(
        pendingPlanSync?.plan_type ?? tenantResponse.data.current_plan,
      );
      setCurrentBillingPeriod(
        (pendingPlanSync?.billing_period as BillingPeriod | null | undefined) ??
          tenantResponse.data.current_billing_period,
      );
      setCurrentPlanEndsAt(tenantResponse.data.current_plan_ends_at);
      setPendingChange(tenantResponse.data.pending_change);
      setPersonalOffer(tenantResponse.data.personal_offer);
      setViewContextId(tenantResponse.data.view_context_id || null);
      setServerNow(tenantResponse.data.server_now);
      setPreferredSelection(displayPackages);
      setOfferLoading(false);
      return tenantPackages;
    },
    [setPreferredSelection],
  );

  const fallBackExpiredVisiblePeriods = React.useCallback(() => {
    const now = Date.now();
    setPackages((currentPackages) =>
      replaceExpiredPlanPeriodsWithDefaults(
        currentPackages,
        baseCatalogPackagesRef.current,
        now,
      ),
    );
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void loadPackages(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [loadPackages]);

  React.useEffect(() => {
    const nextBoundary = getNearestCatalogValidityBoundary(
      packages,
      Date.now(),
    );
    if (nextBoundary === null) return;

    const timeoutId = window.setTimeout(
      () => {
        fallBackExpiredVisiblePeriods();
        void loadPackages(() => false, false, true);
      },
      Math.min(Math.max(nextBoundary - Date.now() + 100, 0), 2_147_483_647),
    );

    return () => window.clearTimeout(timeoutId);
  }, [fallBackExpiredVisiblePeriods, loadPackages, packages]);

  React.useEffect(() => {
    const refreshCatalog = () => {
      fallBackExpiredVisiblePeriods();
      void loadPackages(() => false, false, true);
    };
    const refreshVisibleCatalog = () => {
      if (document.visibilityState !== "visible") return;
      refreshCatalog();
    };
    const pollId = window.setInterval(refreshCatalog, 30_000);
    window.addEventListener("focus", refreshCatalog);
    document.addEventListener("visibilitychange", refreshVisibleCatalog);
    return () => {
      window.clearInterval(pollId);
      window.removeEventListener("focus", refreshCatalog);
      document.removeEventListener("visibilitychange", refreshVisibleCatalog);
    };
  }, [fallBackExpiredVisiblePeriods, loadPackages]);

  const markAssignmentPresentation = React.useCallback(async (
    assignmentId: string,
    event: "shown" | "dismissed",
  ) => {
    try {
      const result = await postAssignmentPresentation({ assignment_id: assignmentId, event });
      setPersonalOffer((current) => current && current.assignment_id === assignmentId
        ? {
          ...current,
          presented_at: result.presented_at,
          dismissed_at: result.dismissed_at,
          auto_popup: false,
        }
        : current);
    } catch {
      // Presentation receipt is assignment-scoped; catalog remains usable without it.
    }
  }, []);

  React.useEffect(() => {
    if (isChangePlanContext || !personalOffer?.auto_popup || !personalOffer.assignment_id) return;
    if (presentedAssignmentRef.current === personalOffer.assignment_id) return;
    presentedAssignmentRef.current = personalOffer.assignment_id;
    setExitPopupOpen(true);
    void markAssignmentPresentation(personalOffer.assignment_id, "shown");
  }, [isChangePlanContext, markAssignmentPresentation, personalOffer]);
  const refreshPaymentReadiness = React.useCallback(async (generation?: number) => {
    const expectedGeneration = generation ?? principalGenerationRef.current;
    const [methodsResult, quotaUsageResult] = await Promise.allSettled([
      getPaymentMethods(),
      getBillingQuotaUsage(),
    ]);
    if (principalGenerationRef.current !== expectedGeneration) return;

    if (methodsResult.status === "fulfilled")
      setPaymentMethods(methodsResult.value);
    if (quotaUsageResult.status === "fulfilled")
      setCurrentCredits(buildCreditSnapshot(quotaUsageResult.value));
  }, []);

  React.useEffect(() => {
    void refreshPaymentReadiness();
  }, [refreshPaymentReadiness]);

  React.useEffect(() => registerBrowserPrincipalLifecycleResetter(() => {
    principalGenerationRef.current += 1;
    const generation = principalGenerationRef.current;
    packageLoadSequenceRef.current += 1;
    handledStripeReturnRef.current = true;
    redeemSubmittingRef.current = false;
    userSelectedPlanRef.current = false;
    setPurchaseState({ status: "idle" });
    setPendingChange(null);
    setPendingTransition(null);
    setRedeemSubmitting(false);
    setCatalogError(null);
    setCatalogNotice(null);
    setOfferLoading(true);
    setPackages([]);
    setCurrentPlan("basic");
    setCurrentBillingPeriod(null);
    setCurrentPlanEndsAt(null);
    setCurrentCredits(emptyCreditSnapshot());
    setPaymentMethods([]);
    void loadPackages(() => principalGenerationRef.current !== generation);
    void refreshPaymentReadiness(generation);
  }), [loadPackages, refreshPaymentReadiness]);

  React.useEffect(() => {
    const unregister = registerBrowserPrincipalLifecycleResetter(() => {
      principalGenerationRef.current += 1;
      const generation = principalGenerationRef.current;
      packageLoadSequenceRef.current += 1;
      handledStripeReturnRef.current = true;
      redeemSubmittingRef.current = false;
      userSelectedPlanRef.current = false;
      setPurchaseState({ status: "idle" });
      setPendingChange(null);
      setPendingTransition(null);
      setRedeemSubmitting(false);
      setCatalogError(null);
      setCatalogNotice(null);
      setCampaignInvalid(null);
      setOfferLoading(true);
      setPackages([]);
      setCurrentPlan("basic");
      setCurrentBillingPeriod(null);
      setCurrentPlanEndsAt(null);
      setCurrentCredits(emptyCreditSnapshot());
      setPersonalOffer(null);
      setViewContextId(null);
      setServerNow(null);
      setExitPopupOpen(false);
      presentedAssignmentRef.current = null;
      setPaymentMethods([]);
      void loadPackages(() => principalGenerationRef.current !== generation);
      void refreshPaymentReadiness(generation);
    });
    return () => {
      unregister();
    };
  }, [loadPackages, refreshPaymentReadiness]);

  React.useEffect(() => {
    const purchaseIntentId = searchParams.get("purchase_intent_id");
    if (!purchaseIntentId || handledStripeReturnRef.current) return;
    const generation = principalGenerationRef.current;
    const returnedPurchaseIntentId = purchaseIntentId;
    const returnedCompletion = readPendingPurchaseSyncState(
      returnedPurchaseIntentId,
    ) ?? {
      plan: selectedPlan,
    };

    handledStripeReturnRef.current = true;
    setPurchaseState({ status: "pending", plan: returnedCompletion.plan });

    async function completeReturnedPayment() {
      let completedSuccessfully = false;
      const applyPurchaseState = (next: PurchaseState) => {
        if (principalGenerationRef.current !== generation) return;
        setPurchaseState(next);
      };
      try {
        const completed = await completeOfferPurchase({
          purchase_intent_id: returnedPurchaseIntentId,
        });
        if (completed.status === "completed") {
          applyPurchaseState({
            status: "redeemed",
            plan: returnedCompletion.plan,
          });
          completedSuccessfully = true;
          await refreshAfterPurchase({
            ...returnedCompletion,
            purchaseIntentId: returnedPurchaseIntentId,
          }, generation);
          return;
        }

        const purchaseStatus = await getOfferPurchaseStatus(
          returnedPurchaseIntentId,
        );
        if (purchaseStatus.status === "completed") {
          applyPurchaseState({
            status: "redeemed",
            plan: returnedCompletion.plan,
          });
          completedSuccessfully = true;
          await refreshAfterPurchase({
            ...returnedCompletion,
            purchaseIntentId: returnedPurchaseIntentId,
          }, generation);
          return;
        }

        applyPurchaseState({
          status: "error",
          plan: returnedCompletion.plan,
          message: checkoutRecoveryMessage(
            null,
            purchaseStatus.status,
            purchaseStatus.error_message ?? completed.error_message,
          ),
        });
      } catch (error) {
        applyPurchaseState({
          status: "error",
          plan: returnedCompletion.plan,
          message: checkoutRecoveryMessage(error),
        });
      } finally {
        if (completedSuccessfully) return;
        if (principalGenerationRef.current !== generation) return;
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("purchase_intent_id");
        cleanUrl.searchParams.delete("payment_intent");
        cleanUrl.searchParams.delete("payment_intent_client_secret");
        cleanUrl.searchParams.delete("redirect_status");
        router.replace(
          `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`,
        );
      }
    }

    void completeReturnedPayment();
  }, [router, searchParams, selectedPlan]);

  function selectPlan(plan: string) {
    userSelectedPlanRef.current = true;
    setSelectedPlan(plan);
  }

  async function refreshAfterPurchase(
    completion: OfferPlanCompletion,
    generation: number,
  ) {
    if (!isCurrentPrincipal(generation)) return;
    setPurchaseState({
      status: "syncing",
      plan: completion.plan,
      billingPeriod: completion.billingPeriod,
      includedCredits: completion.includedCredits,
    });
    setPendingTransition(null);

    const syncResult = await waitForPurchasedPlanSync(completion);
    if (!isCurrentPrincipal(generation)) return;
    if (syncResult.quotaUsage) {
      setCurrentCredits(buildCreditSnapshot(syncResult.quotaUsage));
    }

    await loadPackages(() => !isCurrentPrincipal(generation), false);
    if (!isCurrentPrincipal(generation)) return;
    await refreshPaymentReadiness(generation);
    if (!isCurrentPrincipal(generation)) return;
    clearPendingPurchaseSyncState(completion.purchaseIntentId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(BILLING_BALANCE_UPDATED_EVENT));
    }
    if (onCompleted) {
      await onCompleted(completion);
      return;
    }
    router.replace("/");
  }

  const defaultPaymentMethod =
    paymentMethods.find((method) => method.is_default) ??
    paymentMethods[0] ??
    null;

  async function handleRedeem(pkg: PlanPackage) {
    if (
      redeemSubmittingRef.current ||
      purchaseState.status === "pending" ||
      purchaseState.status === "requires_payment_confirmation"
    )
      return;

    const generation = beginPurchaseOperation();
    const price = resolveDisplayPrice(pkg, billingPeriod);

    selectPlan(pkg.base_plan);

    try {
      if (!price) {
        if (!isCurrentPrincipal(generation)) return;
        setPurchaseState({
          status: "error",
          plan: pkg.base_plan,
          message: tPlan("billingPeriodUnavailable"),
        });
        return;
      }

      if (currentPlan !== "basic") {
        if (!isCurrentPrincipal(generation)) return;
        setPendingTransition({ pkg, price });
        setPurchaseState({ status: "idle" });
        return;
      }

      await submitRedeem(pkg, price, "immediate", false, generation);
    } catch (error) {
      if (await recoverFromCampaignOffer(error, generation)) return;
      if (!isCurrentPrincipal(generation)) return;
      setPurchaseState({
        status: "error",
        plan: pkg.base_plan,
        message: checkoutRecoveryMessage(error),
      });
    }
  }

  async function submitRedeem(
    pkg: PlanPackage,
    price: DisplayPrice,
    activationMode: "immediate" | "period_end",
    acknowledgeImmediateReset: boolean,
    generation = beginPurchaseOperation(),
  ) {
    if (redeemSubmittingRef.current) return;
    if (!isCurrentPrincipal(generation)) return;
    let completed = false;
    redeemSubmittingRef.current = true;
    setRedeemSubmitting(true);

    setPurchaseState({ status: "pending", plan: pkg.base_plan });

    try {
      const result = await redeemOffer({
        offer_id: price.offerId,
        activation_mode: activationMode,
        acknowledge_immediate_reset: acknowledgeImmediateReset,
      });
      if (!isCurrentPrincipal(generation)) return;
      completed = await handleRedeemResult(result, pkg.base_plan, price, generation);
    } catch (error) {
      if (await recoverFromCampaignOffer(error, generation)) return;
      if (!isCurrentPrincipal(generation)) return;
      setPurchaseState({
        status: "error",
        plan: pkg.base_plan,
        message: checkoutRecoveryMessage(error),
      });
    } finally {
      if (!completed) {
        redeemSubmittingRef.current = false;
        if (isCurrentPrincipal(generation)) setRedeemSubmitting(false);
      }
    }
  }

  async function recoverFromCampaignOffer(
    error: unknown,
    generation: number,
  ): Promise<boolean> {
    if (!isCampaignOfferError(error)) return false;
    if (!isCurrentPrincipal(generation)) return true;

    setPendingTransition(null);
    setPurchaseState({ status: "idle" });
    fallBackExpiredVisiblePeriods();
    let tenantPackages = await loadPackages(
      () => !isCurrentPrincipal(generation),
      false,
      true,
    );
    if (!isCurrentPrincipal(generation)) return true;
    if (!tenantPackages) {
      try {
        const response = await getPlanPackages();
        tenantPackages = normalizePackageList(response.data.packages);
      } catch {
        tenantPackages = null;
      }
    }
    if (!isCurrentPrincipal(generation)) return true;
    setCatalogNotice(null);
    setCampaignInvalid(resolveCampaignInvalidVariant(tenantPackages));
    return true;
  }

  async function handleRedeemResult(
    result: RedeemOfferResult,
    plan: string,
    price: DisplayPrice,
    generation: number,
  ): Promise<boolean> {
    if (!isCurrentPrincipal(generation)) return false;
    const completion: OfferPlanCompletion = {
      plan,
      billingPeriod: price.billingPeriod,
      includedCredits: resolveExpectedPlanCredits(price),
      purchaseIntentId:
        "purchase_intent_id" in result ? result.purchase_intent_id : undefined,
    };

    if (result.action === "redeemed") {
      setPurchaseState({ status: "redeemed", plan });
      await refreshAfterPurchase(completion, generation);
      return true;
    }

    if (result.action === "scheduled") {
      setPurchaseState({
        status: "scheduled",
        plan,
        scheduledFor: result.scheduled_for,
      });
      setPendingTransition(null);
      await loadPackages(() => !isCurrentPrincipal(generation), false);
      return false;
    }

    const paymentAmountGbp =
      result.amount_gbp > 0 ? result.amount_gbp : price.discountedPrice;
    const paymentCurrency = result.currency || price.currency;

    if (defaultPaymentMethod) {
      setPendingTransition(null);
      setPurchaseState({ status: "pending", plan });

      const stripe = stripePromise ? await stripePromise : null;
      if (!stripe)
        throw new Error("Card payments are not configured for checkout.");

      const paymentResult = await stripe.confirmCardPayment(
        result.client_secret,
        {
          payment_method: defaultPaymentMethod.payment_method_id,
        },
      );
      if (paymentResult.error)
        throw new Error(paymentResult.error.message ?? "Payment failed.");
      if (
        !paymentResult.paymentIntent?.id ||
        paymentResult.paymentIntent.status !== "succeeded"
      ) {
        throw new Error("Payment could not be confirmed.");
      }

      if (!isCurrentPrincipal(generation)) return false;
      await completePurchaseIntent(
        result.purchase_intent_id,
        plan,
        (completedPlan) => {
          if (!isCurrentPrincipal(generation)) return;
          setPurchaseState({ status: "redeemed", plan: completedPlan });
        },
      );
      if (!isCurrentPrincipal(generation)) return false;
      await refreshAfterPurchase(completion, generation);
      return true;
    }

    if (!isCurrentPrincipal(generation)) return false;
    setPendingTransition(null);
    savePendingPurchaseSyncState(completion);
    setPurchaseState({
      status: "requires_payment_confirmation",
      plan,
      offerId: price.offerId,
      billingPeriod: price.billingPeriod,
      purchaseIntentId: result.purchase_intent_id,
      clientSecret: result.client_secret,
      amountGbp: paymentAmountGbp,
      currency: paymentCurrency,
      includedCredits: completion.includedCredits,
      checkoutExpiresAt: result.expires_at,
    });
    return false;
  }

  const selectedPackage =
    packages.find((pkg) => pkg.base_plan === selectedPlan) ??
    packages[1] ??
    packages[0];
  const syncingPurchaseState =
    purchaseState.status === "syncing" ? purchaseState : null;
  const isPurchaseSyncing = syncingPurchaseState !== null;
  const planActionLocked =
    redeemSubmitting ||
    purchaseState.status === "pending" ||
    purchaseState.status === "requires_payment_confirmation" ||
    isPurchaseSyncing;

  return (
    <main
      className={cn(
        "relative bg-[#f4f3f0] text-[#101010]",
        isChangePlanContext ? "min-h-0" : "min-h-svh",
      )}
    >
      {isPurchaseSyncing ? (
        <PlanActivationSyncScreen
          state={syncingPurchaseState}
          context={context}
        />
      ) : (
        <>
          {!isChangePlanContext && (
            <button
              type="button"
              aria-label={tAuto("close_plan_offers_cf402943")}
              className="absolute right-5 top-5 z-10 inline-flex size-9 items-center justify-center rounded-md text-[#5f5d59] transition-colors hover:bg-[#e8e6e2] hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]/30 disabled:opacity-50"
              onClick={() => void skipOffers()}
              disabled={exitBusy || offerLoading}
            >
              <X className="size-4" />
            </button>
          )}

          <section
            className={cn(
              "mx-auto flex w-full max-w-[1190px] flex-col px-5 py-8 sm:px-8 lg:px-10",
              isChangePlanContext ? "min-h-0" : "min-h-svh",
            )}
          >
            <header className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
              <div
                className={cn(
                  "inline-flex items-center gap-2 text-sm font-bold",
                  isChangePlanContext && "sr-only",
                )}
              >
                <img
                  src="/youtorch-logo.png"
                  alt=""
                  className="size-6 object-contain"
                />
                <span>
                  <UiText id="youtorch_020aa912" />
                </span>
              </div>

              <h1
                className={cn(
                  "text-balance font-semibold leading-[1.05] tracking-normal",
                  isChangePlanContext
                    ? "text-3xl sm:text-4xl"
                    : "mt-9 text-[42px] sm:text-5xl",
                )}
              >
                {isChangePlanContext
                  ? tAuto("change_your_plan_703ae446")
                  : tAuto("choose_a_pricing_plan_a2a9e7f3")}
              </h1>
              <p className="mt-5 max-w-xl text-base font-medium leading-7 text-[#343434]">
                {isChangePlanContext
                  ? tAuto(
                      "choose_a_new_plan_for_this_workspace_current_pla_282db14c",
                    )
                  : tAuto(
                      "start_with_the_plan_that_fits_your_output_today__9e15120b",
                    )}
              </p>

              <div className="mt-8 inline-grid grid-cols-2 rounded-[8px] bg-[#e8e6e2] p-1 shadow-inner shadow-black/[0.05]">
                {billingPeriods.map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setBillingPeriod(period)}
                    className={cn(
                      "h-9 rounded-[6px] px-6 text-sm font-semibold capitalize text-[#5f5d59] transition-colors",
                      billingPeriod === period &&
                        "bg-white text-[#111111] shadow-sm shadow-black/10",
                    )}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </header>

            <CatalogOfferWidget
              packages={packages}
              period={billingPeriod}
              language={uiLanguage}
              serverNow={serverNow}
              onExpired={() => {
                fallBackExpiredVisiblePeriods();
                void loadPackages(() => false, false, true);
              }}
            />

            {catalogError && (
              <div className="mx-auto mt-6 max-w-xl rounded-[8px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
                {catalogError}
              </div>
            )}

            {pendingChange && (
              <PendingPlanChangeCard
                change={pendingChange}
                onRemoved={() => {
                  setPendingChange(null);
                  void loadPackages(() => false, false);
                }}
              />
            )}

            {catalogNotice && (
              <div className="mx-auto mt-6 flex max-w-xl items-center gap-3 rounded-[8px] border border-[#d8d3ca] bg-white px-5 py-4 text-sm font-semibold text-[#38342f]">
                <Info className="size-4 shrink-0" />
                {catalogNotice}
              </div>
            )}

            <div className="mt-7 grid items-start gap-4 lg:grid-cols-3">
              {packages.length === 0 && offerLoading
                ? visiblePlanOrder.map((plan) => (
                    <PlanCardSkeleton key={plan} plan={plan} />
                  ))
                : packages.map((pkg) => (
                    <PlanCard
                      key={pkg.base_plan}
                      pkg={pkg}
                      period={billingPeriod}
                      selected={selectedPlan === pkg.base_plan}
                      currentPlan={currentPlan}
                      currentBillingPeriod={currentBillingPeriod}
                      offerLoading={offerLoading}
                      pending={
                        purchaseState.status === "pending" &&
                        purchaseState.plan === pkg.base_plan
                      }
                      actionLocked={planActionLocked}
                      error={
                        purchaseState.status === "error" &&
                        purchaseState.plan === pkg.base_plan
                          ? purchaseState.message
                          : null
                      }
                      context={context}
                      onSelect={() => selectPlan(pkg.base_plan)}
                      onRedeem={() => handleRedeem(pkg)}
                    />
                  ))}
            </div>

            <PurchaseNotice
              state={purchaseState}
              selectedPackage={selectedPackage}
            />

            {!isChangePlanContext && (
              <button
                type="button"
                className="mx-auto mt-6 text-sm font-semibold text-[#706d68] underline-offset-4 transition-colors hover:text-[#111111] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]/25 disabled:opacity-50"
                onClick={() => void skipOffers()}
                disabled={exitBusy || offerLoading}
              >
                <UiText id="skip_offers_43039ae3" />
              </button>
            )}
          </section>

          <PersonalOfferPopup
            open={exitPopupOpen}
            offer={personalOffer}
            packages={packages}
            serverNow={serverNow}
            checkoutExpiresAt={
              purchaseState.status === "requires_payment_confirmation"
                ? purchaseState.checkoutExpiresAt
                : null
            }
            tPlan={tPlan}
            onDismiss={() => {
              setExitPopupOpen(false);
              if (personalOffer?.assignment_id) {
                void markAssignmentPresentation(personalOffer.assignment_id, "dismissed");
              }
            }}
            onSelect={(plan) => {
              setExitPopupOpen(false);
              userSelectedPlanRef.current = true;
              setSelectedPlan(plan);
            }}
          />

          <CampaignInvalidPopup
            open={campaignInvalid !== null}
            variant={campaignInvalid}
            tPlan={tPlan}
            onDismiss={() => {
              window.location.reload();
            }}
          />

          <PaymentSetupDialog
            state={purchaseState}
            billingEmail={billingEmail}
            savedPaymentMethod={defaultPaymentMethod}
            onBack={() => {
              if (!isCurrentPrincipal(purchaseOperationGenerationRef.current)) return;
              const openCheckout = purchaseState;
              setPurchaseState({ status: "idle" });
              if (
                openCheckout.status === "requires_payment_confirmation"
                && openCheckout.purchaseIntentId
              ) {
                void abandonCheckout({ purchase_intent_id: openCheckout.purchaseIntentId })
                  .then(() => loadPackages(() => false, false))
                  .catch(() => {
                    void loadPackages(() => false, false);
                  });
              }
            }}
            onError={(message) => {
              if (!isCurrentPrincipal(purchaseOperationGenerationRef.current)) return;
              setPurchaseState({ status: "error", plan: selectedPlan, message });
            }}
            onCompleted={(completion) => {
              const generation = purchaseOperationGenerationRef.current;
              if (!isCurrentPrincipal(generation)) return;
              setPurchaseState({ status: "redeemed", plan: completion.plan });
              void refreshAfterPurchase(completion, generation);
            }}
          />

          <PlanChangeConfirmationDialog
            transition={pendingTransition}
            currentPlan={currentPlan}
            currentBillingPeriod={currentBillingPeriod}
            currentPlanEndsAt={currentPlanEndsAt}
            currentCredits={currentCredits}
            packages={packages}
            submitting={redeemSubmitting}
            onClose={() => setPendingTransition(null)}
            onConfirm={() => {
              if (!pendingTransition) return;
              const decision = resolveCatalogPlanTransition(
                currentPlan,
                currentBillingPeriod,
                pendingTransition.pkg,
                pendingTransition.price,
                packages,
              );
              const activationMode =
                decision.activationMode === "period_end"
                  ? "period_end"
                  : "immediate";
              void submitRedeem(
                pendingTransition.pkg,
                pendingTransition.price,
                activationMode,
                activationMode === "immediate",
                beginPurchaseOperation(),
              );
            }}
          />
        </>
      )}
    </main>
  );
}

function PlanActivationSyncScreen({
  state,
  context,
}: {
  state: Extract<PurchaseState, { status: "syncing" }>;
  context: OfferPlanContext;
}) {
  const planName =
    planLabels[state.plan as VisiblePlan] ?? formatPlanLabel(state.plan);
  const minHeightClass =
    context === "change-plan" ? "min-h-[460px]" : "min-h-svh";

  return (
    <section
      className={cn(
        "mx-auto flex w-full max-w-[720px] flex-col items-center justify-center px-6 py-14 text-center sm:px-8",
        minHeightClass,
      )}
    >
      <div className="flex size-20 items-center justify-center rounded-full border border-[#dedad2] bg-white shadow-sm shadow-black/[0.04]">
        <LoaderCircle className="size-9 animate-spin text-[#111111]" />
      </div>
      <p className="mt-7 text-sm font-bold uppercase tracking-normal text-[#6a655e]">
        <UiText id="payment_confirmed_43a3f3cb" />
      </p>
      <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-normal text-[#111111] sm:text-4xl">
        <UiText id="activating_d91d2edc" /> {planName}
      </h1>
      <p className="mt-4 max-w-md text-base font-medium leading-7 text-[#4f4941]">
        <UiText id="we_are_syncing_your_plan_credits_now_this_usuall_d6c37afa" />
      </p>
      <div className="mt-8 h-2 w-full max-w-[280px] overflow-hidden rounded-full bg-[#e8e6e2]">
        <Skeleton className="h-full w-1/2 rounded-full bg-primary" />
      </div>
    </section>
  );
}

function PlanCard({
  pkg,
  period,
  selected,
  currentPlan,
  currentBillingPeriod,
  offerLoading,
  pending,
  actionLocked,
  error,
  context,
  onSelect,
  onRedeem,
}: {
  pkg: PlanPackage;
  period: BillingPeriod;
  selected: boolean;
  currentPlan: string;
  currentBillingPeriod: BillingPeriod | null;
  offerLoading: boolean;
  pending: boolean;
  actionLocked: boolean;
  error: string | null;
  context: OfferPlanContext;
  onSelect: () => void;
  onRedeem: () => void;
}) {
  const format = useFormatter();
  const tAuto = useTranslations("Auto");
  const tPlan = useTranslations("OfferPlan");
  const price = resolveDisplayPrice(pkg, period);
  const plan = toVisiblePlan(pkg.base_plan);
  const isCurrent =
    currentPlan === pkg.base_plan &&
    currentBillingPeriod === price?.billingPeriod;
  const hasCheckoutId = Boolean(price?.offerId);
  const planBadgeText =
    price?.badgeText ?? (plan ? getPlanBadgeText(plan) : null);
  const features = price ? getFeatureItems(price) : [];
  const sections = price?.display_sections ?? [];
  const disabled =
    actionLocked ||
    pending ||
    isCurrent ||
    !price ||
    (offerLoading && !hasCheckoutId);
  const monthlyEquivalent = price
    ? getMonthlyEquivalent(price.discountedPrice, price.billingPeriod)
    : 0;
  const ctaLabel = context === "change-plan" ? "Change plan" : "Get Started";

  if (offerLoading) {
    return <PlanCardSkeleton plan={plan} />;
  }

  return (
    <article
      className={cn(
        "relative grid grid-rows-[220px_auto] overflow-hidden rounded-[8px] border bg-[#fffdf9] text-[#111111] shadow-[0_18px_44px_rgba(20,18,16,0.06)] transition-all",
        getPlanCardBorderClass(plan, selected),
        selected && "shadow-[0_20px_58px_rgba(20,18,16,0.11)]",
      )}
      onMouseEnter={onSelect}
      onFocus={onSelect}
    >
      <div
        className={cn(
          "flex h-[220px] flex-col px-5 pb-4 pt-5 sm:px-6",
          pkg.base_plan === "starter" && "bg-[#e6e4df]",
        )}
        style={getPlanTopStyle(plan)}
      >
        <div className="flex min-h-8 flex-wrap items-start gap-2">
          <h2 className="min-w-0 text-[21px] font-semibold leading-tight tracking-normal">
            {plan ? planLabels[plan] : pkg.name}
          </h2>
          {price?.showSavings ? (
            <DiscountBadge
              label={
                price.savingsLabel ??
                `Save ${Math.round(price.discountPercent)}%`
              }
            />
          ) : (
            plan &&
            planBadgeText && <PlanBadge text={planBadgeText} plan={plan} />
          )}
        </div>

        <div className="mt-auto">
          <div className="mb-3 min-h-5">
            {price?.showSavings && (
              <span className="text-sm font-semibold leading-none text-[#d04437] line-through">
                {formatMoney(price.originalPrice, price.currency, format)}
              </span>
            )}
          </div>
          <div className="flex items-end gap-2">
            <p className="text-[31px] font-semibold leading-none tracking-normal sm:text-[33px]">
              {price
                ? formatMoney(price.discountedPrice, price.currency, format)
                : "—"}
            </p>
            <p className="pb-1 text-sm font-medium text-[#77736c]">
              / {periodLabel(price?.billingPeriod ?? period, tPlan)}
            </p>
          </div>
          {price ? (
            <>
              <PriceDetail
                billingPeriod={price.billingPeriod}
                discountedPrice={price.discountedPrice}
                currency={price.currency}
                hasDiscount={price.hasDiscount}
                priceCaption={price.priceCaption}
                monthlyEquivalent={monthlyEquivalent}
              />
              {price.renewalNote && (
                <p className="mt-1 min-h-4 text-[11px] font-semibold leading-4 text-[#5f5a52]">
                  {price.renewalNote}
                </p>
              )}
              <CreditBadge
                credits={price.includedCredits}
                billingPeriod={price.billingPeriod}
              />
            </>
          ) : (
            <p className="mt-3 text-sm font-semibold text-[#77736c]">
              <UiText id="unavailable_2c9c1f79" />
            </p>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col border-t border-[#e2ded7] bg-[#fffdf9] px-5 pb-5 pt-5 sm:px-6">
        <p className="line-clamp-2 min-h-[44px] text-[13px] font-medium leading-[22px] text-[#615e59]">
          {pkg.description}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={onRedeem}
          className={cn(
            "mt-4 h-10 w-full rounded-full border px-5 text-sm font-semibold transition-[border-color,box-shadow,filter] disabled:pointer-events-none disabled:opacity-60",
            getPlanButtonClass(plan),
          )}
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" />
              <UiText id="processing_e63451d3" />
            </span>
          ) : isCurrent ? (
            tAuto("current_plan_ec5cfba8")
          ) : !price ? (
            tAuto("unavailable_2c9c1f79")
          ) : offerLoading && !hasCheckoutId ? (
            tAuto("preparing_96a9b7cd")
          ) : (
            ctaLabel
          )}
        </button>

        {error && (
          <p className="mt-3 min-h-5 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="mt-5">
          <p className="text-sm font-semibold">
            <UiText id="included_3e2c5704" />
          </p>
          <ul className="mt-4 space-y-2">
            {features.map((item) => (
              <li
                key={`${item.included ? "yes" : "no"}-${item.label}`}
                className={cn(
                  "flex min-h-6 items-start gap-3 text-[13px] font-medium leading-[22px]",
                  item.included ? "text-[#23211e]" : "text-[#aaa59d]",
                  item.muted && "text-[#8d8981]",
                  item.strong && "font-semibold text-[#111111]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    item.included
                      ? "border-[#111111] bg-[#111111] text-white"
                      : "border-[#d7d2ca] bg-[#f2f0eb] text-[#9d978f]",
                  )}
                >
                  {item.included ? (
                    <Check className="size-3.5" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="inline-flex max-w-full flex-wrap items-center gap-2">
                    <span>{renderHighlightedFeatureLabel(item.label)}</span>
                    {item.badgeText && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold leading-none",
                          getInlineBadgeClass(item),
                        )}
                      >
                        {item.badgeText}
                      </span>
                    )}
                  </span>
                  {item.caption && (
                    <span className="mt-0.5 block text-xs font-medium text-[#77736c]">
                      {item.caption}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {sections.length > 0 && (
          <div className="mt-5 space-y-3">
            {sections.map((section) => (
              <DisplaySectionBox key={section.id} section={section} />
            ))}
          </div>
        )}

        <div className="mt-auto pt-5">
          <div className="flex gap-3 rounded-[8px] border border-[#e5e1da] bg-[#faf9f6] px-3.5 py-2.5 text-xs font-medium leading-5 text-[#66615a]">
            <Info className="mt-0.5 size-4 shrink-0 text-[#111111]" />
            <p>
              {plan
                ? getInfoText(plan)
                : tAuto(
                    "plan_limits_apply_immediately_after_checkout_64f72f76",
                  )}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function PlanCardSkeleton({ plan }: { plan: VisiblePlan | null }) {
  return (
    <article
      className={cn(
        "relative grid min-h-[580px] grid-rows-[220px_auto] overflow-hidden rounded-[8px] border bg-[#fffdf9] text-[#111111] shadow-[0_18px_44px_rgba(20,18,16,0.06)]",
        getPlanCardBorderClass(plan, false),
      )}
    >
      <div
        className={cn(
          "flex h-[220px] flex-col px-5 pb-4 pt-5 sm:px-6",
          plan === "starter" && "bg-[#e6e4df]",
        )}
        style={getPlanTopStyle(plan)}
      >
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-7 w-28 rounded-full" />
        <div className="mt-auto">
          <div className="flex items-end gap-3">
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="mb-1 h-4 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-4 w-44 rounded-full" />
          <Skeleton className="mt-3 h-8 w-40 rounded-full" />
        </div>
      </div>
      <div className="flex min-h-0 flex-col border-t border-[#e2ded7] bg-[#fffdf9] px-5 pb-5 pt-5 sm:px-6">
        <div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-4/5 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-10 w-full rounded-full" />
          <Skeleton className="mt-5 h-4 w-20 rounded-full" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-5 shrink-0 rounded-full" />
                <Skeleton className="h-4 flex-1 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto pt-5">
          <Skeleton className="h-[60px] rounded-lg" />
        </div>
      </div>
    </article>
  );
}

function PlanBadge({ text, plan }: { text: string; plan: VisiblePlan }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-full px-3 text-[11px] font-semibold leading-none",
        plan === "pro" && "bg-[#111111] text-white",
        plan === "max" && "bg-[#eef4ff] text-[#315bdc]",
        plan === "starter" && "bg-white/70 text-[#5f5b55]",
      )}
    >
      {text}
    </span>
  );
}

function DiscountBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#caff37] px-3 text-[11px] font-semibold leading-none text-[#143000] shadow-[inset_0_0_0_1px_rgba(20,48,0,0.08)]">
      {label}
    </span>
  );
}

function PriceDetail({
  billingPeriod,
  discountedPrice,
  currency,
  hasDiscount,
  priceCaption,
  monthlyEquivalent,
}: {
  billingPeriod: BillingPeriod;
  discountedPrice: number;
  currency: string;
  hasDiscount: boolean;
  priceCaption?: string | null;
  monthlyEquivalent: number;
}) {
  const tPlan = useTranslations("OfferPlan");
  const format = useFormatter();
  const tAuto = useTranslations("Auto");
  if (priceCaption) {
    return (
      <p className="mt-2 min-h-5 text-[11px] font-semibold leading-4 text-[#79756f]">
        {priceCaption}
      </p>
    );
  }

  if (billingPeriod === "yearly") {
    return (
      <p className="mt-2 min-h-5 text-[11px] font-semibold leading-4 text-[#79756f]">
        {tPlan("monthEquivalent", {
          price: formatMoney(monthlyEquivalent, currency, format),
        })}
      </p>
    );
  }

  return (
    <p className="mt-2 min-h-5 text-[11px] font-semibold leading-4 text-[#79756f]">
      {hasDiscount
        ? tAuto("offer_price_per_month_f2d37a00")
        : tAuto("monthly_generation_balance_87d5cd2b")}
    </p>
  );
}

function CreditBadge({
  credits,
  billingPeriod,
}: {
  credits: number;
  billingPeriod: BillingPeriod;
}) {
  const tPlan = useTranslations("OfferPlan");
  const format = useFormatter();
  return (
    <div className="mt-3 inline-flex h-9 max-w-full items-center gap-2.5 rounded-full border border-[#ded9d0] bg-white/85 px-3.5 text-[13px] font-semibold leading-none text-[#403b35] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f7f5ef] text-[#111111]">
        <Coins className="size-4" strokeWidth={2.2} />
      </span>
      <span className="truncate tabular-nums">
        {formatCredits(credits, format)} <UiText id="credits_b88a70df" />{" "}
        {periodLabel(billingPeriod, tPlan).toLowerCase()}
      </span>
    </div>
  );
}

function DisplaySectionBox({ section }: { section: DisplaySection }) {
  return (
    <div className="rounded-[8px] border border-[#e5e1da] bg-[#faf9f6] px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-5 text-[#191815]">
            {section.title}
          </p>
          {section.caption && (
            <p className="mt-0.5 text-xs font-medium leading-5 text-[#77736c]">
              {section.caption}
            </p>
          )}
        </div>
        {section.badge_text && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold leading-none",
              getSectionBadgeClass(section.emphasis),
            )}
          >
            {section.badge_text}
          </span>
        )}
      </div>
      <ul className="mt-3 divide-y divide-[#ebe7df]">
        {section.items.map((item) => (
          <li
            key={`${section.id}-${item.key ?? item.label}`}
            className="flex min-h-9 items-center gap-2 py-2 text-[12px] font-semibold text-[#23211e]"
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center",
                item.included ? "text-[#111111]" : "text-[#aaa59d]",
              )}
            >
              {item.included ? (
                <Check className="size-3.5" />
              ) : (
                <X className="size-3.5" />
              )}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1",
                !item.included && "text-[#aaa59d]",
              )}
            >
              {item.label}
            </span>
            {item.badge_text && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold leading-none",
                  getSectionItemBadgeClass(item.emphasis),
                )}
              >
                {item.badge_text}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PendingPlanChangeCard({
  change,
  onRemoved,
}: {
  change: PendingPlanChange;
  onRemoved: () => void;
}) {
  const format = useFormatter();
  const tSettings = useTranslations("Settings");
  const [removing, setRemoving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function removeChange() {
    if (!change.can_cancel || removing) return;
    setRemoving(true);
    setError(null);
    try {
      await cancelScheduledPlanChange({ purchase_intent_id: change.purchase_intent_id });
      onRemoved();
    } catch (err) {
      setError(getSafeAuthMessage(err));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-[8px] border border-[#d8d1f5] bg-white px-5 py-4 text-sm text-[#2e285f]">
      <p className="font-semibold">{tSettings("pendingPlanChangeTitle")}</p>
      <p className="mt-2 font-medium">
        {tSettings("pendingPlanChangeDescription", {
          plan: change.target_plan,
          period: change.target_billing_period,
          date: formatDate(change.scheduled_for, format),
          price: formatMoney(change.charge_amount, change.currency, format),
        })}
      </p>
      {change.can_cancel && (
        <button
          type="button"
          className="mt-3 text-sm font-semibold underline-offset-4 hover:underline"
          disabled={removing}
          onClick={() => void removeChange()}
        >
          {removing ? tSettings("scheduling") : tSettings("removePendingPlanChange")}
        </button>
      )}
      {error && <p className="mt-2 text-red-700">{error}</p>}
    </div>
  );
}

function PurchaseNotice({
  state,
  selectedPackage,
}: {
  state: PurchaseState;
  selectedPackage?: PlanPackage;
}) {
  const format = useFormatter();
  const tAuto = useTranslations("Auto");
  if (
    state.status === "idle" ||
    state.status === "pending" ||
    state.status === "requires_payment_confirmation" ||
    state.status === "syncing"
  )
    return null;

  if (state.status === "redeemed") {
    return (
      <div className="mx-auto mt-6 flex max-w-xl items-center gap-3 rounded-[8px] border border-[#b7e928] bg-[#ecffd0] px-4 py-3 text-sm font-semibold text-[#243000]">
        <Check className="size-5" />
        {planLabels[state.plan as VisiblePlan] ??
          selectedPackage?.name ??
          tAuto("plan_ae2f98a0")}{" "}
        activated.
      </div>
    );
  }

  if (state.status === "scheduled") {
    return (
      <div className="mx-auto mt-6 flex max-w-xl items-center gap-3 rounded-[8px] border border-[#d8d1f5] bg-white px-4 py-3 text-sm font-semibold text-[#2e285f]">
        <CalendarClock className="size-5" />
        {planLabels[state.plan as VisiblePlan] ??
          selectedPackage?.name ??
          tAuto("plan_ae2f98a0")}{" "}
        <UiText id="will_start_on_5a67146b" />{" "}
        {formatDate(state.scheduledFor, format)}.
      </div>
    );
  }

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-[8px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
      {state.message}
    </div>
  );
}

function catalogPlanOrder(plan: string, packages: PlanPackage[]): number {
  if (plan.trim().toLowerCase() === "basic") return 0;
  const fromCatalog = packages.find((pkg) => pkg.base_plan === plan)?.sort_order;
  if (typeof fromCatalog === "number") return fromCatalog;
  return sortOrder[plan as VisiblePlan] ?? 0;
}

function resolveCatalogPlanTransition(
  currentPlan: string,
  currentBillingPeriod: BillingPeriod | null,
  pkg: PlanPackage,
  price: DisplayPrice,
  packages: PlanPackage[],
) {
  return resolvePlanTransition({
    currentPlan,
    currentPeriod: currentBillingPeriod,
    currentPlanOrder: catalogPlanOrder(currentPlan, packages),
    targetPlan: pkg.base_plan,
    targetPeriod: price.billingPeriod,
    targetPlanOrder: catalogPlanOrder(pkg.base_plan, packages),
  });
}

function PlanChangeConfirmationDialog({
  transition,
  currentPlan,
  currentBillingPeriod,
  currentPlanEndsAt,
  currentCredits,
  packages,
  submitting,
  onClose,
  onConfirm,
}: {
  transition: PendingPlanTransition | null;
  currentPlan: string;
  currentBillingPeriod: BillingPeriod | null;
  currentPlanEndsAt: string | null;
  currentCredits: CurrentCreditSnapshot;
  packages: PlanPackage[];
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const tPlan = useTranslations("OfferPlan");
  const format = useFormatter();
  const tAuto = useTranslations("Auto");
  if (!transition) return null;

  const decision = resolveCatalogPlanTransition(
    currentPlan,
    currentBillingPeriod,
    transition.pkg,
    transition.price,
    packages,
  );
  const isPeriodEnd = decision.activationMode === "period_end";
  const targetPlan = transition.pkg.base_plan;
  const newPlanName =
    planLabels[targetPlan as VisiblePlan] ?? transition.pkg.name;
  const currentPlanName =
    planLabels[currentPlan as VisiblePlan] ?? formatPlanLabel(currentPlan);
  const periodText = periodLabel(
    transition.price.billingPeriod,
    tPlan,
  ).toLowerCase();
  const chargeAmount = formatMoney(
    transition.price.discountedPrice,
    transition.price.currency,
    format,
  );
  const effectiveDate = currentPlanEndsAt
    ? formatDate(currentPlanEndsAt, format)
    : null;
  const newPlanCredits = resolveExpectedPlanCredits(transition.price);
  const totalCreditsAfterChange = sumCredits(
    currentCredits.available,
    newPlanCredits,
  );
  const planCreditsToCarry = formatCredits(
    currentCredits.planRemaining,
    format,
  );
  const hasTopUpBalance = currentCredits.topUpBalance > 0;
  const topUpBalance = formatCredits(currentCredits.topUpBalance, format);

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[8px] bg-white p-6 text-[#111111] shadow-2xl shadow-black/25 sm:p-7"
          onEscapeKeyDown={(event) => {
            if (submitting) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (submitting) event.preventDefault();
          }}
        >
          <div className={cn(submitting && "pointer-events-none blur-[1.5px]")}>
            <Dialog.Title className="text-2xl font-semibold tracking-normal">
              <UiText id="change_to_b9b6aac4" /> {newPlanName}
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm font-medium leading-6 text-[#625d56]">
              {isPeriodEnd
                ? tPlan("confirmationDescriptionPeriodEnd", {
                    price: chargeAmount,
                    plan: newPlanName,
                    date: effectiveDate ?? tPlan("currentPaidPeriodEnd"),
                  })
                : tPlan("confirmationDescription", {
                    price: chargeAmount,
                    credits: formatCredits(newPlanCredits, format),
                    plan: newPlanName,
                  })}
            </Dialog.Description>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[8px] border border-[#111111] bg-[#111111] px-4 py-3 text-white">
                <p className="text-xs font-semibold uppercase tracking-normal text-white/65">
                  {isPeriodEnd ? (
                    tPlan("chargeOnDate")
                  ) : (
                    <UiText id="today_charge_50801e14" />
                  )}
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-normal">
                  {isPeriodEnd ? tPlan("noChargeToday") : chargeAmount}
                </p>
              </div>
              <div className="rounded-[8px] border border-[#d7f24b] bg-[#f1ffd1] px-4 py-3 text-[#1c2600]">
                <p className="text-xs font-semibold uppercase tracking-normal text-[#556600]">
                  {isPeriodEnd ? (
                    tPlan("chargeOnDate")
                  ) : (
                    <UiText id="credits_after_change_26f1f404" />
                  )}
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-normal">
                  {isPeriodEnd
                    ? chargeAmount
                    : formatCredits(totalCreditsAfterChange, format)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-[8px] border border-[#e7e0d6] bg-[#fbfaf7] p-4 text-sm">
              <ConfirmationRow
                label={tAuto("current_plan_ec5cfba8")}
                value={currentPlanName}
              />
              <ConfirmationRow
                label={tAuto("new_plan_06a18c99")}
                value={`${newPlanName}, ${periodText}`}
              />
              <ConfirmationRow
                label={tAuto("available_credits_18001da8")}
                value={tPlan("credits", {
                  count: formatCredits(currentCredits.available, format),
                })}
              />
              {isPeriodEnd ? (
                <ConfirmationRow
                  label={tPlan("appliesOn")}
                  value={effectiveDate ?? tPlan("currentPaidPeriodEnd")}
                />
              ) : (
                <ConfirmationRow
                  label={tAuto("new_plan_credits_added_bc29908f")}
                  value={tPlan("credits", {
                    count: formatCredits(newPlanCredits, format),
                  })}
                />
              )}
              {isPeriodEnd ? null : (
                <ConfirmationRow
                  label={tAuto("plan_credits_carried_9572e72d")}
                  value={tPlan("credits", { count: planCreditsToCarry })}
                />
              )}
              {hasTopUpBalance ? (
                <ConfirmationRow
                  label={tAuto("top_up_balance_4d191b75")}
                  value={tPlan("credits", { count: topUpBalance })}
                />
              ) : null}
              {isPeriodEnd ? null : (
                <ConfirmationRow
                  label={tAuto("total_after_change_26607384")}
                  value={tPlan("credits", {
                    count: formatCredits(totalCreditsAfterChange, format),
                  })}
                />
              )}
              <ConfirmationRow
                label={tAuto("limits_61a0ae3b")}
                value={
                  isPeriodEnd
                    ? tPlan("limitsApplyOnDate", {
                        plan: newPlanName,
                        date: effectiveDate ?? tPlan("currentPaidPeriodEnd"),
                      })
                    : tPlan("limitsApplyNow", { plan: newPlanName })
                }
              />
            </div>

            <BillingDetailsCheckoutNote appearance="plan" className="mt-4" />

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="h-10 rounded-full border border-[#dedad2] bg-white px-5 text-sm font-semibold text-[#111111] transition-colors hover:border-[#111111] disabled:pointer-events-none disabled:opacity-60"
              >
                <UiText id="back_b52b36b7" />
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onConfirm}
                className="h-10 rounded-full bg-[#111111] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#262626] disabled:pointer-events-none disabled:opacity-60"
              >
                <UiText id="confirm_change_6429151c" />
              </button>
            </div>
          </div>

          {submitting ? <ProcessingOverlay /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ProcessingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-sm">
      <div className="grid min-w-[220px] justify-items-center gap-3 rounded-[8px] border border-[#dedad2] bg-white px-6 py-5 text-center shadow-xl">
        <LoaderCircle className="size-6 animate-spin text-[#111111]" />
        <div>
          <p className="text-sm font-semibold text-[#111111]">
            <UiText id="processing_plan_change_308651ab" />
          </p>
          <p className="mt-1 text-xs font-medium text-[#625d56]">
            <UiText id="please_wait_while_we_apply_your_package_b9b11af5" />
          </p>
        </div>
      </div>
    </div>
  );
}

function ConfirmationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#ebe5dc] pb-2 last:border-b-0 last:pb-0">
      <span className="font-medium text-[#756f66]">{label}</span>
      <span className="text-right font-semibold text-[#111111]">{value}</span>
    </div>
  );
}

function PaymentSetupDialog({
  state,
  billingEmail,
  savedPaymentMethod,
  onBack,
  onCompleted,
  onError,
}: {
  state: PurchaseState;
  billingEmail: string;
  savedPaymentMethod: PaymentMethod | null;
  onBack: () => void;
  onCompleted: (completion: OfferPlanCompletion) => void;
  onError: (message: string) => void;
}) {
  const format = useFormatter();
  if (state.status !== "requires_payment_confirmation") return null;

  const paymentAmount = formatMoney(
    state.amountGbp ?? 0,
    state.currency ?? "GBP",
    format,
  );
  const options: StripeElementsOptions = {
    clientSecret: state.clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        borderRadius: "8px",
        colorPrimary: "#111111",
        colorText: "#111111",
        colorBackground: "#ffffff",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
    },
  };

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-[8px] bg-white p-6 text-[#111111] shadow-2xl shadow-black/25 sm:p-7"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <Dialog.Title className="flex items-center gap-3 text-2xl font-semibold tracking-normal">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#caff37]">
              <CreditCard className="size-5" />
            </span>
            <UiText id="activate_92ef0832" />{" "}
            {planLabels[state.plan as VisiblePlan] ?? "plan"}
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-sm font-medium leading-6 text-[#66615a]">
            {savedPaymentMethod
              ? `Pay ${paymentAmount} with ${formatCardBrand(savedPaymentMethod.brand)} ${savedPaymentMethod.last4 ? `ending ${savedPaymentMethod.last4}` : "card"}.`
              : `Enter your card details to pay ${paymentAmount}.`}
          </Dialog.Description>
          {state.checkoutExpiresAt ? (
            <p className="mt-2 text-xs font-medium leading-5 text-[#756f66]">
              Checkout price is locked until{" "}
              {format.dateTime(new Date(state.checkoutExpiresAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              . This 30-minute payment lock is separate from any campaign valid-until date.
            </p>
          ) : null}

          <BillingDetailsCheckoutNote appearance="plan" className="mt-4" />

          {stripePromise ? (
            <Elements
              stripe={stripePromise}
              options={options}
              key={state.clientSecret}
            >
              {savedPaymentMethod ? (
                <SavedPaymentConfirmationForm
                  state={state}
                  savedPaymentMethod={savedPaymentMethod}
                  onBack={onBack}
                  onCompleted={(plan) =>
                    onCompleted({
                      plan,
                      billingPeriod: state.billingPeriod,
                      includedCredits: state.includedCredits,
                      purchaseIntentId: state.purchaseIntentId,
                    })
                  }
                  onError={onError}
                />
              ) : (
                <PaymentSetupForm
                  state={state}
                  billingEmail={billingEmail}
                  onBack={onBack}
                  onCompleted={(plan) =>
                    onCompleted({
                      plan,
                      billingPeriod: state.billingPeriod,
                      includedCredits: state.includedCredits,
                      purchaseIntentId: state.purchaseIntentId,
                    })
                  }
                  onError={onError}
                />
              )}
            </Elements>
          ) : (
            <div className="mt-6 grid gap-4">
              <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                <UiText id="card_payments_are_not_configured_for_checkout_435c80c5" />
              </div>
              <button
                type="button"
                onClick={onBack}
                className="h-10 rounded-full border border-[#dedad2] bg-white px-5 text-sm font-semibold text-[#111111] transition-colors hover:border-[#111111]"
              >
                <UiText id="back_to_plans_20121191" />
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SavedPaymentConfirmationForm({
  state,
  savedPaymentMethod,
  onBack,
  onCompleted,
  onError,
}: {
  state: Extract<PurchaseState, { status: "requires_payment_confirmation" }>;
  savedPaymentMethod: PaymentMethod;
  onBack: () => void;
  onCompleted: (plan: string) => void;
  onError: (message: string) => void;
}) {
  const format = useFormatter();
  const tAuto = useTranslations("Auto");
  const stripe = useStripe();
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const submittingRef = React.useRef(false);

  async function handleConfirm() {
    if (!stripe) return;
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setMessage(null);

    try {
      if (!state.purchaseIntentId)
        throw new Error("Purchase intent is missing.");

      const paymentResult = await stripe.confirmCardPayment(
        state.clientSecret,
        {
          payment_method: savedPaymentMethod.payment_method_id,
        },
      );
      if (paymentResult.error)
        throw new Error(paymentResult.error.message ?? "Payment failed.");
      if (
        !paymentResult.paymentIntent?.id ||
        paymentResult.paymentIntent.status !== "succeeded"
      ) {
        throw new Error("Payment could not be confirmed.");
      }

      await completePurchaseIntent(
        state.purchaseIntentId,
        state.plan,
        onCompleted,
      );
    } catch (error) {
      const safeMessage = checkoutRecoveryMessage(error);
      setMessage(safeMessage);
      onError(safeMessage);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4">
      <div className="rounded-[8px] border border-[#e7e0d6] bg-[#fbfaf7] px-4 py-3 text-sm font-semibold text-[#4f4941]">
        <UiText id="today_charge_9d011100" />{" "}
        {formatMoney(state.amountGbp ?? 0, state.currency ?? "GBP", format)}
      </div>
      {message && (
        <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {message}
        </div>
      )}
      <button
        type="button"
        disabled={!stripe || submitting}
        onClick={handleConfirm}
        className="h-11 rounded-full bg-[#caff37] px-5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#bfff19] disabled:pointer-events-none disabled:opacity-60"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" />
            <UiText id="confirming_ae0eee35" />
          </span>
        ) : (
          tAuto("confirm_payment_5febc18b")
        )}
      </button>
      <button
        type="button"
        disabled={submitting}
        onClick={onBack}
        className="h-10 rounded-full border border-[#dedad2] bg-white px-5 text-sm font-semibold text-[#111111] transition-colors hover:border-[#111111] disabled:pointer-events-none disabled:opacity-60"
      >
        <UiText id="back_to_plans_20121191" />
      </button>
    </div>
  );
}

function PaymentSetupForm({
  state,
  billingEmail,
  onBack,
  onCompleted,
  onError,
}: {
  state: Extract<PurchaseState, { status: "requires_payment_confirmation" }>;
  billingEmail: string;
  onBack: () => void;
  onCompleted: (plan: string) => void;
  onError: (message: string) => void;
}) {
  const tAuto = useTranslations("Auto");
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const submittingRef = React.useRef(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setMessage(null);

    try {
      if (!state.purchaseIntentId) {
        throw new Error("Purchase intent is missing.");
      }

      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set("purchase_intent_id", state.purchaseIntentId);
      const trimmedBillingEmail = billingEmail.trim();

      const paymentResult = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl.toString(),
          ...(trimmedBillingEmail
            ? {
                payment_method_data: {
                  billing_details: { email: trimmedBillingEmail },
                },
              }
            : {}),
        },
        redirect: "if_required",
      });

      if (paymentResult.error) {
        throw new Error(paymentResult.error.message ?? "Payment failed.");
      }

      if (
        !paymentResult.paymentIntent?.id ||
        paymentResult.paymentIntent.status !== "succeeded"
      ) {
        throw new Error("Payment could not be confirmed.");
      }

      await completePurchaseIntent(
        state.purchaseIntentId,
        state.plan,
        onCompleted,
      );
    } catch (error) {
      const safeMessage = checkoutRecoveryMessage(error);
      setMessage(safeMessage);
      onError(safeMessage);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <PaymentElement
        options={{
          business: { name: "Youtorch" },
          fields: { billingDetails: { email: "never" } },
          layout: "tabs",
          paymentMethodOrder: ["card"],
          wallets: { applePay: "never", googlePay: "never", link: "never" },
        }}
      />
      {message && (
        <div className="mt-4 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {message}
        </div>
      )}
      <div className="mt-6 grid gap-3">
        <button
          type="submit"
          disabled={!stripe || !elements || submitting}
          className="h-11 rounded-full bg-[#caff37] px-5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#bfff19] disabled:pointer-events-none disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" />
              <UiText id="confirming_ae0eee35" />
            </span>
          ) : (
            tAuto("activate_plan_3a86ce38")
          )}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onBack}
          className="h-10 rounded-full border border-[#dedad2] bg-white px-5 text-sm font-semibold text-[#111111] transition-colors hover:border-[#111111] disabled:pointer-events-none disabled:opacity-60"
        >
          <UiText id="back_to_plans_20121191" />
        </button>
      </div>
    </form>
  );
}

async function completePurchaseIntent(
  purchaseIntentId: string,
  plan: string,
  onCompleted: (plan: string) => void,
) {
  const completed = await completeOfferPurchase({
    purchase_intent_id: purchaseIntentId,
  });

  if (completed.status === "completed") {
    onCompleted(plan);
    return;
  }

  const purchaseStatus = await getOfferPurchaseStatus(purchaseIntentId);
  if (purchaseStatus.status === "completed") {
    onCompleted(plan);
    return;
  }

  throw new Error(
    checkoutRecoveryMessage(null, purchaseStatus.status, purchaseStatus.error_message ?? completed.error_message),
  );
}

function checkoutRecoveryMessage(
  error: unknown,
  status?: string | null,
  fallback?: string | null,
): string {
  const code = isAuthClientError(error) ? error.code : "";
  const haystack = `${code} ${status ?? ""} ${fallback ?? ""} ${error instanceof Error ? error.message : ""}`.toLowerCase();
  if (code === "PURCHASE_EXPIRED" || status === "expired" || haystack.includes("purchase_expired")) {
    return "The 30-minute checkout lock ended. Start a new payment to use the current price. This is separate from any campaign valid-until date.";
  }
  if (
    code === "OFFER_PAID_SALE_CAPACITY_EXCEEDED"
    || haystack.includes("paid-sale")
    || haystack.includes("capacity exhausted")
    || haystack.includes("slot")
  ) {
    return "This offer is no longer available. The previous checkout was not turned into a new charge.";
  }
  if (code === "OFFER_PAYMENT_FAILED_RETRYABLE" || status === "failed_retryable" || haystack.includes("processing")) {
    return "This payment is still processing. Resume the same checkout instead of starting a new purchase.";
  }
  if (code === "OFFER_PAYMENT_FAILED" || haystack.includes("declin")) {
    return "The card was declined. You can try another payment method. The previous payment was not completed.";
  }
  if (haystack.includes("unknown") || status === "requires_confirmation") {
    return "Payment result is not confirmed yet. We will keep reconciling this checkout; do not start a second payment.";
  }
  if (error) return getSafeAuthMessage(error);
  return fallback || "Payment could not be completed.";
}

async function waitForPurchasedPlanSync(completion: OfferPlanCompletion) {
  let latestQuotaUsage: BillingQuotaUsage | null = null;

  for (let attempt = 0; attempt < CREDIT_SYNC_POLL_ATTEMPTS; attempt += 1) {
    const syncState = await readPurchasedPlanSyncState(completion);
    latestQuotaUsage = syncState.quotaUsage ?? latestQuotaUsage;

    if (syncState.planSynced && syncState.creditsSynced) {
      return { quotaUsage: latestQuotaUsage };
    }

    await wait(CREDIT_SYNC_POLL_INTERVAL_MS);
  }

  const finalState = await readPurchasedPlanSyncState(completion);
  return { quotaUsage: finalState.quotaUsage ?? latestQuotaUsage };
}

async function readPurchasedPlanSyncState(completion: OfferPlanCompletion) {
  const [planPackagesResult, quotaUsageResult] = await Promise.allSettled([
    getPlanPackages(),
    getBillingQuotaUsage(),
  ]);

  const planSynced =
    planPackagesResult.status === "fulfilled" &&
    planPackagesResult.value.data.current_plan === completion.plan &&
    (!completion.billingPeriod ||
      planPackagesResult.value.data.current_billing_period ===
        completion.billingPeriod);

  const quotaUsage =
    quotaUsageResult.status === "fulfilled" ? quotaUsageResult.value : null;
  const creditsSynced = quotaUsage
    ? isPurchasedCreditSyncReady(quotaUsage, completion)
    : (completion.includedCredits ?? 0) <= 0;

  return {
    planSynced,
    creditsSynced,
    quotaUsage,
  };
}

function isPurchasedCreditSyncReady(
  quotaUsage: BillingQuotaUsage,
  completion: OfferPlanCompletion,
) {
  const expectedCredits = completion.includedCredits ?? 0;
  if (expectedCredits <= 0) return true;

  const planIncludedTotal = getPlanIncludedCreditsTotal(quotaUsage);
  return planIncludedTotal + CREDIT_SYNC_EPSILON >= expectedCredits;
}

function getPlanIncludedCreditsTotal(quotaUsage: BillingQuotaUsage) {
  return (
    quotaUsage.plan_included_credits?.total ??
    quotaUsage.quotas.reduce((sum, quota) => {
      if (!isPlanIncludedCreditsQuota(quota.quota_key)) return sum;
      return sumCredits(sum, quota.total_quota);
    }, 0)
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function savePendingPurchaseSyncState(completion: OfferPlanCompletion) {
  if (typeof window === "undefined" || !completion.purchaseIntentId) return;

  try {
    window.sessionStorage.setItem(
      PENDING_PURCHASE_SYNC_STORAGE_KEY,
      JSON.stringify({
        purchase_intent_id: completion.purchaseIntentId,
        plan: completion.plan,
        billing_period: completion.billingPeriod ?? null,
        included_credits: completion.includedCredits ?? null,
        created_at: Date.now(),
      }),
    );
  } catch {
    // Session storage is best-effort for redirect recovery.
  }
}

function readPendingPurchaseSyncState(
  purchaseIntentId: string,
): OfferPlanCompletion | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(
      PENDING_PURCHASE_SYNC_STORAGE_KEY,
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      purchase_intent_id?: unknown;
      plan?: unknown;
      billing_period?: unknown;
      included_credits?: unknown;
      created_at?: unknown;
    };
    const createdAt = Number(parsed.created_at);
    if (
      parsed.purchase_intent_id !== purchaseIntentId ||
      typeof parsed.plan !== "string" ||
      !Number.isFinite(createdAt) ||
      Date.now() - createdAt > PENDING_PURCHASE_SYNC_MAX_AGE_MS
    ) {
      clearPendingPurchaseSyncState(purchaseIntentId);
      return null;
    }

    return {
      plan: parsed.plan,
      billingPeriod: isBillingPeriod(parsed.billing_period)
        ? parsed.billing_period
        : undefined,
      includedCredits:
        typeof parsed.included_credits === "number"
          ? parsed.included_credits
          : undefined,
      purchaseIntentId,
    };
  } catch {
    clearPendingPurchaseSyncState(purchaseIntentId);
    return null;
  }
}

function clearPendingPurchaseSyncState(purchaseIntentId?: string) {
  if (typeof window === "undefined") return;

  try {
    if (!purchaseIntentId) {
      window.sessionStorage.removeItem(PENDING_PURCHASE_SYNC_STORAGE_KEY);
      return;
    }

    const raw = window.sessionStorage.getItem(
      PENDING_PURCHASE_SYNC_STORAGE_KEY,
    );
    if (!raw) return;
    const parsed = JSON.parse(raw) as { purchase_intent_id?: unknown };
    if (parsed.purchase_intent_id === purchaseIntentId) {
      window.sessionStorage.removeItem(PENDING_PURCHASE_SYNC_STORAGE_KEY);
    }
  } catch {
    window.sessionStorage.removeItem(PENDING_PURCHASE_SYNC_STORAGE_KEY);
  }
}

async function refreshOnboardingAssignmentIfNeeded() {
  if (typeof window === "undefined") return refreshOnboardingAssignment();

  try {
    const lastRefresh = Number(
      window.sessionStorage.getItem(
        ONBOARDING_ASSIGNMENT_REFRESH_STORAGE_KEY,
      ) ?? 0,
    );
    if (
      Number.isFinite(lastRefresh) &&
      Date.now() - lastRefresh < ONBOARDING_ASSIGNMENT_REFRESH_TTL_MS
    ) {
      return null;
    }
  } catch {
    // Session storage is best-effort; fall back to the idempotent backend refresh.
  }

  const result = await refreshOnboardingAssignment();
  try {
    window.sessionStorage.setItem(
      ONBOARDING_ASSIGNMENT_REFRESH_STORAGE_KEY,
      String(Date.now()),
    );
  } catch {
    // Ignore storage failures; the backend refresh remains idempotent.
  }
  return result;
}

const CAMPAIGN_OFFER_ERROR_CODES = new Set([
  "OFFER_NOT_REDEEMABLE",
  "OFFER_ELIGIBILITY_FAILED",
  "OFFER_NOT_FOUND",
  "OFFER_PAID_SALE_CAPACITY_EXCEEDED",
]);

function isCampaignOfferError(error: unknown) {
  return (
    isAuthClientError(error) && CAMPAIGN_OFFER_ERROR_CODES.has(error.code)
  );
}

function buildCatalogSignature(packages: PlanPackage[]) {
  const parts: string[] = [];
  for (const pkg of packages) {
    for (const period of ["monthly", "quarterly", "yearly"] as BillingPeriod[]) {
      const current = pkg.periods[period];
      if (!current) continue;
      parts.push(
        [
          pkg.base_plan,
          period,
          current.offer_id,
          String(current.pricing.discounted_price),
          current.pricing.stripe_price_id ?? "",
        ].join("|"),
      );
    }
  }
  return parts.sort().join("\n");
}

function getNearestCatalogValidityBoundary(
  packages: PlanPackage[],
  now: number,
) {
  let nearest: number | null = null;
  for (const pkg of packages) {
    for (const period of Object.values(pkg.periods)) {
      if (!period?.valid_until) continue;
      const boundary = Date.parse(period.valid_until);
      if (!Number.isFinite(boundary)) continue;
      if (nearest === null || boundary < nearest) nearest = boundary;
    }
  }
  return nearest === null ? null : Math.max(nearest, now);
}

function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === "monthly" || value === "quarterly" || value === "yearly";
}

function resolveDisplayPrice(pkg: PlanPackage, requestedPeriod: BillingPeriod) {
  const period = pkg.periods[requestedPeriod];
  if (!period || !isSellableCatalogPrice(period.pricing.discounted_price)) return null;
  const pricing = period.pricing;
  const hasDiscount = pricing.discounted_price < pricing.original_price;
  return {
    billingPeriod: pricing.billing_period,
    offerId: period.offer_id,
    offerKind: period.offer_kind,
    originalPrice: pricing.original_price,
    discountedPrice: pricing.discounted_price,
    currency: pricing.currency,
    discountPercent: pricing.discount_percent,
    creditEquivalent: pricing.credit_equivalent,
    includedCredits: resolveIncludedCredits(
      pkg,
      pricing.billing_period,
      period,
    ),
    hasDiscount,
    showSavings: Boolean(period.display_config.show_savings && hasDiscount),
    savingsLabel: period.display_config.savings_label,
    badgeText: period.display_config.badge_text,
    priceCaption: period.display_config.price_caption,
    renewalNote: period.display_config.renewal_note,
    display_items: period.display_items,
    display_sections: period.display_sections,
  };
}

function resolveExpectedPlanCredits(price: DisplayPrice) {
  return price.creditEquivalent || price.includedCredits;
}

function resolveIncludedCredits(
  pkg: PlanPackage,
  billingPeriod: BillingPeriod,
  period: NonNullable<PlanPackage["periods"][BillingPeriod]>,
) {
  const periodMultiplier = billingPeriodMultiplier(billingPeriod);
  const monthlyCreditEquivalent =
    billingPeriod === "monthly"
      ? 0
      : (pkg.periods.monthly?.pricing.credit_equivalent ?? 0);
  const periodizedMonthlyCredits = monthlyCreditEquivalent * periodMultiplier;
  const priceCredits = Math.round(period.pricing.discounted_price * 100);

  return Math.max(
    period.pricing.credit_equivalent,
    periodizedMonthlyCredits,
    priceCredits,
  );
}

function billingPeriodMultiplier(period: BillingPeriod) {
  if (period === "yearly") return 12;
  if (period === "quarterly") return 3;
  return 1;
}

function normalizeCatalogPackages(plans: PublicPlanCatalogItem[]) {
  const packages = plans
    .filter((plan) => visiblePlans.has(plan.base_plan))
    .map((plan) => catalogItemToPackage(plan));

  return normalizePackageList(packages);
}

function normalizePackageList(packages: PlanPackage[]) {
  return packages
    .filter((pkg) => visiblePlans.has(pkg.base_plan))
    .map((pkg) => hydratePackage(pkg, pkg.base_plan as VisiblePlan))
    .sort(
      (left, right) =>
        sortOrder[left.base_plan as VisiblePlan] -
        sortOrder[right.base_plan as VisiblePlan],
    );
}

function mergeDisplayPackages(
  basePackages: PlanPackage[],
  tenantPackages: PlanPackage[],
) {
  const baseByPlan = new Map(basePackages.map((pkg) => [pkg.base_plan, pkg]));
  const tenantByPlan = new Map(
    tenantPackages.map((pkg) => [pkg.base_plan, pkg]),
  );

  return visiblePlanOrder
    .map((plan) => {
      const basePackage = baseByPlan.get(plan);
      const tenantPackage = tenantByPlan.get(plan);

      if (!basePackage && !tenantPackage) return null;
      if (!basePackage) return hydratePackage(tenantPackage!, plan);
      if (!tenantPackage) return hydratePackage(basePackage, plan);

      return hydratePackage(
        {
          ...basePackage,
          periods: mergePackagePeriods(
            basePackage.periods,
            tenantPackage.periods,
          ),
          has_active_subscription: tenantPackage.has_active_subscription,
          is_current_plan: tenantPackage.is_current_plan,
          transition_info: tenantPackage.transition_info,
        },
        plan,
      );
    })
    .filter((pkg): pkg is PlanPackage => pkg !== null);
}

function catalogItemToPackage(plan: PublicPlanCatalogItem): PlanPackage {
  const visiblePlan = toVisiblePlan(plan.base_plan);

  return {
    base_plan: plan.base_plan,
    name: visiblePlan ? planLabels[visiblePlan] : plan.name,
    description: visiblePlan
      ? plan.description || fallbackDescriptions[visiblePlan]
      : plan.description,
    sort_order: plan.sort_order,
    periods: plan.periods,
    has_active_subscription: false,
    is_current_plan: false,
    transition_info: null,
  };
}

function hydratePackage(pkg: PlanPackage, plan: VisiblePlan): PlanPackage {
  return {
    ...pkg,
    name: planLabels[plan],
    description: pkg.description || fallbackDescriptions[plan],
    sort_order: sortOrder[plan],
    periods: pkg.periods,
  };
}

function mergePackagePeriods(
  base: PlanPackage["periods"],
  tenant: PlanPackage["periods"],
): PlanPackage["periods"] {
  return {
    monthly: tenant.monthly ?? base.monthly,
    quarterly: tenant.quarterly ?? base.quarterly,
    yearly: tenant.yearly ?? base.yearly,
  };
}

function getRecommendedPlan(packages: PlanPackage[]) {
  return (
    packages.find((pkg) => pkg.base_plan === "pro" && hasPromoPeriod(pkg))
      ?.base_plan ??
    packages.find((pkg) => hasPromoPeriod(pkg))?.base_plan ??
    packages.find((pkg) => pkg.base_plan === "pro")?.base_plan ??
    packages[0]?.base_plan ??
    "pro"
  );
}

function getFeatureItems(
  period: NonNullable<ReturnType<typeof resolveDisplayPrice>>,
): FeatureItem[] {
  return uniqueFeatureItems(
    period.display_items.map((item) => ({
      label: item.label,
      included: item.included,
      muted: item.emphasis === "muted",
      strong: item.emphasis === "strong",
      badgeText: item.badge_text ?? undefined,
      caption: item.caption ?? undefined,
    })),
  );
}

function hasPromoPeriod(pkg: PlanPackage) {
  return Object.values(pkg.periods).some(
    (period) => period?.offer_kind === "promo",
  );
}

function findPromoPeriod(pkg?: PlanPackage) {
  if (!pkg) return null;
  return (
    Object.values(pkg.periods).find(
      (period) => period?.offer_kind === "promo",
    ) ?? null
  );
}

function shouldShowSavingsForPeriod(
  period: NonNullable<PlanPackage["periods"][BillingPeriod]>,
) {
  return Boolean(
    period.display_config.show_savings &&
    period.pricing.discounted_price < period.pricing.original_price,
  );
}

function uniqueFeatureItems(items: FeatureItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderHighlightedFeatureLabel(label: string) {
  return label.split(/(\d[\d,.]*)/g).map((part, index) => {
    if (!/^\d/.test(part)) return part;

    return (
      <span
        key={`${part}-${index}`}
        className="font-semibold text-[#111111] underline decoration-[#5b5750] decoration-2 underline-offset-[3px]"
      >
        {part}
      </span>
    );
  });
}

function getInfoText(plan: VisiblePlan) {
  if (plan === "starter") {
    return "Starter keeps the stack lean, so it is best for proving a single creator workflow before scaling.";
  }
  if (plan === "pro") {
    return "Pro adds the room most creators need for multi-channel output, memory and consistent weekly production.";
  }
  return "Max keeps higher limits available for larger publishing calendars and collaborative production.";
}

function getPlanBadgeText(plan: VisiblePlan) {
  if (plan === "pro") return "Best value";
  if (plan === "max") return "Scale";
  return "Lean";
}

function getPlanCardBorderClass(plan: VisiblePlan | null, selected: boolean) {
  if (selected) return "border-[#111111]";
  if (plan === "pro") return "border-[#d8d1f5]";
  if (plan === "max") return "border-[#ead8c8]";
  return "border-[#dedbd5]";
}

function getPlanTopStyle(
  plan: VisiblePlan | null,
): React.CSSProperties | undefined {
  if (plan === "pro") {
    return {
      background:
        "linear-gradient(90deg, #ede9ff 0%, #f1efff 24%, #f6f3ff 44%, #fbfaff 68%, #ffffff 100%)",
    };
  }

  if (plan === "max") {
    return {
      background:
        "linear-gradient(90deg, #efe7ff 0%, #f5ecff 22%, #fff0df 48%, #fff7ec 72%, #ffffff 100%)",
    };
  }

  return undefined;
}

function getPlanButtonClass(plan: VisiblePlan | null) {
  if (plan === "pro") {
    return "border-transparent bg-[linear-gradient(90deg,#7c3aed_0%,#4f46e5_56%,#818cf8_100%)] text-white shadow-sm shadow-[#4f46e5]/25 hover:brightness-[1.05]";
  }

  if (plan === "max") {
    return "border-transparent bg-[linear-gradient(90deg,#7c3aed_0%,#c056d6_42%,#f97316_100%)] text-white shadow-sm shadow-[#c056d6]/25 hover:brightness-[1.05]";
  }

  return "border-[#ddd9d2] bg-white text-[#111111] hover:border-[#111111]";
}

function getInlineBadgeClass(item: { muted?: boolean; strong?: boolean }) {
  if (item.strong) return "bg-[#111111] text-white";
  if (item.muted) return "bg-[#f0eee8] text-[#6f6a62]";
  return "bg-[#d9ff4a] text-[#172000]";
}

function getSectionBadgeClass(emphasis: DisplaySection["emphasis"]) {
  if (emphasis === "strong") return "bg-[#caff37] text-[#143000]";
  if (emphasis === "muted") return "bg-[#f0eee8] text-[#6f6a62]";
  return "bg-[#111111] text-white";
}

function getSectionItemBadgeClass(
  emphasis: DisplaySection["items"][number]["emphasis"],
) {
  if (emphasis === "strong") return "bg-[#111111] text-white";
  if (emphasis === "muted") return "bg-[#f0eee8] text-[#6f6a62]";
  return "bg-[#d9ff4a] text-[#172000]";
}

function toVisiblePlan(plan: string): VisiblePlan | null {
  return visiblePlans.has(plan) ? (plan as VisiblePlan) : null;
}

function periodLabel(period: BillingPeriod, t: OfferPlanTranslator) {
  if (period === "yearly") return t("period.year");
  if (period === "quarterly") return t("period.quarter");
  return t("period.month");
}

function getMonthlyEquivalent(value: number, period: BillingPeriod) {
  return period === "yearly" ? value / 12 : value;
}

function formatMoney(
  value: number,
  currency: string,
  format: OfferPlanFormatter,
) {
  return format.number(value, {
    style: "currency",
    currency: currency || "GBP",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatCardBrand(brand?: string | null) {
  if (!brand) return "Card";
  return brand
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatPlanLabel(plan: string) {
  return plan
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getSafeOfferPlanExitPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//"))
    return "/dashboard";

  try {
    const parsed = new URL(nextPath, "https://youtorch.local");
    if (parsed.origin !== "https://youtorch.local") return "/dashboard";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/dashboard";
  }
}

function formatDate(value: string, format: OfferPlanFormatter) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format.dateTime(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function emptyCreditSnapshot(): CurrentCreditSnapshot {
  return { available: 0, planRemaining: 0, topUpBalance: 0 };
}

const PLAN_INCLUDED_CREDITS_QUOTA_KEY = "billing:plan_included_credits";

function buildCreditSnapshot(
  quotaUsage: BillingQuotaUsage,
): CurrentCreditSnapshot {
  const planRemaining =
    quotaUsage.plan_included_credits?.remaining ??
    quotaUsage.quotas.reduce((sum, quota) => {
      if (!isPlanIncludedCreditsQuota(quota.quota_key)) return sum;
      return sumCredits(sum, quota.remaining_quota);
    }, 0);
  const topUpBalance =
    quotaUsage.top_up_balance_credits ?? quotaUsage.credit_balance;

  return {
    planRemaining,
    topUpBalance,
    available:
      quotaUsage.available_credits ?? sumCredits(planRemaining, topUpBalance),
  };
}

function isPlanIncludedCreditsQuota(quotaKey: string) {
  return quotaKey === PLAN_INCLUDED_CREDITS_QUOTA_KEY;
}

function sumCredits(...values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100;
}

function formatCredits(value: number, format: OfferPlanFormatter) {
  return format.number(value);
}

function readOrCreatePageExitKey(viewContextId: string): string {
  const storageKey = `${OFFER_PAGE_EXIT_STORAGE_PREFIX}${viewContextId}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing && existing.length >= 8) return existing;
    const next = crypto.randomUUID();
    sessionStorage.setItem(storageKey, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function remainingMsFromServer(validUntil: string | null, serverNow: string | null, receivedAt: number): number | null {
  if (!validUntil) return null;
  const until = Date.parse(validUntil);
  const nowAtServer = serverNow ? Date.parse(serverNow) : receivedAt;
  if (!Number.isFinite(until) || !Number.isFinite(nowAtServer)) return null;
  return until - nowAtServer - (Date.now() - receivedAt);
}

function formatRemaining(ms: number, tPlan: OfferPlanTranslator): string {
  if (ms <= 0) return tPlan("windowClosed");
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return tPlan("countdownHms", { hours, minutes, seconds });
  return tPlan("countdownMs", { minutes, seconds });
}

function findPackageForOffer(packages: PlanPackage[], offerId: string): { pkg: PlanPackage; period: BillingPeriod } | null {
  for (const pkg of packages) {
    for (const period of billingPeriods) {
      if (pkg.periods[period]?.offer_id === offerId) return { pkg, period };
    }
  }
  return null;
}

function campaignInvalidCopy(
  variant: CampaignInvalidVariant,
  tPlan: OfferPlanTranslator,
) {
  if (variant === "ended-new-offers") {
    return {
      title: tPlan("campaignEndedNewOffersTitle"),
      body: tPlan("campaignEndedNewOffersBody"),
    };
  }
  if (variant === "ended") {
    return {
      title: tPlan("campaignEndedTitle"),
      body: tPlan("campaignEndedBody"),
    };
  }
  return {
    title: tPlan("campaignInvalidTitle"),
    body: tPlan("campaignInvalidBody"),
  };
}

function CampaignInvalidPopup({
  open,
  variant,
  tPlan,
  onDismiss,
}: {
  open: boolean;
  variant: CampaignInvalidVariant | null;
  tPlan: OfferPlanTranslator;
  onDismiss: () => void;
}) {
  const copy = campaignInvalidCopy(variant ?? "invalid", tPlan);
  return (
    <Dialog.Root open={open && Boolean(variant)} onOpenChange={(next) => { if (!next) onDismiss(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold text-[#111111]">
            {copy.title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-[#343434]">
            {copy.body}
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md bg-[#111111] px-3 py-2 text-sm font-semibold text-white"
              onClick={onDismiss}
            >
              {tPlan("campaignNoticeDismiss")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PersonalOfferPopup({
  open,
  offer,
  packages,
  serverNow,
  checkoutExpiresAt,
  tPlan,
  onDismiss,
  onSelect,
}: {
  open: boolean;
  offer: PersonalOfferWindow | null;
  packages: PlanPackage[];
  serverNow: string | null;
  checkoutExpiresAt: string | null | undefined;
  tPlan: OfferPlanTranslator;
  onDismiss: () => void;
  onSelect: (plan: string) => void;
}) {
  const receivedAt = React.useRef(Date.now());
  const [remaining, setRemaining] = React.useState(() => remainingMsFromServer(offer?.valid_until ?? null, serverNow, receivedAt.current));
  React.useEffect(() => {
    receivedAt.current = Date.now();
    const tick = () => setRemaining(remainingMsFromServer(offer?.valid_until ?? null, serverNow, receivedAt.current));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [offer?.valid_until, serverNow]);
  const matched = offer ? findPackageForOffer(packages, offer.offer_id) : null;
  const checkoutRemaining = remainingMsFromServer(checkoutExpiresAt ?? null, serverNow, receivedAt.current);
  return (
    <Dialog.Root open={open && Boolean(offer)} onOpenChange={(next) => { if (!next) onDismiss(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold text-[#111111]">
            {tPlan("personalOfferTitle")}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-[#343434]">
            {matched
              ? tPlan("personalOfferBody", { plan: matched.pkg.name })
              : tPlan("personalOfferGeneric")}
          </Dialog.Description>
          {remaining !== null ? (
            <p className="mt-3 text-sm font-semibold text-[#111111]">
              {tPlan("personalWindowLabel")}: {formatRemaining(remaining, tPlan)}
            </p>
          ) : null}
          {checkoutRemaining !== null ? (
            <p className="mt-1 text-xs font-medium text-[#706d68]">
              {tPlan("checkoutLockLabel")}: {formatRemaining(checkoutRemaining, tPlan)}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-2 text-sm font-semibold text-[#706d68]"
              onClick={onDismiss}
            >
              {tPlan("dismissPersonalOffer")}
            </button>
            {matched ? (
              <button
                type="button"
                className="rounded-md bg-[#111111] px-3 py-2 text-sm font-semibold text-white"
                onClick={() => onSelect(matched.pkg.base_plan)}
              >
                {tPlan("selectPersonalOffer")}
              </button>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
