"use client";

import { useEffect } from "react";

export function ChunkReloader() {
  useEffect(() => {
    const handler = (event: any) => {
      const error = event?.reason || event?.error;
      if (
        error?.name === "ChunkLoadError" ||
        /Loading chunk [\d]+ failed/i.test(error?.message)
      ) {
        window.location.reload();
      }
    };

    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", handler);

    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", handler);
    };
  }, []);

  return null;
}
