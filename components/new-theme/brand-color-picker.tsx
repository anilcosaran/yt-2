"use client";

import * as React from "react";
import { Pipette } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Hue in degrees (0-360), saturation and value as 0-1. */
type Hsv = { h: number; s: number; v: number };
type Rgb = { r: number; g: number; b: number };

type EyeDropperWindow = Window & {
  EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
};

const HUE_TRACK = "linear-gradient(to right, #F00, #FF0, #0F0, #0FF, #00F, #F0F, #F00)";
const AREA_KEY_STEP = 0.02;

/**
 * Colour picker of the Brand Kit editor: a saturation/brightness area, a hue slider, RGB fields, the
 * screen eyedropper where the browser has one, and the Kit's other colours as shortcuts. It reads and
 * writes `#RRGGBB`; the HEX field itself belongs to the caller.
 */
export function BrandColorPicker({
  value,
  swatches,
  onChange,
}: {
  value: string;
  swatches: string[];
  onChange: (value: string) => void;
}) {
  const t = useTranslations("NewTheme.brandEditor.colors.picker");
  const hex = rgbToHex(hexToRgb(value));
  const [hsv, setHsv] = React.useState<Hsv>(() => rgbToHsv(hexToRgb(value)));
  // The colour changed outside the picker (typed HEX, another Kit): follow it, but keep the hue a grey or black has lost.
  if (hsvToHex(hsv) !== hex) {
    const next = rgbToHsv(hexToRgb(value));
    setHsv(next.s === 0 || next.v === 0 ? { ...next, h: hsv.h } : next);
  }

  const update = (next: Hsv) => {
    setHsv(next);
    onChange(hsvToHex(next));
  };
  const rgb = hsvToRgb(hsv);
  const setChannel = (channel: keyof Rgb, raw: string) => {
    const next = rgbToHsv({ ...rgb, [channel]: clamp(Math.round(Number(raw) || 0), 0, 255) });
    update(next.s === 0 || next.v === 0 ? { ...next, h: hsv.h } : next);
  };

  const pickAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    update({
      h: hsv.h,
      s: clamp((event.clientX - box.left) / box.width, 0, 1),
      v: 1 - clamp((event.clientY - box.top) / box.height, 0, 1),
    });
  };
  const nudge = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? AREA_KEY_STEP * 5 : AREA_KEY_STEP;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: clamp(hsv.s - step, 0, 1) },
      ArrowRight: { s: clamp(hsv.s + step, 0, 1) },
      ArrowUp: { v: clamp(hsv.v + step, 0, 1) },
      ArrowDown: { v: clamp(hsv.v - step, 0, 1) },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    update({ ...hsv, ...move });
  };

  const ScreenEyeDropper = typeof window === "undefined" ? undefined : (window as EyeDropperWindow).EyeDropper;
  const pickFromScreen = async () => {
    if (!ScreenEyeDropper) return;
    try {
      const picked = await new ScreenEyeDropper().open();
      onChange(rgbToHex(hexToRgb(picked.sRGBHex)));
    } catch {
      // The user left the eyedropper with Escape.
    }
  };

  const shortcuts = Array.from(new Set(swatches.map((swatch) => rgbToHex(hexToRgb(swatch))))).filter(
    (swatch) => swatch !== hex,
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        role="slider"
        tabIndex={0}
        data-color-area=""
        aria-label={t("area")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.v * 100)}
        aria-valuetext={hex}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pickAt(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) pickAt(event);
        }}
        onKeyDown={nudge}
        className="relative h-36 w-full cursor-crosshair touch-none rounded-lg ring-1 ring-inset ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{
          backgroundColor: `hsl(${hsv.h} 100% 50%)`,
          backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #FFF, transparent)",
        }}
      >
        <span
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hex }}
        />
      </div>

      <div className="flex items-center gap-2">
        {ScreenEyeDropper ? (
          <button
            type="button"
            onClick={() => void pickFromScreen()}
            aria-label={t("eyedropper")}
            title={t("eyedropper")}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pipette className="size-4" />
          </button>
        ) : null}
        <input
          type="range"
          min={0}
          max={360}
          value={Math.round(hsv.h)}
          aria-label={t("hue")}
          onChange={(event) => update({ ...hsv, h: Number(event.target.value) })}
          className={cn(
            "h-3 w-full cursor-pointer appearance-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(0,0,0,0.45)]",
            "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-transparent [&::-moz-range-thumb]:shadow-[0_0_0_1px_rgba(0,0,0,0.45)]",
          )}
          style={{ backgroundImage: HUE_TRACK }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["r", "g", "b"] as const).map((channel) => (
          <label key={channel} className="flex flex-col gap-1">
            <Input
              type="number"
              min={0}
              max={255}
              value={rgb[channel]}
              aria-label={t(channel)}
              onChange={(event) => setChannel(channel, event.target.value)}
              className="h-8 rounded-lg bg-background/35 px-2 text-center font-mono text-xs [appearance:textfield] md:text-xs [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-center text-[10px] font-medium uppercase text-muted-foreground">{channel}</span>
          </label>
        ))}
      </div>

      {shortcuts.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <span className="text-[11px] font-medium text-muted-foreground">{t("kitColors")}</span>
          <div className="flex flex-wrap gap-1.5">
            {shortcuts.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => onChange(swatch)}
                aria-label={t("useColor", { color: swatch })}
                title={swatch}
                className="size-6 rounded-md ring-1 ring-inset ring-white/15 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** `#RRGGBB` as channels; anything else reads as black. */
function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!match) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
}

function rgbToHex({ r, g, b }: Rgb) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max / 255 };
}

function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const channel = (offset: number) => {
    const k = (offset + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return { r: channel(5), g: channel(3), b: channel(1) };
}

function hsvToHex(hsv: Hsv) {
  return rgbToHex(hsvToRgb(hsv));
}
