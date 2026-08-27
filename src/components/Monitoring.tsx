"use client";

import { useEffect } from "react";
import { initMonitoring } from "@/observability/monitor";

/**
 * Installs global client error monitoring once, app-wide. Renders nothing.
 * Mounted from the root layout so uncaught errors and unhandled rejections are
 * captured on every page.
 */
export default function Monitoring() {
  useEffect(() => {
    initMonitoring();
  }, []);
  return null;
}
