"use client";
export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="bento-card space-y-4 p-6"><h1 className="text-xl font-semibold">Unable to load this page</h1><p className="text-sm text-[#515154]">The workspace could not complete your request. Try again, or contact your admin if the issue continues.</p><button onClick={reset} className="apple-btn-primary">Try again</button></section>;
}
