import Image from "next/image";

export function SignalpostLoader({
  label = "Loading your workspace",
}: {
  label?: string;
}) {
  return (
    <div className="signalpost-loader" role="status" aria-live="polite">
      <div className="signalpost-loader-card">
        <div className="signalpost-loader-mark">
          <Image src="/favicon.svg" alt="" width={42} height={42} priority />
          <span className="signalpost-loader-pulse" />
        </div>
        <p className="signalpost-loader-brand">Signalpost</p>
        <p className="signalpost-loader-label">{label}</p>
        <div className="signalpost-loader-track" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
