"use client";

import React from "react";
import { usePathname } from "next/navigation";
import DashboardLayout from "./(dashboard)/layout";

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const useDashboardLayout = ["/dashboard", "/profile", "/history", "/settings"].some((p) =>
    pathname?.startsWith(p)
  );

  if (useDashboardLayout) {
    return <DashboardLayout>{children}</DashboardLayout>;
  }

  return <>{children}</>;
}
