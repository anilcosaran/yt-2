"use client";

import Image from "next/image";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Captions,
  Check,
  ChevronDown,
  Copy,
  Droplet,
  ImageIcon,
  Loader2,
  LockKeyhole,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Type,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  StorageMediaInput,
  type StorageMediaSelection,
} from "@/components/storage/storage-media-input";
import { CaptionStylePicker } from "@/components/tools/caption-style-picker";
import { AvatarStudioView } from "@/components/brand/avatar/avatar-studio-view";
import { BrandVoicePage } from "@/components/brand/voice/brand-voice-page";
import {
  CAPTION_STYLE_NAMES,
  CaptionVideoPreview,
} from "@/components/tools/caption-style-preview-field";
import { AppAlertDialog } from "@/components/ui/app-alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { getSafeAuthMessage, isAuthClientError } from "@/lib/auth/errors";
import {
  PLATFORM_FONTS_QUERY_KEY,
  brandKitBindingQueryKey,
  brandKitQueryKey,
  brandKitsQueryKey,
  createBrandKit,
  getBrandKit,
  getBrandKitBinding,
  getBrandKitRevision,
  listBrandKits,
  listPlatformFonts,
  newBrandKitClientRequestId,
  publishBrandKitRevision,
  setBrandKitBinding,
  setBrandKitSharing,
  updateBrandKitDraft,
  type BrandKitDraftContent,
  type BrandKitListItem,
} from "@/lib/brand-kit/api";
import { BrandWatermarkAssetRequiredError, saveBrandKit } from "@/lib/brand-kit/save-kit";
import {
  editorFromDraft,
  fontFamilyOptions,
  nearestFontToken,
  normalizeHexColor,
  resolveWatermarkAsset,
  watermarkFromOverlay,
  type BrandAssetRef,
  type BrandColorKey,
  type BrandFontFamilyOption,
  type BrandFontToken,
  type BrandKitEditor,
  type BrandLogoSlot,
  type BrandOverlayAnchor,
  type BrandOverlayAnimation,
  type BrandWatermarkEditor,
} from "@/lib/brand-kit/editor-model";
import { useActiveChannel } from "@/lib/channel/active-channel";
import { WorkspaceChannelRequired } from "@/components/channel/workspace-channel-required";
import { WorkspaceRouteLoading } from "@/components/common/workspace-route-loading";
import {
  getChannelActionErrorMessage,
  updateChannelSettings,
} from "@/lib/channel/api";
import { useStorageThumbnailUrl } from "@/lib/storage/use-storage-thumbnail-url";
import { cn } from "@/lib/utils";
import { UiText } from "@/components/i18n/ui-text";
import { useTranslations } from "next-intl";

type CreateMode = "blank" | "duplicate";

const COLOR_META: Array<{
  key: BrandColorKey;
  labelKey: string;
  roleKey: string;
}> = [
  {
    key: "primary",
    labelKey: "brand.colors.primary",
    roleKey: "brand.colors.buttonsAccents",
  },
  {
    key: "secondary",
    labelKey: "brand.colors.secondary",
    roleKey: "brand.colors.surfaces",
  },
  {
    key: "tertiary",
    labelKey: "brand.colors.tertiary",
    roleKey: "brand.colors.mutedText",
  },
  {
    key: "accent",
    labelKey: "brand.colors.accent",
    roleKey: "brand.colors.highlights",
  },
];

const LOGO_META: Array<{ key: BrandLogoSlot; labelKey: string; noteKey: string }> = [
  {
    key: "primary",
    labelKey: "brand.logos.primary",
    noteKey: "brand.logos.primaryNote",
  },
  {
    key: "horizontal",
    labelKey: "brand.logos.horizontal",
    noteKey: "brand.logos.horizontalNote",
  },
  {
    key: "mark",
    labelKey: "brand.logos.mark",
    noteKey: "brand.logos.markNote",
  },
];

const CAPTION_OPTIONS = ["auto", ...CAPTION_STYLE_NAMES].map((value) => ({
  value,
  label: formatLabel(value),
}));

/**
 * P06-01: the Kit editor sections. The former local-only "Effects & transitions" section has no
 * server field (the typed Video style section is P06-36), so it is not offered until that lands.
 */
const EDITOR_SECTIONS = ["logos", "watermark", "colors", "fonts", "captions"] as const;

const WATERMARK_ANCHORS: Array<{
  value: BrandOverlayAnchor;
  labelKey: string;
}> = [
  { value: "top_left", labelKey: "brand.anchors.topLeft" },
  { value: "top_center", labelKey: "brand.anchors.topCenter" },
  { value: "top_right", labelKey: "brand.anchors.topRight" },
  { value: "middle_left", labelKey: "brand.anchors.middleLeft" },
  { value: "center", labelKey: "brand.anchors.center" },
  { value: "middle_right", labelKey: "brand.anchors.middleRight" },
  { value: "bottom_left", labelKey: "brand.anchors.bottomLeft" },
  { value: "bottom_center", labelKey: "brand.anchors.bottomCenter" },
  { value: "bottom_right", labelKey: "brand.anchors.bottomRight" },
];

const WATERMARK_BEHAVIORS: Array<{
  value: BrandOverlayAnimation;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "static",
    labelKey: "brand.behaviors.fixed",
    descriptionKey: "brand.behaviors.fixedDescription",
  },
  {
    value: "corner_cycle",
    labelKey: "brand.behaviors.move",
    descriptionKey: "brand.behaviors.moveDescription",
  },
  {
    value: "fade_corner_cycle",
    labelKey: "brand.behaviors.moveFade",
    descriptionKey: "brand.behaviors.moveFadeDescription",
  },
];

function SectionHeading({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-panel">
          <Icon className="size-[18px] text-primary" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function BrandStudioView({
  section,
  kitId,
}: {
  section?: string;
  kitId?: string;
}) {
  if (section === "avatars") return <AvatarStudioView />;
  if (section === "voices") return <BrandVoicePage />;
  return <BrandKitStudioView section={section} kitId={kitId} />;
}

/** A gateway error code (`BRAND_KIT_DRAFT_VERSION_CONFLICT`, ...) or null. */
function errorCodeOf(error: unknown): string | null {
  return isAuthClientError(error) ? error.code : null;
}

function BrandKitStudioView({
  section,
  kitId,
}: {
  section?: string;
  kitId?: string;
}) {
  const tAuto = useTranslations("Auto");
  const tTheme = useTranslations("NewTheme");
  const router = useRouter();
  const queryClient = useQueryClient();
  const isListView = !kitId || !section || section === "kits";
  const editorSection = (EDITOR_SECTIONS as readonly string[]).includes(section ?? "")
    ? section
    : "logos";
  const { activeChannel, isLoading: channelLoading, refreshChannels } =
    useActiveChannel();
  const channelId = activeChannel?.id ?? "";

  const kitsQuery = useQuery({
    queryKey: brandKitsQueryKey(channelId),
    queryFn: ({ signal }) => listBrandKits(channelId, { signal }),
    enabled: Boolean(channelId),
  });
  const bindingQuery = useQuery({
    queryKey: brandKitBindingQueryKey(channelId),
    queryFn: ({ signal }) => getBrandKitBinding(channelId, { signal }),
    enabled: Boolean(channelId),
  });
  const fontsQuery = useQuery({
    queryKey: PLATFORM_FONTS_QUERY_KEY,
    queryFn: ({ signal }) => listPlatformFonts({ signal }),
    staleTime: 5 * 60_000,
  });
  const editingKitId = !isListView && kitId ? kitId : null;
  const detailQuery = useQuery({
    queryKey: brandKitQueryKey(editingKitId ?? ""),
    queryFn: ({ signal }) => getBrandKit(editingKitId ?? "", { signal }),
    enabled: Boolean(editingKitId),
  });

  const kits = React.useMemo(() => kitsQuery.data ?? [], [kitsQuery.data]);
  const binding = bindingQuery.data ?? null;
  const effectiveKitId = binding?.effective.kit_id ?? null;
  const fontOptions = React.useMemo(
    () => fontFamilyOptions(fontsQuery.data ?? []),
    [fontsQuery.data],
  );
  const detail = detailQuery.data ?? null;
  const channelOverlay = activeChannel?.settings.brandOverlay ?? null;

  // Form state of the owner's draft; re-seeded only when another Kit or draft version loads, so a
  // background refetch never overwrites unsaved edits. It is never written to browser storage.
  const [editor, setEditor] = React.useState<BrandKitEditor | null>(null);
  const [watermark, setWatermark] = React.useState<BrandWatermarkEditor | null>(null);
  const seededRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!detail?.draft) return;
    const seed = `${detail.kit_id}:${detail.draft.version}`;
    if (seededRef.current === seed) return;
    seededRef.current = seed;
    const next = editorFromDraft(detail);
    setEditor(next);
    setWatermark(
      watermarkFromOverlay(channelOverlay, next.logos.primary?.storageObjectId ?? null),
    );
  }, [detail, channelOverlay]);

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [createMode, setCreateMode] = React.useState<CreateMode>("blank");
  const [newKitName, setNewKitName] = React.useState("");
  const [shareTarget, setShareTarget] = React.useState<BrandKitListItem | null>(null);
  const [privateDefault, setPrivateDefault] = React.useState<BrandKitListItem | null>(null);

  React.useEffect(() => {
    if (!section) return;
    const targetSection =
      section === "kits" ? "brand-kits" : `brand-${section}`;
    window.requestAnimationFrame(() => {
      document
        .getElementById(targetSection)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [section]);

  const refreshBrand = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: brandKitsQueryKey(channelId) }),
      queryClient.invalidateQueries({ queryKey: brandKitBindingQueryKey(channelId) }),
    ]);
  }, [channelId, queryClient]);

  const openKitEditor = React.useCallback(
    (nextKitId: string) => {
      router.push(`/brand?section=logos&kit=${encodeURIComponent(nextKitId)}`);
    },
    [router],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeChannel || !detail?.draft || !editor || !watermark) {
        throw new Error("Brand Kit is not loaded yet.");
      }
      const saved = await saveBrandKit(
        {
          editor,
          baseContent: detail.draft.content,
          watermark,
          channelId: activeChannel.id,
          overlay: channelOverlay,
          overlayVersion: activeChannel.settings.brandOverlayVersion,
        },
        { updateBrandKitDraft, publishBrandKitRevision, updateChannelSettings },
      );
      if (saved.overlaySaved) await refreshChannels();
    },
    onSuccess: async () => {
      await Promise.all([
        refreshBrand(),
        queryClient.invalidateQueries({ queryKey: brandKitQueryKey(editingKitId ?? "") }),
      ]);
      toast.success(tTheme("brand.toast.saved"));
    },
    onError: async (error) => {
      if (errorCodeOf(error) === "BRAND_KIT_DRAFT_VERSION_CONFLICT") {
        seededRef.current = null;
        await queryClient.invalidateQueries({ queryKey: brandKitQueryKey(editingKitId ?? "") });
        toast.error(tTheme("brandLibrary.toast.conflict"));
        return;
      }
      toast.error(tTheme("brand.toast.saveFailed"), {
        description: error instanceof BrandWatermarkAssetRequiredError
          ? tTheme("brand.errors.watermarkAssetRequired")
          : errorCodeOf(error)?.startsWith("CHANNEL")
            ? getChannelActionErrorMessage(error)
            : getSafeAuthMessage(error),
      });
    },
  });

  const defaultMutation = useMutation({
    mutationFn: async (kit: BrandKitListItem) => {
      if (!binding) throw new Error("Brand Kit binding is not loaded yet.");
      const scope = binding.actor_capabilities.set_channel_default ? "channel_default" : "actor_selection";
      const result = await setBrandKitBinding({
        channelId,
        scope,
        kitId: kit.origin === "builtin" ? null : kit.kit_id,
        expectedBindingVersion: binding[scope].binding_version,
      });
      return { kit, scope, result };
    },
    onSuccess: async ({ kit, scope, result }) => {
      await refreshBrand();
      toast.success(tTheme("brand.toast.defaultChanged"));
      // S28: a private channel default does not reach members until the owner shares it.
      if (
        scope === "channel_default" &&
        result.member_access === "owner_only" &&
        kit.sharing &&
        binding?.actor_capabilities.share_own_kits
      ) {
        setPrivateDefault(kit);
      }
    },
    onError: async (error) => {
      await refreshBrand();
      toast.error(tTheme("brand.toast.saveFailed"), { description: getSafeAuthMessage(error) });
    },
  });

  const sharingMutation = useMutation({
    mutationFn: async (kit: BrandKitListItem) => {
      if (!kit.sharing) throw new Error("Only the Kit owner shares it.");
      return setBrandKitSharing({
        kitId: kit.kit_id,
        sharedWithChannelMembers: !kit.sharing.shared_with_channel_members,
        expectedAclVersion: kit.sharing.acl_version,
      });
    },
    onSuccess: async (state) => {
      setShareTarget(null);
      setPrivateDefault(null);
      await refreshBrand();
      toast.success(
        tTheme(state.shared_with_channel_members ? "brandLibrary.toast.shared" : "brandLibrary.toast.unshared"),
      );
    },
    onError: async (error) => {
      setShareTarget(null);
      setPrivateDefault(null);
      await refreshBrand();
      toast.error(tTheme("brand.toast.saveFailed"), { description: getSafeAuthMessage(error) });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; source: BrandKitListItem | null }) => {
      const content = input.source ? await duplicateContent(input.source) : undefined;
      return createBrandKit({
        channelId,
        name: input.name,
        clientRequestId: newBrandKitClientRequestId(),
        content,
      });
    },
    onSuccess: async (created, input) => {
      setCreateDialogOpen(false);
      setNewKitName("");
      await refreshBrand();
      openKitEditor(created.kit_id);
      toast.success(tTheme(input.source ? "brand.toast.duplicated" : "brand.toast.created"));
    },
    onError: (error) => {
      toast.error(tTheme("brand.toast.saveFailed"), { description: getSafeAuthMessage(error) });
    },
  });

  /** Draft body of a copy: the owner's draft, or the published revision of a shared/built-in Kit. */
  async function duplicateContent(source: BrandKitListItem): Promise<BrandKitDraftContent | undefined> {
    if (source.origin === "builtin") return undefined;
    const sourceDetail = await queryClient.fetchQuery({
      queryKey: brandKitQueryKey(source.kit_id),
      queryFn: ({ signal }) => getBrandKit(source.kit_id, { signal }),
    });
    if (sourceDetail.draft) return sourceDetail.draft.content;
    if (!source.head_revision) return undefined;
    const revision = await getBrandKitRevision(source.kit_id, source.head_revision.revision_id);
    const logo = (value: { storage_object_id: string } | null) =>
      value ? { storage_object_id: value.storage_object_id } : null;
    return {
      ...revision.content,
      logos: {
        primary: logo(revision.content.logos.primary),
        horizontal: logo(revision.content.logos.horizontal),
        mark: logo(revision.content.logos.mark),
      },
    };
  }

  const selectedListItem =
    kits.find((kit) => kit.kit_id === editingKitId) ?? null;
  const duplicateSource = selectedListItem ?? kits.find((kit) => kit.kit_id === effectiveKitId) ?? kits[0] ?? null;

  const updateEditor = React.useCallback(
    (updater: (current: BrandKitEditor) => BrandKitEditor) => {
      setEditor((current) => (current ? updater(current) : current));
    },
    [],
  );

  if (!activeChannel) {
    if (channelLoading) {
      return <WorkspaceRouteLoading />;
    }
    return <WorkspaceChannelRequired compact />;
  }

  if (kitsQuery.isPending || bindingQuery.isPending) {
    return <WorkspaceRouteLoading />;
  }

  if (kitsQuery.isError || bindingQuery.isError) {
    return (
      <BrandStateMessage
        title={tTheme("brandLibrary.loadFailed")}
        description={getSafeAuthMessage(kitsQuery.error ?? bindingQuery.error)}
        action={
          <Button
            type="button"
            variant="outline"
            className="mt-4 h-9 rounded-lg"
            onClick={() => void refreshBrand()}
          >
            {tTheme("brandLibrary.retry")}
          </Button>
        }
      />
    );
  }

  if (!isListView) {
    if (detailQuery.isPending) return <WorkspaceRouteLoading />;
    if (detailQuery.isError || !detail) {
      return (
        <BrandStateMessage
          title={tTheme("brandLibrary.loadFailed")}
          description={getSafeAuthMessage(detailQuery.error)}
        />
      );
    }
    if (!detail.draft) {
      return (
        <BrandStateMessage
          title={detail.name}
          description={tTheme("brandLibrary.readOnlyNote")}
        />
      );
    }
    if (!editor || editor.kitId !== detail.kit_id || !watermark) {
      return <WorkspaceRouteLoading />;
    }
  }

  const editorKit = !isListView ? editor : null;
  const editorIsDefault = editorKit !== null && editorKit.kitId === effectiveKitId;
  const defaultKit = kits.find((kit) => kit.kit_id === effectiveKitId) ?? null;

  return (
    <div className="hg-scrollbar relative h-full flex-1 overflow-y-auto bg-background">
      <div className="relative mx-auto w-full max-w-[1100px] px-4 py-6 md:px-8 md:py-8">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            <UiText id="brand_62b4aa57" />
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span>
            <UiText id="brand_kits_f149e70b" />
          </span>
          {editorKit ? (
            <>
              <span className="text-muted-foreground/50">/</span>
              <span className="truncate text-foreground">
                {editorKit.name}
              </span>
            </>
          ) : null}
        </nav>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                {editorKit ? editorKit.name : tAuto("brand_kits_f149e70b")}
              </h1>
              {editorIsDefault ? <DefaultBadge /> : null}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {editorKit
                ? tAuto("one_source_of_truth_for_every_generated_video_59da14b5")
                : tTheme("brand.channelDescription", {
                    channel: activeChannel.name,
                  })}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              if (!editorKit) {
                setNewKitName("");
                setCreateMode("blank");
                setCreateDialogOpen(true);
                return;
              }
              saveMutation.mutate();
            }}
            disabled={
              Boolean(editorKit) &&
              (saveMutation.isPending ||
                Boolean(
                  watermark?.enabled &&
                    editorKit &&
                    !resolveWatermarkAsset(watermark, editorKit.logos),
                ))
            }
            className="ml-auto h-9 rounded-full px-4"
          >
            {!editorKit ? (
              <Plus className="size-4" />
            ) : saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {!editorKit
              ? tAuto("new_kit_62d16f19")
              : tAuto("save_changes_179359b3")}
          </Button>
        </div>

        <section
          id="brand-kits"
          className={cn("mt-9 scroll-mt-4", !isListView && "hidden")}
        >
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-sm font-medium text-foreground">{tAuto("your_kits_1c65bbbc")}</h2>
            <span className="text-xs text-muted-foreground">{tTheme("brandLibrary.kitCount", { count: kits.length })}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {kits.map((kit) => (
              <BrandKitCard
                key={kit.kit_id}
                kit={kit}
                isDefault={kit.kit_id === effectiveKitId}
                selected={kit.kit_id === kitId}
                busy={defaultMutation.isPending || sharingMutation.isPending || createMutation.isPending}
                onSelect={kit.access_role === "owner" ? () => openKitEditor(kit.kit_id) : undefined}
                onMakeDefault={() => defaultMutation.mutate(kit)}
                onDuplicate={() =>
                  createMutation.mutate({
                    name: tTheme("brand.copyName", { name: kit.name }).slice(0, 80),
                    source: kit,
                  })
                }
                onToggleSharing={
                  kit.sharing &&
                  (binding?.actor_capabilities.share_own_kits || kit.sharing.shared_with_channel_members)
                    ? () => setShareTarget(kit)
                    : undefined
                }
              />
            ))}
            <button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              className="flex min-h-[212px] flex-col items-center justify-center rounded-2xl border border-dashed border-border p-5 text-center text-muted-foreground transition hover:border-foreground/25 hover:bg-muted/30 hover:text-foreground"
            >
              <span className="flex size-10 items-center justify-center rounded-full border border-border">
                <Plus className="size-4" />
              </span>
              <span className="mt-3 text-sm font-semibold">
                <UiText id="create_brand_kit_e082e2b6" />
              </span>
              <span className="mt-1 text-xs">
                <UiText id="start_clean_or_duplicate_this_kit_ae0879f0" />
              </span>
            </button>
          </div>
        </section>

        {editorKit && watermark ? (
          <>
            <div
              className={cn(
                "mt-10",
                !["logos", "watermark"].includes(editorSection ?? "") &&
                  "hidden",
              )}
            >
              <GroupLabel>
                <UiText id="identity_7e5a975b" />
              </GroupLabel>
              <section
                id="brand-logos"
                className={cn("scroll-mt-4", editorSection !== "logos" && "hidden")}
              >
                <SectionHeading
                  icon={ImageIcon}
                  title={tAuto("logos_3089591a")}
                  description={tAuto(
                    "choose_existing_image_assets_or_upload_a_mark_wi_367b7950",
                  )}
                />
                <div className="grid gap-3 lg:grid-cols-3">
                  {LOGO_META.map((logo) => (
                    <LogoAssetCard
                      key={logo.key}
                      channelId={activeChannel.id}
                      slot={logo.key}
                      label={tTheme(logo.labelKey)}
                      note={tTheme(logo.noteKey)}
                      asset={editorKit.logos[logo.key]}
                      onChange={(asset) =>
                        updateEditor((kit) => ({
                          ...kit,
                          logos: { ...kit.logos, [logo.key]: asset },
                        }))
                      }
                    />
                  ))}
                </div>
              </section>

              <section
                id="brand-watermark"
                className={cn(
                  "scroll-mt-4",
                  editorSection !== "watermark" && "hidden",
                )}
              >
                <SectionHeading
                  icon={Droplet}
                  title={tAuto("watermark_d67f8b55")}
                  description={tAuto(
                    "use_a_logo_asset_then_control_safe_placement_mov_d284e5bc",
                  )}
                  action={
                    <label className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border bg-panel/50 px-3 py-2">
                      <span className="hidden text-xs font-semibold text-foreground sm:inline">
                        {watermark.enabled
                          ? tAuto("enabled_df174a3f")
                          : tAuto("disabled_f4f4473d")}
                      </span>
                      <Switch
                        checked={watermark.enabled}
                        aria-label={tAuto("enable_watermark_6d09f0ed")}
                        onCheckedChange={(enabled) =>
                          setWatermark((current) => (current ? { ...current, enabled } : current))
                        }
                      />
                    </label>
                  }
                />
                <WatermarkEditor
                  channelId={activeChannel.id}
                  kit={editorKit}
                  watermark={watermark}
                  onChange={setWatermark}
                />
              </section>
            </div>

            <div
              className={cn(
                "mt-10 pb-4",
                !["colors", "fonts", "captions"].includes(editorSection ?? "") &&
                  "hidden",
              )}
            >
              <GroupLabel>
                <UiText id="style_99a0efc6" />
              </GroupLabel>
              <section
                id="brand-colors"
                className={cn(
                  "scroll-mt-4",
                  editorSection !== "colors" && "hidden",
                )}
              >
                <SectionHeading
                  icon={Palette}
                  title={tAuto("colors_88d5e4ca")}
                  description={tAuto(
                    "click_any_color_to_open_the_picker_or_enter_an_e_5e801841",
                  )}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {COLOR_META.map((color) => (
                    <ColorPickerField
                      key={`${editorKit.kitId}:${color.key}:${editorKit.colors[color.key]}`}
                      label={tTheme(color.labelKey)}
                      description={tTheme(color.roleKey)}
                      value={editorKit.colors[color.key]}
                      onChange={(value) =>
                        updateEditor((kit) => ({
                          ...kit,
                          colors: { ...kit.colors, [color.key]: value },
                        }))
                      }
                    />
                  ))}
                </div>
              </section>

              <section
                id="brand-fonts"
                className={cn("scroll-mt-4", editorSection !== "fonts" && "hidden")}
              >
                <SectionHeading
                  icon={Type}
                  title={tAuto("typography_f4beb9af")}
                  description={tAuto(
                    "choose_title_and_body_fonts_from_visual_previews_484a4505",
                  )}
                />
                <div className="grid gap-3 lg:grid-cols-2">
                  <TypographyCard
                    role="Title"
                    sample="Build a recognizable brand"
                    font={editorKit.fonts.title}
                    options={fontOptions}
                    loading={fontsQuery.isPending}
                    onChange={(title) =>
                      updateEditor((kit) => ({
                        ...kit,
                        fonts: { ...kit.fonts, title },
                      }))
                    }
                  />
                  <TypographyCard
                    role="Body"
                    sample="Clear typography keeps captions and cards easy to read."
                    font={editorKit.fonts.body}
                    options={fontOptions}
                    loading={fontsQuery.isPending}
                    onChange={(body) =>
                      updateEditor((kit) => ({
                        ...kit,
                        fonts: { ...kit.fonts, body },
                      }))
                    }
                  />
                </div>
              </section>

              <section
                id="brand-captions"
                className={cn(
                  "scroll-mt-4",
                  editorSection !== "captions" && "hidden",
                )}
              >
                <SectionHeading
                  icon={Captions}
                  title={tAuto("captions_1201f5be")}
                  description={tAuto(
                    "reuse_the_production_caption_gallery_from_tools__471201af",
                  )}
                />
                <div className="grid overflow-hidden rounded-2xl border border-border bg-panel/35 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
                  <div className="space-y-4 border-b border-border p-4 lg:border-b-0 lg:border-r">
                    <CaptionStylePicker
                      value={editorKit.captions.styleName}
                      options={CAPTION_OPTIONS}
                      resolvedStyleName="tiktok_bold"
                      onValueChange={(styleName) =>
                        updateEditor((kit) => ({
                          ...kit,
                          captions: { ...kit.captions, styleName },
                        }))
                      }
                    />
                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                      <CompactColorField
                        label={tAuto("text_c3328c39")}
                        value={editorKit.captions.fontColor}
                        onChange={(fontColor) =>
                          updateEditor((kit) => ({
                            ...kit,
                            captions: { ...kit.captions, fontColor },
                          }))
                        }
                      />
                      <CompactColorField
                        label={tAuto("highlight_e1da9275")}
                        value={editorKit.captions.highlightColor}
                        onChange={(highlightColor) =>
                          updateEditor((kit) => ({
                            ...kit,
                            captions: { ...kit.captions, highlightColor },
                          }))
                        }
                      />
                      <CompactColorField
                        label={tAuto("outline_depth_6c0df2c4")}
                        value={editorKit.captions.effectColor}
                        onChange={(effectColor) =>
                          updateEditor((kit) => ({
                            ...kit,
                            captions: { ...kit.captions, effectColor },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="h-[300px] min-h-0 p-3 sm:h-[340px]">
                    <CaptionVideoPreview
                      media={{
                        name: tTheme("brand.captionSample"),
                        previewUrl: null,
                        width: 1080,
                        height: 1920,
                        durationSeconds: 12,
                      }}
                      styleName={editorKit.captions.styleName}
                      fontSize={48}
                      captionPosition="auto"
                      showDetails={false}
                      visibilityOverrides={{
                        visibility_enabled: true,
                        font_color: editorKit.captions.fontColor,
                        highlight_color: editorKit.captions.highlightColor,
                        effect_color: editorKit.captions.effectColor,
                        shadow_strength: "strong",
                      }}
                    />
                  </div>
                </div>
              </section>
            </div>
          </>
        ) : null}

        <CreateBrandKitDialog
          open={createDialogOpen}
          mode={createMode}
          name={newKitName}
          selectedKitName={duplicateSource?.name ?? ""}
          busy={createMutation.isPending}
          onOpenChange={setCreateDialogOpen}
          onModeChange={setCreateMode}
          onNameChange={setNewKitName}
          onCreate={() => {
            const name = newKitName.trim();
            if (!name || createMutation.isPending) return;
            createMutation.mutate({
              name,
              source: createMode === "duplicate" ? duplicateSource : null,
            });
          }}
        />

        <AppAlertDialog
          open={Boolean(shareTarget)}
          title={tTheme(
            shareTarget?.sharing?.shared_with_channel_members
              ? "brandLibrary.unshareTitle"
              : "brandLibrary.shareTitle",
          )}
          description={tTheme(
            shareTarget?.sharing?.shared_with_channel_members
              ? "brandLibrary.unshareDescription"
              : "brandLibrary.shareDescription",
            { channel: activeChannel.name },
          )}
          confirmLabel={tTheme(
            shareTarget?.sharing?.shared_with_channel_members
              ? "brandLibrary.unshareConfirm"
              : "brandLibrary.shareConfirm",
          )}
          cancelLabel={tAuto("cancel_77dfd213")}
          tone="warning"
          busy={sharingMutation.isPending}
          showCancel
          showClose
          onOpenChange={(open) => {
            if (!open) setShareTarget(null);
          }}
          onCancel={() => setShareTarget(null)}
          onConfirm={() => {
            if (shareTarget && !sharingMutation.isPending) sharingMutation.mutate(shareTarget);
          }}
        />

        <AppAlertDialog
          open={Boolean(privateDefault)}
          title={tTheme("brandLibrary.privateDefaultTitle")}
          description={tTheme("brandLibrary.privateDefaultDescription", {
            kit: privateDefault?.name ?? "",
            channel: activeChannel.name,
          })}
          confirmLabel={tTheme("brandLibrary.share")}
          cancelLabel={tTheme("brandLibrary.privateDefaultKeep")}
          tone="warning"
          busy={sharingMutation.isPending}
          showCancel
          showClose
          onOpenChange={(open) => {
            if (!open) setPrivateDefault(null);
          }}
          onCancel={() => setPrivateDefault(null)}
          onConfirm={() => {
            if (privateDefault && !sharingMutation.isPending) sharingMutation.mutate(privateDefault);
          }}
        />

        {defaultKit && editorKit && defaultKit.kit_id !== editorKit.kitId ? (
          <div className="pointer-events-none fixed bottom-5 left-1/2 z-20 hidden -translate-x-1/2 rounded-full border border-border bg-popover/90 px-3.5 py-2 text-xs text-muted-foreground shadow-xl backdrop-blur md:block">
            <UiText id="editing_3b9ba1a2" />{" "}
            <span className="font-semibold text-foreground">
              {editorKit.name}
            </span>{" "}
            <UiText id="default_is_480efdec" /> {defaultKit.name}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BrandStateMessage({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div>
        <Palette className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {action}
      </div>
    </div>
  );
}

function BrandKitCard({
  kit,
  isDefault,
  selected,
  busy,
  onSelect,
  onMakeDefault,
  onDuplicate,
  onToggleSharing,
}: {
  kit: BrandKitListItem;
  isDefault: boolean;
  selected: boolean;
  busy: boolean;
  /** Owner Kits open the editor; a shared or built-in Kit is not edited here. */
  onSelect?: () => void;
  onMakeDefault: () => void;
  onDuplicate: () => void;
  /** Owner only (S28 "share with channel members"). */
  onToggleSharing?: () => void;
}) {
  const tAuto = useTranslations("Auto");
  const tTheme = useTranslations("NewTheme");
  const preview = kit.preview;
  const shared = kit.sharing?.shared_with_channel_members ?? false;
  const colors = preview ? Object.values(preview.colors).filter(Boolean) : [];
  const [lead = "#27272a", ...rest] = colors;
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card/30 transition",
        selected ? "border-primary/60 ring-1 ring-primary/30" : "border-border hover:border-foreground/20",
      )}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="absolute inset-0 z-0"
          aria-label={tTheme("brandLibrary.editKit", { name: kit.name })}
        />
      ) : null}
      {/* The kit at a glance: its lead colour with the title face on it, the other colours beside it. */}
      <div className="pointer-events-none relative z-10 flex h-28 overflow-hidden" aria-hidden="true">
        <div className="relative flex flex-1 items-end p-3" style={{ backgroundColor: lead }}>
          <span
            className="text-4xl font-semibold leading-none tracking-tight"
            style={{ color: readableOn(lead), fontFamily: preview ? `"${preview.title_font.family}", var(--font-sans)` : undefined }}
          >
            Aa
          </span>
        </div>
        {rest.length > 0 ? (
          <div className="flex w-16 flex-col">
            {rest.slice(0, 4).map((color, index) => (
              <span key={`${color}-${index}`} className="flex-1" style={{ backgroundColor: color }} />
            ))}
          </div>
        ) : null}
        {isDefault ? (
          <span className="absolute left-3 top-3"><DefaultBadge compact /></span>
        ) : null}
      </div>
      <div className="pointer-events-none relative z-10 flex items-start gap-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{kit.name}</p>
            {shared || kit.access_role === "shared_reader" ? (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-border px-2 text-[10.5px] font-medium text-muted-foreground">
                {tTheme("brandLibrary.sharedBadge")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {[
              preview?.title_font.family,
              preview ? (preview.caption_style_name === "auto" ? tAuto("auto_captions_753a7643") : formatLabel(preview.caption_style_name)) : null,
              formatUpdatedAt(kit.updated_at),
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy}
              className="pointer-events-auto -mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground focus-visible:opacity-100 disabled:opacity-50 group-hover:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
              aria-label={tTheme("brandLibrary.kitActions", { name: kit.name })}
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {!isDefault && kit.head_revision ? (
              <DropdownMenuItem onClick={onMakeDefault}>
                <BadgeCheck className="size-4" />{" "}
                <UiText id="make_default_7b2628d1" />
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="size-4" /> <UiText id="duplicate_972d5737" />
            </DropdownMenuItem>
            {onToggleSharing ? (
              <DropdownMenuItem onClick={onToggleSharing}>
                <Users className="size-4" />{" "}
                {tTheme(shared ? "brandLibrary.unshare" : "brandLibrary.share")}
              </DropdownMenuItem>
            ) : null}
            {onSelect ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSelect}>
                  <Pencil className="size-4" /> <UiText id="edit_kit_a3cbc2c9" />
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

/** Dark or light text, whichever reads on `color` (a hex colour). */
function readableOn(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#fff";
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.6 ? "#111" : "#fff";
}

function LogoAssetCard({
  channelId,
  slot,
  label,
  note,
  asset,
  onChange,
}: {
  channelId: string;
  slot: BrandLogoSlot;
  label: string;
  note: string;
  asset: BrandAssetRef | null;
  onChange: (asset: BrandAssetRef | null) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel/40 p-3">
      <AssetPreview channelId={channelId} asset={asset} label={label} />
      <div className="mb-3 mt-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <StorageMediaInput
        channelId={channelId}
        value={asset?.storageObjectId ?? ""}
        selectedName={asset?.name ?? undefined}
        mediaKind="image"
        uploadMetadata={{ asset_role: `brand_logo_${slot}` }}
        onChange={(selection) =>
          onChange(selection ? assetFromSelection(selection) : null)
        }
      />
    </div>
  );
}

function AssetPreview({
  channelId,
  asset,
  label,
}: {
  channelId: string;
  asset: BrandAssetRef | null;
  label: string;
}) {
  const thumbnail = useStorageThumbnailUrl({
    channelId,
    objectId: asset?.storageObjectId ?? "",
    enabled: Boolean(asset?.storageObjectId),
  });
  return (
    <div className="relative flex aspect-[16/8] items-center justify-center overflow-hidden rounded-xl border border-border bg-[linear-gradient(135deg,rgb(var(--muted)/0.55),rgb(var(--background)/0.4))]">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(45deg,currentColor_25%,transparent_25%),linear-gradient(-45deg,currentColor_25%,transparent_25%),linear-gradient(45deg,transparent_75%,currentColor_75%),linear-gradient(-45deg,transparent_75%,currentColor_75%)] [background-position:0_0,0_8px,8px_-8px,-8px_0] [background-size:16px_16px] text-muted-foreground/20" />
      {thumbnail.data?.url ? (
        <Image
          src={thumbnail.data.url}
          alt={`${label} preview`}
          fill
          unoptimized
          sizes="360px"
          className="object-contain p-5"
        />
      ) : asset ? (
        <div className="relative flex max-w-[85%] items-center gap-2 rounded-xl bg-background/70 px-3 py-2 text-xs text-foreground shadow backdrop-blur">
          <ImageIcon className="size-4 shrink-0 text-primary" />
          <span className="truncate">{asset.name ?? label}</span>
        </div>
      ) : (
        <div className="relative text-center text-muted-foreground">
          <ImageIcon className="mx-auto size-7 opacity-60" />
          <p className="mt-2 text-xs">
            <UiText id="no_asset_selected_74676645" />
          </p>
        </div>
      )}
    </div>
  );
}

function WatermarkEditor({
  channelId,
  kit,
  watermark,
  onChange,
}: {
  channelId: string;
  kit: BrandKitEditor;
  watermark: BrandWatermarkEditor;
  onChange: (watermark: BrandWatermarkEditor) => void;
}) {
  const tAuto = useTranslations("Auto");
  const tTheme = useTranslations("NewTheme");
  const resolvedAsset = resolveWatermarkAsset(watermark, kit.logos);
  const disabled = !watermark.enabled;
  const patch = (value: Partial<BrandWatermarkEditor>) =>
    onChange({ ...watermark, ...value });
  const primaryLogoLabel = kit.logos.primary
    ? kit.logos.primary.name ?? tTheme("brand.logos.primary")
    : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-panel/35 p-4 transition-opacity",
        disabled && "opacity-55",
      )}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <div>
            <FieldLabel>
              <UiText id="watermark_source_cd29e120" />
            </FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <ChoiceTile
                active={watermark.source === "primary_logo"}
                disabled={disabled}
                title={tAuto("primary_logo_43722ba1")}
                description={
                  primaryLogoLabel ?? tAuto("choose_it_in_logos_87f1717c")
                }
                onClick={() => patch({ source: "primary_logo" })}
              />
              <ChoiceTile
                active={watermark.source === "custom_asset"}
                disabled={disabled}
                title={tAuto("custom_asset_27c40180")}
                description={
                  watermark.asset
                    ? watermark.asset.name ?? tAuto("custom_asset_27c40180")
                    : tAuto("independent_image_bfe42537")
                }
                onClick={() => patch({ source: "custom_asset" })}
              />
            </div>
          </div>

          {watermark.source === "custom_asset" ? (
            <StorageMediaInput
              channelId={channelId}
              value={watermark.asset?.storageObjectId ?? ""}
              selectedName={watermark.asset?.name ?? undefined}
              mediaKind="image"
              disabled={disabled}
              uploadMetadata={{ asset_role: "brand_overlay_logo" }}
              onChange={(selection) =>
                patch({
                  asset: selection ? assetFromSelection(selection) : null,
                })
              }
            />
          ) : (
            <div className="rounded-xl border border-border bg-background/25 p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent">
                  <ImageIcon className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {primaryLogoLabel ??
                      tAuto("primary_logo_not_selected_3287ca29")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <UiText id="shared_with_the_logos_section_b29e27b2" />
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <FieldLabel>
              <UiText id="behavior_70cb647a" />
            </FieldLabel>
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              {WATERMARK_BEHAVIORS.map((behavior) => (
                <ChoiceTile
                  key={behavior.value}
                  active={watermark.animationMode === behavior.value}
                  disabled={disabled}
                  title={tTheme(behavior.labelKey)}
                  description={tTheme(behavior.descriptionKey)}
                  onClick={() => patch({ animationMode: behavior.value })}
                />
              ))}
            </div>
          </div>

          {watermark.animationMode !== "static" ? (
            <div className="grid grid-cols-2 gap-3">
              <NumberControl
                label={tAuto("change_every_3e43c06c")}
                suffix="sec"
                value={watermark.intervalSeconds}
                min={2}
                max={60}
                disabled={disabled}
                onChange={(intervalSeconds) =>
                  patch({
                    intervalSeconds,
                    fadeSeconds: Math.min(
                      watermark.fadeSeconds,
                      intervalSeconds / 2,
                    ),
                  })
                }
              />
              {watermark.animationMode === "fade_corner_cycle" ? (
                <NumberControl
                  label={tAuto("fade_time_b0a6128a")}
                  suffix="sec"
                  value={watermark.fadeSeconds}
                  min={0}
                  max={Math.min(1, watermark.intervalSeconds / 2)}
                  step={0.1}
                  disabled={disabled}
                  onChange={(fadeSeconds) => patch({ fadeSeconds })}
                />
              ) : (
                <div />
              )}
            </div>
          ) : null}
        </div>

        <div className="space-y-5 rounded-2xl border border-border bg-background/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                <UiText id="placement_ab89d05c" />
              </p>
              <p className="text-xs text-muted-foreground">
                <UiText id="auto_safe_avoids_common_ui_and_caption_zones_a32754db" />
              </p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => patch({ anchor: "auto_safe" })}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:pointer-events-none",
                watermark.anchor === "auto_safe"
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-panel/40 text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="mr-1.5 inline size-3.5" />{" "}
              <UiText id="auto_safe_1c01f14a" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
            <div className="grid aspect-video grid-cols-3 gap-1.5 rounded-xl border border-border bg-[radial-gradient(circle_at_50%_30%,rgb(var(--accent)/0.55),transparent_70%)] p-2.5">
              {WATERMARK_ANCHORS.map((anchor) => (
                <button
                  key={anchor.value}
                  type="button"
                  disabled={disabled || watermark.animationMode !== "static"}
                  aria-label={tTheme(anchor.labelKey)}
                  title={
                    watermark.animationMode !== "static"
                      ? tAuto(
                          "moving_watermarks_rotate_through_safe_corners_au_4e44e118",
                        )
                      : tTheme(anchor.labelKey)
                  }
                  onClick={() => patch({ anchor: anchor.value })}
                  className={cn(
                    "relative rounded-md border transition disabled:cursor-not-allowed",
                    watermark.anchor === anchor.value &&
                      watermark.animationMode === "static"
                      ? "border-primary/55 bg-primary/15"
                      : "border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.06]",
                  )}
                >
                  {watermark.anchor === anchor.value &&
                  watermark.animationMode === "static" ? (
                    <span
                      className="absolute inset-x-[22%] top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                      style={{
                        backgroundColor: kit.colors.primary,
                        opacity: watermark.opacity,
                      }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              <RangeControl
                label={tAuto("size_b7152342")}
                value={watermark.widthRatio * 100}
                min={3}
                max={30}
                step={1}
                disabled={disabled}
                onChange={(value) => patch({ widthRatio: value / 100 })}
              />
              <RangeControl
                label={tAuto("opacity_f0fa69f3")}
                value={watermark.opacity * 100}
                min={10}
                max={100}
                step={5}
                disabled={disabled}
                onChange={(value) => patch({ opacity: value / 100 })}
              />
              <RangeControl
                label={tAuto("safe_margin_cba4eff0")}
                value={watermark.marginRatio * 100}
                min={0}
                max={15}
                step={1}
                disabled={disabled}
                onChange={(value) => patch({ marginRatio: value / 100 })}
              />
            </div>
          </div>

          <label className="flex items-start justify-between gap-3 rounded-xl border border-border bg-panel/35 p-3">
            <span className="flex min-w-0 gap-2.5">
              <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  <UiText id="require_in_workflows_b1577736" />
                </span>
                <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                  <UiText id="block_workflow_launch_when_the_production_overla_0474cd95" />
                </span>
              </span>
            </span>
            <Switch
              checked={watermark.enforce}
              disabled={disabled}
              onCheckedChange={(enforce) => patch({ enforce })}
              aria-label={tAuto("require_watermark_in_workflows_4759b6f9")}
            />
          </label>

          {watermark.enabled && !resolvedAsset ? (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200">
              <UiText id="select_a_primary_logo_or_switch_to_a_custom_wate_756a5144" />
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ColorPickerField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  return (
    <div className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-panel/50 p-3 transition hover:border-primary/35">
      <label
        className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-inset ring-white/15 focus-within:ring-2 focus-within:ring-primary/60"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          aria-label={`Choose ${label} color`}
          onChange={(event) => {
            const nextValue = event.target.value.toUpperCase();
            setDraft(nextValue);
            onChange(nextValue);
          }}
          className="absolute -inset-3 size-16 cursor-pointer opacity-0"
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="relative w-28 shrink-0">
        <Input
          value={draft}
          aria-label={`${label} HEX color`}
          maxLength={7}
          onChange={(event) => setDraft(event.target.value.toUpperCase())}
          onBlur={() => {
            const normalized = normalizeHexColor(draft, value);
            setDraft(normalized);
            onChange(normalized);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="h-9 rounded-lg bg-background/35 pr-8 font-mono text-xs uppercase"
        />
        <Pencil className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

function CompactColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-panel/40 p-2.5 transition hover:border-primary/35">
      <span
        className="relative size-8 shrink-0 overflow-hidden rounded-lg ring-1 ring-inset ring-white/15"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="absolute -inset-3 size-14 cursor-pointer opacity-0"
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-foreground">
          {label}
        </span>
        <span className="block font-mono text-[10px] text-muted-foreground">
          {value}
        </span>
      </span>
    </label>
  );
}

/**
 * Title/body font of the Kit, picked from the P06-64 platform font catalogue: the chosen face is
 * pinned as `font_ref` (the publish checks it against the catalogue). Previews use the same font
 * files the browser already ships (`"<Family> Caption"` faces in globals.css).
 */
function TypographyCard({
  role,
  sample,
  font,
  options,
  loading,
  onChange,
}: {
  role: string;
  sample: string;
  font: BrandFontToken;
  options: BrandFontFamilyOption[];
  loading: boolean;
  onChange: (font: BrandFontToken) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const option = options.find((entry) => entry.family === font.family) ?? null;
  const cssFamily = option?.cssFamily ?? `"${font.family}", sans-serif`;
  return (
    <div className="rounded-2xl border border-border bg-panel/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {role}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {font.family} · {font.weight}
          </p>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg"
              disabled={loading || options.length === 0}
            >
              <UiText id="change_64fbd995" />{" "}
              <ChevronDown
                className={cn("size-3.5 transition", open && "rotate-180")}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-[min(420px,calc(100vw-2rem))] rounded-2xl border-border bg-popover/95 p-2 shadow-2xl backdrop-blur-xl"
          >
            <p className="px-2 pb-2 pt-1 text-xs font-semibold text-muted-foreground">
              <UiText id="choose_78b7c9f6" /> {role.toLowerCase()} font
            </p>
            <div className="space-y-1">
              {options.map((fontOptionItem) => {
                const active = fontOptionItem.family === font.family;
                return (
                  <button
                    key={fontOptionItem.family}
                    type="button"
                    onClick={() => {
                      onChange(nearestFontToken(fontOptionItem, font.weight));
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                      active
                        ? "border-primary/45 bg-primary/[0.08]"
                        : "border-transparent hover:border-border hover:bg-accent/50",
                    )}
                  >
                    <span
                      className="w-14 shrink-0 text-2xl leading-none text-foreground"
                      style={{
                        fontFamily: fontOptionItem.cssFamily,
                        fontWeight: fontOptionItem.faces.at(-1)?.weight,
                        fontStyle: fontOptionItem.italic ? "italic" : undefined,
                      }}
                    >
                      <UiText id="aa_2c419ecc" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        {fontOptionItem.family}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {fontOptionItem.faces.map((face) => face.weight).join(" · ")}
                      </span>
                    </span>
                    {active ? <SelectedMark /> : null}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div
        className="my-5 min-h-20 border-y border-border/70 py-4 text-2xl leading-tight text-foreground"
        style={{
          fontFamily: cssFamily,
          fontWeight: font.weight,
          fontStyle: option?.italic ? "italic" : undefined,
        }}
      >
        {sample}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">
          <UiText id="weight_69c0b815" />
        </span>
        <div className="flex gap-1.5">
          {(option?.faces ?? [{ weight: font.weight, fontRef: font.fontRef }]).map((face) => (
            <button
              key={face.weight}
              type="button"
              disabled={!option}
              onClick={() =>
                option && onChange({ family: option.family, weight: face.weight, fontRef: face.fontRef })
              }
              className={cn(
                "min-w-11 rounded-lg border px-2 py-1.5 text-xs transition",
                face.weight === font.weight
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {face.weight}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChoiceTile({
  active,
  disabled,
  title,
  description,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-w-0 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed",
        active
          ? "border-primary/50 bg-primary/[0.08]"
          : "border-border bg-panel/35 hover:border-primary/25 hover:bg-accent/40",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-foreground">
          {title}
        </span>
        {active ? <SelectedMark /> : null}
      </span>
      <span className="mt-1 block truncate text-[10px] text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{Math.round(value)}%</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(values) => onChange(values[0] ?? value)}
      />
    </div>
  );
}

function NumberControl({
  label,
  suffix,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <FieldLabel>{label}</FieldLabel>
      <span className="relative block">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) =>
            onChange(clamp(Number(event.target.value), min, max))
          }
          className="h-10 rounded-xl bg-background/35 pr-10"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </span>
    </label>
  );
}

function CreateBrandKitDialog({
  open,
  mode,
  name,
  selectedKitName,
  busy,
  onOpenChange,
  onModeChange,
  onNameChange,
  onCreate,
}: {
  open: boolean;
  mode: CreateMode;
  name: string;
  selectedKitName: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: CreateMode) => void;
  onNameChange: (name: string) => void;
  onCreate: () => void;
}) {
  const tAuto = useTranslations("Auto");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border bg-popover sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <UiText id="create_brand_kit_e082e2b6" />
          </DialogTitle>
          <DialogDescription>
            <UiText id="build_a_separate_visual_system_and_choose_the_de_5e92661d" />
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <label>
            <FieldLabel>
              <UiText id="kit_name_aea7f853" />
            </FieldLabel>
            <Input
              value={name}
              maxLength={80}
              autoFocus
              placeholder={tAuto("e_g_shorts_dark_42c0f58e")}
              onChange={(event) => onNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim()) onCreate();
              }}
              className="h-11 rounded-xl"
            />
          </label>
          <div>
            <FieldLabel>
              <UiText id="start_from_62a53f0b" />
            </FieldLabel>
            <div className="grid grid-cols-2 gap-3">
              <ChoiceTile
                active={mode === "blank"}
                disabled={false}
                title={tAuto("clean_kit_db3bcc5d")}
                description={tAuto("production_safe_defaults_e3736a03")}
                onClick={() => onModeChange("blank")}
              />
              <ChoiceTile
                active={mode === "duplicate"}
                disabled={!selectedKitName}
                title={tAuto("duplicate_current_287ae815")}
                description={selectedKitName}
                onClick={() => onModeChange("duplicate")}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            <UiText id="cancel_77dfd213" />
          </Button>
          <Button type="button" disabled={!name.trim() || busy} onClick={onCreate}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{" "}
            <UiText id="create_kit_15981083" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DefaultBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 font-semibold text-emerald-300",
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]",
      )}
    >
      <BadgeCheck className={compact ? "size-3" : "size-3.5"} />{" "}
      <UiText id="default_808d7dca" />
    </span>
  );
}

function SelectedMark() {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Check className="size-3" />
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function assetFromSelection(selection: StorageMediaSelection): BrandAssetRef {
  return {
    storageObjectId: selection.storageObjectId,
    name: selection.name,
    mimeType: selection.mimeType,
    width: selection.width,
    height: selection.height,
  };
}

function formatLabel(value: string) {
  if (value === "auto") return "Auto";
  if (value === "3d_pop") return "3D Pop";
  if (value === "youtube_clean") return "YouTube Clean";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const locale = typeof document === "undefined" ? "tr" : document.documentElement.lang || "tr";
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round((date.getTime() - Date.now()) / 86_400_000),
    "day",
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
