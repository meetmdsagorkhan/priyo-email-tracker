"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./overview.module.css";

export function OverviewRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        className={styles.refreshButton}
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
        aria-label={pending ? "Refreshing overview" : "Refresh overview"}
      >
        <RefreshCw
          size={15}
          className={pending ? styles.spinning : undefined}
          aria-hidden
        />
        <span>{pending ? "Refreshing…" : "Refresh"}</span>
      </button>
      <span className="sr-only" role="status">
        {pending ? "Refreshing workspace data." : ""}
      </span>
    </>
  );
}
