import * as React from "react";

/**
 * The settings list frame and its label/value row, shared by the settings sections (extracted from `settings-page.tsx`
 * so new sections such as Approvals use the same rows; no visual change).
 */
export function SettingsList({ children }: { children: React.ReactNode }) {
  return <div className="w-full">{children}</div>;
}

export function SettingRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 border-b border-border py-4 transition-colors hover:bg-muted/25 sm:grid-cols-[minmax(140px,190px)_minmax(0,1fr)] sm:items-center">
      <div className="flex min-w-0 items-start gap-2">
        {Icon && (
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <p className="min-w-0 break-words text-sm font-semibold leading-5 text-foreground">
          {label}
        </p>
      </div>
      <div className="flex min-w-0 justify-start sm:justify-end">
        {children}
      </div>
    </div>
  );
}
