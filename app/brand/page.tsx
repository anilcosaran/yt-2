"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { WorkspaceRouteLoading } from "@/components/common/workspace-route-loading";
import { BrandView } from "@/components/new-theme/brand-view";

export default function BrandPage() {
  return (
    <React.Suspense fallback={<WorkspaceRouteLoading />}>
      <BrandPageContent />
    </React.Suspense>
  );
}

function BrandPageContent() {
  const searchParams = useSearchParams();
  return (
    <BrandView
      section={searchParams.get("section") ?? undefined}
      kitId={searchParams.get("kit") ?? undefined}
    />
  );
}
