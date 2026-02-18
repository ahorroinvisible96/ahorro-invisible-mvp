"use client";

import { useEffect } from "react";
import { initTheme } from "@/styles/themes";

export default function ThemeInit() {
  useEffect(() => {
    initTheme();
  }, []);
  return null;
}
