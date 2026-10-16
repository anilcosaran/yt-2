"use client";

import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Captions,
  Check,
  ChevronDown,
  Copy,
  Droplet,
  ImageIcon,
  LayoutGrid,
  Loader2,
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

import { BrandColorPicker } from "@/components/new-theme/brand-color-picker";
import {
  StorageMediaInput,
  type StorageMediaSelection,
} from "@/components/storage/storage-media-input";
import { CaptionStylePicker } from "@/components/tools/caption-style-picker";
import { AvatarStudioView } from "@/components/brand/avatar/avatar-studio-view";
import { BrandVoicePage } from "@/components/brand/voice/brand-voice-page";
import {
  CAPTION_STYLE_NAMES,
  CaptionStyleThumbnail,
  CaptionVideoPreview,
  getCaptionPresetPalette,
} from "@/components/tools/caption-style-preview-field";
import { AppAlertDialog } from "@/components/ui/app-alert-dialog";
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
  PopoverAnchor,
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
  type BrandKitRevision,
} from "@/lib/brand-kit/api";
import { BrandWatermarkAssetRequiredError, saveBrandKit } from "@/lib/brand-kit/save-kit";
import {
  draftContentChanged,
  draftContentFromEditor,
  editorFromDraft,
  fontFamilyOptions,
  nearestFontToken,
  normalizeHexColor,
  overlayFromWatermark,
  resolveWatermarkAsset,
  watermarkChanged,
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
import { useToolCopy } from "@/lib/i18n/use-tool-copy";

type CreateMode = "blank" | "duplicate";

const COLOR_META: Array<{
  key: BrandColorKey;
  labelKey: string;
  roleKey: string;
}> = [
  {
    key: "primary",
    labelKey: "brand.colors.primary",
    roleKey: "brandEditor.colors.roles.graphics",
  },
  {
    key: "secondary",
    labelKey: "brand.colors.secondary",
    roleKey: "brandEditor.colors.roles.backgrounds",
  },
  {
    key: "tertiary",
    labelKey: "brand.colors.tertiary",
    roleKey: "brandEditor.colors.roles.secondaryText",
  },
  {
    key: "accent",
    labelKey: "brand.colors.accent",
    roleKey: "brandEditor.colors.roles.highlights",
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
 * P06-01: the Kit editor sections, in page order (the editor is one page; `?section=` scrolls to
 * one). The former local-only "Effects & transitions" section has no server field (the typed Video
 * style section is P06-36), so it is not offered until that lands.
 */
const EDITOR_SECTIONS = ["colors", "fonts", "captions", "logos", "watermark"] as const;

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

/** The caption styles offered up front; every other style is one click away in the gallery. */
const QUICK_CAPTION_STYLES = [
  "auto",
  "tiktok_bold",
  "youtube_clean",
  "karaoke_white_to_yellow",
  "candy_depth",
  "box_black",
  "minimal_shadow",
];

/** The style "Auto" is previewed with until a video picks its own. */
const AUTO_CAPTION_PREVIEW_STYLE = "tiktok_bold";

/** One block of the Kit editor: what it is, a line on what it does, then its controls. */
function EditorSection({
  id,
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-border bg-card/30 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-panel">
            <Icon className="size-[18px] text-primary" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
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

/** A published revision as a draft body (a draft's logos only carry the storage object id). */
function revisionDraftContent(revision: BrandKitRevision): BrandKitDraftContent {
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

  // A shared or built-in Kit has no draft for this actor: it opens with its published look, and
  // "Save" keeps the changes as a new Kit of the actor's own.
  const readOnlyRevisionId = detail && !detail.draft ? detail.head_revision?.revision_id ?? null : null;
  const revisionQuery = useQuery({
    queryKey: [...brandKitQueryKey(editingKitId ?? ""), "revision", readOnlyRevisionId],
    queryFn: ({ signal }) =>
      getBrandKitRevision(editingKitId ?? "", readOnlyRevisionId ?? "", { signal }),
    enabled: Boolean(editingKitId && readOnlyRevisionId),
  });
  const editorSource = React.useMemo(() => {
    if (!detail) return null;
    if (detail.draft) return detail;
    if (!revisionQuery.data) return null;
    return { ...detail, draft: { version: 0, content: revisionDraftContent(revisionQuery.data) } };
  }, [detail, revisionQuery.data]);
  const ownsKit = Boolean(detail?.draft);

  // Form state of the Kit; re-seeded only when another Kit or draft version loads, so a
  // background refetch never overwrites unsaved edits. It is never written to browser storage.
  const [editor, setEditor] = React.useState<BrandKitEditor | null>(null);
  const [watermark, setWatermark] = React.useState<BrandWatermarkEditor | null>(null);
  const seededRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!editorSource?.draft) return;
    const seed = `${editorSource.kit_id}:${editorSource.draft.version}`;
    if (seededRef.current === seed) return;
    seededRef.current = seed;
    const next = editorFromDraft(editorSource);
    setEditor(next);
    setWatermark(
      watermarkFromOverlay(channelOverlay, next.logos.primary?.storageObjectId ?? null),
    );
  }, [editorSource, channelOverlay]);

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [createMode, setCreateMode] = React.useState<CreateMode>("blank");
  const [newKitName, setNewKitName] = React.useState("");
  const [shareTarget, setShareTarget] = React.useState<BrandKitListItem | null>(null);
  const [privateDefault, setPrivateDefault] = React.useState<BrandKitListItem | null>(null);

  const editorReady = Boolean(editor && editor.kitId === kitId);
  React.useEffect(() => {
    if (!section) return;
    const targetSection =
      section === "kits" ? "brand-kits" : `brand-${section}`;
    window.requestAnimationFrame(() => {
      document
        .getElementById(targetSection)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [section, editorReady]);

  const refreshBrand = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: brandKitsQueryKey(channelId) }),
      queryClient.invalidateQueries({ queryKey: brandKitBindingQueryKey(channelId) }),
    ]);
  }, [channelId, queryClient]);

  const openKitEditor = React.useCallback(
    (nextKitId: string) => {
      router.push(`/brand?section=${EDITOR_SECTIONS[0]}&kit=${encodeURIComponent(nextKitId)}`);
    },
    [router],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeChannel || !detail || !editorSource?.draft || !editor || !watermark) {
        throw new Error("Brand Kit is not loaded yet.");
      }
      if (!detail.draft) {
        // Not the actor's Kit: the edited look becomes a Kit of their own; the watermark is the channel's.
        if (watermark.enabled && !resolveWatermarkAsset(watermark, editor.logos)) {
          throw new BrandWatermarkAssetRequiredError();
        }
        const name = editor.name.trim();
        const created = await createBrandKit({
          channelId: activeChannel.id,
          name: (name && name !== detail.name ? name : tTheme("brand.copyName", { name: detail.name })).slice(0, 80),
          clientRequestId: newBrandKitClientRequestId(),
          content: draftContentFromEditor(editor, editorSource.draft.content),
        });
        if (watermarkChanged(watermark, editor.logos, channelOverlay)) {
          await updateChannelSettings({
            channelId: activeChannel.id,
            expectedBrandOverlayVersion: activeChannel.settings.brandOverlayVersion,
            brandOverlay: overlayFromWatermark(watermark, editor.logos),
          });
          await refreshChannels();
        }
        return created.kit_id;
      }
      const saved = await saveBrandKit(
        {
          editor,
          baseContent: detail.draft.content,
          baseName: detail.name,
          watermark,
          channelId: activeChannel.id,
          overlay: channelOverlay,
          overlayVersion: activeChannel.settings.brandOverlayVersion,
        },
        { updateBrandKitDraft, publishBrandKitRevision, updateChannelSettings },
      );
      if (saved.overlaySaved) await refreshChannels();
      return null;
    },
    onSuccess: async (copyKitId) => {
      if (copyKitId) {
        await refreshBrand();
        openKitEditor(copyKitId);
        toast.success(tTheme("brand.toast.duplicated"));
        return;
      }
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
    return revisionDraftContent(await getBrandKitRevision(source.kit_id, source.head_revision.revision_id));
  }

  const selectedListItem =
    kits.find((kit) => kit.kit_id === editingKitId) ?? null;
  const duplicateSource = kits.find((kit) => kit.kit_id === effectiveKitId) ?? kits[0] ?? null;

  const openCreateDialog = () => {
    setNewKitName("");
    setCreateMode("blank");
    setCreateDialogOpen(true);
  };

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
    if (!editorSource) {
      if (readOnlyRevisionId && revisionQuery.isPending) return <WorkspaceRouteLoading />;
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
  const baseContent = editorSource?.draft?.content ?? null;
  const dirty = Boolean(
    editorKit &&
      detail &&
      baseContent &&
      watermark &&
      ((editorKit.name.trim() || detail.name) !== detail.name ||
        draftContentChanged(draftContentFromEditor(editorKit, baseContent), baseContent) ||
        watermarkChanged(watermark, editorKit.logos, channelOverlay)),
  );

  const dialogs = (
    <>
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
    </>
  );

  if (editorKit && watermark) {
    return (
      <div className="hg-scrollbar relative h-full flex-1 overflow-y-auto bg-background">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[920px] items-center gap-2 px-4 py-3 md:px-8">
            <Link
              href="/brand?section=kits"
              aria-label={tTheme("brandEditor.back")}
              title={tTheme("brandEditor.back")}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <Input
              value={editorKit.name}
              maxLength={80}
              aria-label={tTheme("brandEditor.nameLabel")}
              onChange={(event) =>
                updateEditor((kit) => ({ ...kit, name: event.target.value }))
              }
              onBlur={() => {
                if (!editorKit.name.trim() && detail) {
                  updateEditor((kit) => ({ ...kit, name: detail.name }));
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              style={{ width: `${Math.max(8, editorKit.name.length + 3)}ch` }}
              className="h-9 min-w-0 max-w-xs shrink rounded-lg border-transparent bg-transparent px-2 text-lg font-semibold shadow-none hover:border-border focus-visible:border-border md:text-lg"
            />
            {editorIsDefault ? <DefaultBadge /> : null}
            <span
              className={cn(
                "ml-auto hidden items-center gap-1.5 text-xs sm:flex",
                ownsKit && dirty ? "text-amber-300" : "text-muted-foreground",
              )}
              role="status"
            >
              {!ownsKit ? null : dirty ? (
                <span className="size-1.5 rounded-full bg-amber-400" />
              ) : (
                <Check className="size-3.5" />
              )}
              {tTheme(
                !ownsKit
                  ? selectedListItem?.origin === "builtin"
                    ? "brandEditor.builtinHint"
                    : "brandEditor.sharedHint"
                  : dirty
                    ? "brandEditor.unsaved"
                    : "brandEditor.saved",
              )}
            </span>
            {!editorIsDefault && selectedListItem?.head_revision ? (
              <Button
                type="button"
                variant="outline"
                disabled={defaultMutation.isPending}
                onClick={() => defaultMutation.mutate(selectedListItem)}
                className="ml-auto h-9 shrink-0 rounded-full px-4 sm:ml-0"
              >
                {tTheme("brandEditor.makeDefault")}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={(ownsKit && !dirty) || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className={cn(
                "h-9 shrink-0 rounded-full px-4",
                (editorIsDefault || !selectedListItem?.head_revision) && "ml-auto sm:ml-0",
              )}
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : ownsKit ? (
                <Save className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {tTheme(ownsKit ? "brandEditor.save" : "brandEditor.saveCopy")}
            </Button>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4 px-4 py-6 md:px-8">
          <EditorSection
            id="brand-colors"
            icon={Palette}
            title={tTheme("brandEditor.colors.title")}
            description={tTheme("brandEditor.colors.description")}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {COLOR_META.map((color) => (
                <ColorTile
                  key={color.key}
                  label={tTheme(color.labelKey)}
                  description={tTheme(color.roleKey)}
                  value={editorKit.colors[color.key]}
                  swatches={Object.values(editorKit.colors)}
                  onChange={(value) =>
                    updateEditor((kit) => ({
                      ...kit,
                      colors: { ...kit.colors, [color.key]: value },
                    }))
                  }
                />
              ))}
            </div>
          </EditorSection>

          <EditorSection
            id="brand-fonts"
            icon={Type}
            title={tTheme("brandEditor.fonts.title")}
            description={tTheme("brandEditor.fonts.description")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FontCard
                label={tTheme("brandEditor.fonts.titleRole")}
                sample={tTheme("brandEditor.fonts.titleSample")}
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
              <FontCard
                label={tTheme("brandEditor.fonts.bodyRole")}
                sample={tTheme("brandEditor.fonts.bodySample")}
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
          </EditorSection>

          <EditorSection
            id="brand-captions"
            icon={Captions}
            title={tTheme("brandEditor.captions.title")}
            description={tTheme("brandEditor.captions.description")}
          >
            <CaptionsEditor
              captions={editorKit.captions}
              onChange={(captions) => updateEditor((kit) => ({ ...kit, captions }))}
            />
          </EditorSection>

          <EditorSection
            id="brand-logos"
            icon={ImageIcon}
            title={tTheme("brandEditor.logo.title")}
            description={tTheme("brandEditor.logo.description")}
          >
            <LogosEditor
              channelId={activeChannel.id}
              logos={editorKit.logos}
              onChange={(slot, asset) =>
                updateEditor((kit) => ({
                  ...kit,
                  logos: { ...kit.logos, [slot]: asset },
                }))
              }
            />
          </EditorSection>

          <EditorSection
            id="brand-watermark"
            icon={Droplet}
            title={tTheme("brandEditor.watermark.title")}
            description={tTheme("brandEditor.watermark.description")}
            action={
              <Switch
                checked={watermark.enabled}
                aria-label={tTheme("brandEditor.watermark.enable")}
                onCheckedChange={(enabled) =>
                  setWatermark((current) => (current ? { ...current, enabled } : current))
                }
              />
            }
          >
            <div
              inert={!watermark.enabled}
              className={cn("transition-opacity", !watermark.enabled && "opacity-45")}
            >
              <WatermarkEditor
                channelId={activeChannel.id}
                kit={editorKit}
                watermark={watermark}
                onChange={setWatermark}
              />
            </div>
          </EditorSection>
        </div>

        {dialogs}
      </div>
    );
  }

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
        </nav>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              {tAuto("brand_kits_f149e70b")}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {tTheme("brand.channelDescription", {
                channel: activeChannel.name,
              })}
            </p>
          </div>
          <Button
            type="button"
            onClick={openCreateDialog}
            className="ml-auto h-9 rounded-full px-4"
          >
            <Plus className="size-4" />
            {tAuto("new_kit_62d16f19")}
          </Button>
        </div>

        <section id="brand-kits" className="mt-9 scroll-mt-4">
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
                onSelect={() => openKitEditor(kit.kit_id)}
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
              onClick={openCreateDialog}
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

        {dialogs}
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
  /** Opens the Kit in the editor; a shared or built-in Kit is saved from there as a copy. */
  onSelect: () => void;
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
      <button
        type="button"
        onClick={onSelect}
        className="absolute inset-0 z-0"
        aria-label={tTheme("brandLibrary.editKit", { name: kit.name })}
      />
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
            {shared || kit.access_role !== "owner" ? (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-border px-2 text-[10.5px] font-medium text-muted-foreground">
                {tTheme(kit.origin === "builtin" ? "brandLibrary.builtinBadge" : "brandLibrary.sharedBadge")}
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSelect}>
              <Pencil className="size-4" /> <UiText id="edit_kit_a3cbc2c9" />
            </DropdownMenuItem>
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

/** The Kit's logo, with the two optional versions folded away until they are needed. */
function LogosEditor({
  channelId,
  logos,
  onChange,
}: {
  channelId: string;
  logos: BrandKitEditor["logos"];
  onChange: (slot: BrandLogoSlot, asset: BrandAssetRef | null) => void;
}) {
  const tTheme = useTranslations("NewTheme");
  const [primary, ...others] = LOGO_META;
  return (
    <>
      <LogoAssetCard
        wide
        channelId={channelId}
        slot={primary!.key}
        label={tTheme(primary!.labelKey)}
        note={tTheme(primary!.noteKey)}
        asset={logos[primary!.key]}
        onChange={(asset) => onChange(primary!.key, asset)}
      />
      <Collapsible defaultOpen={others.some((logo) => logos[logo.key])}>
        <CollapsibleTrigger className="group mt-3 flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-muted-foreground transition hover:text-foreground">
          <ChevronDown className="size-4 transition group-data-[state=open]:rotate-180" />
          {tTheme("brandEditor.logo.more")}
        </CollapsibleTrigger>
        <CollapsibleContent className="grid gap-3 pt-3 sm:grid-cols-2">
          {others.map((logo) => (
            <LogoAssetCard
              key={logo.key}
              channelId={channelId}
              slot={logo.key}
              label={tTheme(logo.labelKey)}
              note={tTheme(logo.noteKey)}
              asset={logos[logo.key]}
              onChange={(asset) => onChange(logo.key, asset)}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

function LogoAssetCard({
  channelId,
  slot,
  label,
  note,
  asset,
  wide = false,
  onChange,
}: {
  channelId: string;
  slot: BrandLogoSlot;
  label: string;
  note: string;
  asset: BrandAssetRef | null;
  /** Preview beside the picker instead of above it. */
  wide?: boolean;
  onChange: (asset: BrandAssetRef | null) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-panel/40 p-3",
        wide && "sm:flex sm:items-center sm:gap-4",
      )}
    >
      <div className={cn(wide && "sm:w-56 sm:shrink-0")}>
        <AssetPreview channelId={channelId} asset={asset} label={label} />
      </div>
      <div className={cn("min-w-0 flex-1", wide ? "mt-3 sm:mt-0" : "mt-3")}>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mb-3 text-xs text-muted-foreground">{note}</p>
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

/** Where a watermark anchored at `anchor` sits in the preview frame (left/top, so a move animates). */
function watermarkAnchorStyle(
  anchor: Exclude<BrandOverlayAnchor, "auto_safe">,
  marginRatio: number,
): React.CSSProperties {
  const margin = `${Math.max(2, marginRatio * 100)}%`;
  const [vertical, horizontal] = anchor === "center" ? ["middle", "center"] : anchor.split("_");
  const place = (edge: string | undefined, start: string, end: string) =>
    edge === start
      ? ([margin, "0"] as const)
      : edge === end
        ? ([`calc(100% - ${margin})`, "-100%"] as const)
        : (["50%", "-50%"] as const);
  const [left, shiftX] = place(horizontal, "left", "right");
  const [top, shiftY] = place(vertical, "top", "bottom");
  return { left, top, transform: `translate(${shiftX}, ${shiftY})` };
}

const WATERMARK_CORNERS = ["top_right", "bottom_right", "bottom_left", "top_left"] as const;

/**
 * The watermark on a sample video frame: the logo is drawn where it will sit, at its size and
 * opacity, and a click on the frame moves it. The rarely changed settings are under "Advanced".
 */
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
  const tTheme = useTranslations("NewTheme");
  const resolvedAsset = resolveWatermarkAsset(watermark, kit.logos);
  const image = useStorageThumbnailUrl({
    channelId,
    objectId: resolvedAsset?.storageObjectId ?? "",
    enabled: Boolean(resolvedAsset),
  });
  const moving = watermark.animationMode !== "static";
  const auto = watermark.anchor === "auto_safe";
  // "Auto" and a moving watermark start top right, away from the caption area.
  const shownAnchor = moving || watermark.anchor === "auto_safe" ? "top_right" : watermark.anchor;
  const patch = (value: Partial<BrandWatermarkEditor>) =>
    onChange({ ...watermark, ...value });
  const mark = (anchor: Exclude<BrandOverlayAnchor, "auto_safe">, ghost: boolean) => (
    <span
      key={ghost ? anchor : "mark"}
      className="pointer-events-none absolute aspect-square transition-all duration-200"
      style={{
        ...watermarkAnchorStyle(anchor, watermark.marginRatio),
        width: `${watermark.widthRatio * 100}%`,
        opacity: ghost ? watermark.opacity * 0.3 : watermark.opacity,
      }}
    >
      {image.data?.url ? (
        <Image
          src={image.data.url}
          alt=""
          fill
          unoptimized
          sizes="128px"
          className="object-contain"
        />
      ) : (
        <span className="flex size-full items-center justify-center rounded-md border border-dashed border-white/60 text-white/80">
          <ImageIcon className="size-1/2" />
        </span>
      )}
    </span>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div>
          <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_30%_25%,#475569,transparent_55%),linear-gradient(135deg,#1e293b,#0b1120)]">
            {/* Where captions usually sit, so the logo's distance from them can be judged. */}
            <span className="absolute bottom-[14%] left-1/2 h-[5%] w-[44%] -translate-x-1/2 rounded-full bg-white/25" />
            <span className="absolute bottom-[7%] left-1/2 h-[5%] w-[30%] -translate-x-1/2 rounded-full bg-white/15" />
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
              {WATERMARK_ANCHORS.map((anchor) => {
                const active = !moving && !auto && watermark.anchor === anchor.value;
                return (
                  <button
                    key={anchor.value}
                    type="button"
                    disabled={moving}
                    aria-pressed={active}
                    aria-label={tTheme(anchor.labelKey)}
                    title={moving ? undefined : tTheme(anchor.labelKey)}
                    onClick={() => patch({ anchor: anchor.value })}
                    className={cn(
                      "border border-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed",
                      active ? "bg-white/[0.08]" : "enabled:hover:bg-white/[0.08]",
                    )}
                  />
                );
              })}
            </div>
            {moving
              ? WATERMARK_CORNERS.filter((corner) => corner !== shownAnchor).map((corner) =>
                  mark(corner, true),
                )
              : null}
            {mark(shownAnchor, false)}
          </div>
          <p className="mt-2 text-xs leading-4 text-muted-foreground">
            {tTheme(
              moving
                ? "brandEditor.watermark.movingHint"
                : auto
                  ? "brandEditor.watermark.autoHint"
                  : "brandEditor.watermark.frameHint",
            )}
          </p>
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <FieldLabel>{tTheme("brandEditor.watermark.position")}</FieldLabel>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/35 py-1.5 pl-3 pr-1.5">
              <span className="truncate text-sm text-foreground">
                {moving
                  ? tTheme(
                      WATERMARK_BEHAVIORS.find((behavior) => behavior.value === watermark.animationMode)
                        ?.labelKey ?? "brand.behaviors.move",
                    )
                  : auto
                    ? tTheme("brandEditor.watermark.auto")
                    : tTheme(
                        WATERMARK_ANCHORS.find((anchor) => anchor.value === watermark.anchor)?.labelKey ??
                          "brand.anchors.topRight",
                      )}
              </span>
              <button
                type="button"
                disabled={moving}
                aria-pressed={auto}
                onClick={() => patch({ anchor: "auto_safe" })}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                  auto && !moving
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground enabled:hover:bg-accent/60 enabled:hover:text-foreground",
                )}
              >
                <Sparkles className="mr-1 inline size-3" />
                {tTheme("brandEditor.watermark.auto")}
              </button>
            </div>
          </div>
          <RangeControl
            label={tTheme("brandEditor.watermark.size")}
            value={watermark.widthRatio * 100}
            min={3}
            max={30}
            step={1}
            disabled={false}
            onChange={(value) => patch({ widthRatio: value / 100 })}
          />
          <RangeControl
            label={tTheme("brandEditor.watermark.opacity")}
            value={watermark.opacity * 100}
            min={10}
            max={100}
            step={5}
            disabled={false}
            onChange={(value) => patch({ opacity: value / 100 })}
          />
          <div>
            <FieldLabel>{tTheme("brandEditor.watermark.image")}</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <ChoiceTile
                active={watermark.source === "primary_logo"}
                disabled={false}
                title={tTheme("brandEditor.watermark.useLogo")}
                description={
                  kit.logos.primary
                    ? kit.logos.primary.name ?? tTheme("brand.logos.primary")
                    : tTheme("brandEditor.watermark.useLogoMissing")
                }
                onClick={() => patch({ source: "primary_logo" })}
              />
              <ChoiceTile
                active={watermark.source === "custom_asset"}
                disabled={false}
                title={tTheme("brandEditor.watermark.customImage")}
                description={
                  watermark.asset?.name ?? tTheme("brandEditor.watermark.customImageHint")
                }
                onClick={() => patch({ source: "custom_asset" })}
              />
            </div>
            {watermark.source === "custom_asset" ? (
              <div className="mt-2">
                <StorageMediaInput
                  channelId={channelId}
                  value={watermark.asset?.storageObjectId ?? ""}
                  selectedName={watermark.asset?.name ?? undefined}
                  mediaKind="image"
                  uploadMetadata={{ asset_role: "brand_overlay_logo" }}
                  onChange={(selection) =>
                    patch({
                      asset: selection ? assetFromSelection(selection) : null,
                    })
                  }
                />
              </div>
            ) : null}
            {!resolvedAsset ? (
              <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200">
                {tTheme("brandEditor.watermark.needsLogo")}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <Collapsible
        defaultOpen={moving || watermark.enforce}
        className="border-t border-border pt-3"
      >
        <CollapsibleTrigger className="group flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-muted-foreground transition hover:text-foreground">
          <ChevronDown className="size-4 transition group-data-[state=open]:rotate-180" />
          {tTheme("brandEditor.watermark.advanced")}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          <div>
            <FieldLabel>{tTheme("brandEditor.watermark.movement")}</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-3">
              {WATERMARK_BEHAVIORS.map((behavior) => (
                <ChoiceTile
                  key={behavior.value}
                  active={watermark.animationMode === behavior.value}
                  disabled={false}
                  title={tTheme(behavior.labelKey)}
                  description={tTheme(behavior.descriptionKey)}
                  onClick={() => patch({ animationMode: behavior.value })}
                />
              ))}
            </div>
          </div>

          {moving ? (
            <div className="grid grid-cols-2 gap-3">
              <NumberControl
                label={tTheme("brandEditor.watermark.changeEvery")}
                suffix={tTheme("brandEditor.watermark.seconds")}
                value={watermark.intervalSeconds}
                min={2}
                max={60}
                disabled={false}
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
                  label={tTheme("brandEditor.watermark.fade")}
                  suffix={tTheme("brandEditor.watermark.seconds")}
                  value={watermark.fadeSeconds}
                  min={0}
                  max={Math.min(1, watermark.intervalSeconds / 2)}
                  step={0.1}
                  disabled={false}
                  onChange={(fadeSeconds) => patch({ fadeSeconds })}
                />
              ) : null}
            </div>
          ) : null}

          <RangeControl
            label={tTheme("brandEditor.watermark.margin")}
            value={watermark.marginRatio * 100}
            min={0}
            max={15}
            step={1}
            disabled={false}
            onChange={(value) => patch({ marginRatio: value / 100 })}
          />

          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel/35 p-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {tTheme("brandEditor.watermark.required")}
              </span>
              <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                {tTheme("brandEditor.watermark.requiredHint")}
              </span>
            </span>
            <Switch
              checked={watermark.enforce}
              onCheckedChange={(enforce) => patch({ enforce })}
              aria-label={tTheme("brandEditor.watermark.required")}
            />
          </label>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ColorTile({
  label,
  description,
  value,
  swatches,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  /** The Kit's colours, offered as shortcuts in the picker. */
  swatches: string[];
  onChange: (value: string) => void;
}) {
  const tTheme = useTranslations("NewTheme");
  // The typed HEX while the field has focus; outside of that the field shows the Kit's colour.
  const [draft, setDraft] = React.useState<string | null>(null);
  // The picker opens from the HEX field, not from the swatch.
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const pickerRef = React.useRef<HTMLDivElement>(null);
  return (
    <div className="min-w-0 rounded-xl border border-border bg-panel/40 p-2.5 transition hover:border-primary/35">
      <div className="h-16 rounded-lg ring-1 ring-inset ring-white/10" style={{ backgroundColor: value }} aria-hidden />
      <p className="mt-2.5 truncate text-sm font-semibold text-foreground">{label}</p>
      <p className="truncate text-xs text-muted-foreground">{description}</p>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="mt-2">
            <Input
              value={draft ?? value}
              aria-label={tTheme("brandEditor.colors.hex", { label })}
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              maxLength={7}
              onFocus={() => setPickerOpen(true)}
              onClick={() => setPickerOpen(true)}
              onChange={(event) => {
                const typed = event.target.value.toUpperCase();
                setDraft(typed);
                const hex = normalizeHexColor(typed, "");
                if (hex) onChange(hex);
              }}
              onBlur={() => setDraft(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setPickerOpen(false);
                  event.currentTarget.blur();
                } else if (event.key === "ArrowDown" && pickerOpen) {
                  event.preventDefault();
                  pickerRef.current?.querySelector<HTMLElement>("[data-color-area]")?.focus();
                }
              }}
              className="h-8 rounded-lg bg-background/35 font-mono text-xs uppercase"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          ref={pickerRef}
          align="start"
          className="w-64 rounded-xl p-3"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
        >
          <BrandColorPicker value={value} swatches={swatches} onChange={onChange} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Caption look of the Kit: a few styles up front, the whole gallery behind the last tile, and the
 * style's own colours until one is changed here.
 */
function CaptionsEditor({
  captions,
  onChange,
}: {
  captions: BrandKitEditor["captions"];
  onChange: (captions: BrandKitEditor["captions"]) => void;
}) {
  const tTheme = useTranslations("NewTheme");
  const toolCopy = useToolCopy();
  const styleLabel = (styleName: string) =>
    styleName === "auto"
      ? tTheme("brandEditor.captions.auto")
      : toolCopy(formatLabel(styleName)) ?? formatLabel(styleName);
  const previewStyle = (styleName: string) =>
    styleName === "auto" ? AUTO_CAPTION_PREVIEW_STYLE : styleName;
  const palette = getCaptionPresetPalette(previewStyle(captions.styleName));
  const pickStyle = (styleName: string) => {
    const next = getCaptionPresetPalette(previewStyle(styleName));
    onChange({
      styleName,
      fontColor: next.fontColor,
      highlightColor: next.highlightColor,
      effectColor: next.effectColor,
    });
  };
  const customColors =
    captions.fontColor.toUpperCase() !== palette.fontColor ||
    (palette.supportsHighlight && captions.highlightColor.toUpperCase() !== palette.highlightColor) ||
    (palette.supportsEffect && captions.effectColor.toUpperCase() !== palette.effectColor);
  const otherStyle = QUICK_CAPTION_STYLES.includes(captions.styleName)
    ? null
    : captions.styleName;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="min-w-0 space-y-4">
        <div>
          <FieldLabel>{tTheme("brandEditor.captions.style")}</FieldLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUICK_CAPTION_STYLES.map((styleName) => {
              const selected = captions.styleName === styleName;
              return (
                <button
                  key={styleName}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pickStyle(styleName)}
                  className={cn(
                    "caption-style-card min-w-0 overflow-hidden rounded-xl border p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-primary/60 bg-primary/[0.08]"
                      : "border-border bg-panel/35 hover:border-primary/35 hover:bg-accent/35",
                  )}
                >
                  <div className="relative h-16 overflow-hidden rounded-lg">
                    <CaptionStyleThumbnail
                      styleName={previewStyle(styleName)}
                      compact
                      active={selected}
                    />
                    {selected ? (
                      <span className="absolute right-1.5 top-1.5">
                        <SelectedMark />
                      </span>
                    ) : null}
                  </div>
                  <span className="flex items-center gap-1 px-1 pb-0.5 pt-1.5 text-xs font-medium text-foreground">
                    {styleName === "auto" ? (
                      <Sparkles className="size-3 shrink-0 text-primary" />
                    ) : null}
                    <span className="truncate">{styleLabel(styleName)}</span>
                  </span>
                </button>
              );
            })}
            <CaptionStylePicker
              value={captions.styleName}
              options={CAPTION_OPTIONS}
              resolvedStyleName={AUTO_CAPTION_PREVIEW_STYLE}
              onValueChange={pickStyle}
              trigger={
                <button
                  type="button"
                  className={cn(
                    "caption-style-card min-w-0 overflow-hidden rounded-xl border p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    otherStyle
                      ? "border-primary/60 bg-primary/[0.08]"
                      : "border-dashed border-border hover:border-primary/35 hover:bg-accent/35",
                  )}
                >
                  <div className="relative flex h-16 items-center justify-center overflow-hidden rounded-lg text-muted-foreground">
                    {otherStyle ? (
                      <>
                        <CaptionStyleThumbnail styleName={otherStyle} compact active />
                        <span className="absolute right-1.5 top-1.5">
                          <SelectedMark />
                        </span>
                      </>
                    ) : (
                      <LayoutGrid className="size-5" />
                    )}
                  </div>
                  <span className="flex items-center gap-1 px-1 pb-0.5 pt-1.5 text-xs font-medium text-foreground">
                    <span className="truncate">
                      {otherStyle
                        ? styleLabel(otherStyle)
                        : tTheme("brandEditor.captions.allStyles", {
                            count: CAPTION_STYLE_NAMES.length,
                          })}
                    </span>
                    <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                  </span>
                </button>
              }
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel>{tTheme("brandEditor.captions.colors")}</FieldLabel>
            {customColors ? (
              <button
                type="button"
                onClick={() => pickStyle(captions.styleName)}
                className="mb-1.5 text-xs font-medium text-primary hover:underline"
              >
                {tTheme("brandEditor.captions.resetColors")}
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <CompactColorField
              label={tTheme("brandEditor.captions.text")}
              value={captions.fontColor}
              onChange={(fontColor) => onChange({ ...captions, fontColor })}
            />
            {palette.supportsHighlight ? (
              <CompactColorField
                label={tTheme("brandEditor.captions.highlight")}
                value={captions.highlightColor}
                onChange={(highlightColor) => onChange({ ...captions, highlightColor })}
              />
            ) : null}
            {palette.supportsEffect ? (
              <CompactColorField
                label={tTheme("brandEditor.captions.outline")}
                value={captions.effectColor}
                onChange={(effectColor) => onChange({ ...captions, effectColor })}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="h-[320px] min-h-0">
        <CaptionVideoPreview
          media={{
            name: tTheme("brand.captionSample"),
            previewUrl: null,
            width: 1080,
            height: 1920,
            durationSeconds: 12,
          }}
          styleName={captions.styleName}
          fontSize={48}
          captionPosition="auto"
          showDetails={false}
          visibilityOverrides={{
            visibility_enabled: true,
            font_color: captions.fontColor,
            highlight_color: captions.highlightColor,
            effect_color: captions.effectColor,
            shadow_strength: "strong",
          }}
        />
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
function FontCard({
  label,
  sample,
  font,
  options,
  loading,
  onChange,
}: {
  label: string;
  sample: string;
  font: BrandFontToken;
  options: BrandFontFamilyOption[];
  loading: boolean;
  onChange: (font: BrandFontToken) => void;
}) {
  const tTheme = useTranslations("NewTheme");
  const [open, setOpen] = React.useState(false);
  const option = options.find((entry) => entry.family === font.family) ?? null;
  const faceStyle: React.CSSProperties = {
    fontFamily: option?.cssFamily ?? `"${font.family}", sans-serif`,
    fontWeight: font.weight,
    fontStyle: option?.italic ? "italic" : undefined,
  };
  const weightLabel = (weight: number) =>
    tTheme(
      `brandEditor.fonts.weights.${
        weight <= 300 ? "light" : weight <= 500 ? "regular" : weight <= 700 ? "bold" : "extraBold"
      }`,
    );
  return (
    <div className="min-w-0 rounded-xl border border-border bg-panel/40 p-3.5">
      <FieldLabel>{label}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={loading || options.length === 0}
            className="flex h-11 w-full items-center gap-3 rounded-lg border border-border bg-background/35 px-3 text-left transition hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <span className="min-w-0 flex-1 truncate text-base text-foreground" style={faceStyle}>
              {font.family}
            </span>
            <ChevronDown
              className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[var(--radix-popover-trigger-width)] min-w-64 rounded-xl border-border bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl"
        >
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
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
                  active ? "bg-primary/[0.08]" : "hover:bg-accent/60",
                )}
              >
                <span
                  className="min-w-0 flex-1 truncate text-lg text-foreground"
                  style={{
                    fontFamily: fontOptionItem.cssFamily,
                    fontWeight: fontOptionItem.faces.at(-1)?.weight,
                    fontStyle: fontOptionItem.italic ? "italic" : undefined,
                  }}
                >
                  {fontOptionItem.family}
                </span>
                {active ? <Check className="size-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
      <p className="mt-3 min-h-14 text-xl leading-snug text-foreground" style={faceStyle}>
        {sample}
      </p>
      {option && option.faces.length > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            {tTheme("brandEditor.fonts.weight")}
          </span>
          <div className="flex gap-1.5">
            {option.faces.map((face) => (
              <button
                key={face.weight}
                type="button"
                aria-pressed={face.weight === font.weight}
                onClick={() =>
                  onChange({ family: option.family, weight: face.weight, fontRef: face.fontRef })
                }
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs transition",
                  face.weight === font.weight
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {weightLabel(face.weight)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
