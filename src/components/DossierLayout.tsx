import React from 'react';

export interface DossierLayoutProps {
  /** Optional top telemetry or developer integrity banner */
  telemetryBar?: React.ReactNode;
  /** Masthead header component slot */
  header?: React.ReactNode;
  /** Center stage (coordinate rulers + 1024x768 sandbox) slot */
  stage?: React.ReactNode;
  /** 6-line Western Union telegram dispatch pad slot */
  dispatchPad?: React.ReactNode;
  /** Declassified Forensic Audit Report panel slot (unsealed on case closure) */
  exhibitsPanel?: React.ReactNode;
  /** Optional modal or share overlay dialog slot */
  modal?: React.ReactNode;
  /** Standard children slot for flexible layout composition */
  children?: React.ReactNode;
  /** Optional additional CSS classes applied to the broadsheet container */
  className?: string;
}

export const DossierLayout: React.FC<DossierLayoutProps> = ({
  telemetryBar,
  header,
  stage,
  dispatchPad,
  exhibitsPanel,
  modal,
  children,
  className = '',
}) => {
  return (
    <div className="min-h-screen bg-dossier-bg text-dossier-ink p-3 md:p-6 antialiased font-mono-clean">
      {/* Optional Top Telemetry / Status Bar */}
      {telemetryBar && (
        <div className="max-w-6xl mx-auto mb-4">
          {telemetryBar}
        </div>
      )}

      {/* Main Archival Broadsheet Dossier Container */}
      <main
        className={`max-w-6xl mx-auto bg-dossier-paper text-dossier-ink border-2 border-dossier-ink shadow-ink-lg p-4 md:p-6 transition-all ${className}`}
      >
        {/* Header Slot */}
        {header}

        {/* Center Sandbox Stage Slot */}
        {stage && <section className="mb-5">{stage}</section>}

        {/* Telegram Dispatch Pad Slot */}
        {dispatchPad && <section className="mb-5">{dispatchPad}</section>}

        {/* Declassified Exhibits / Audit Report Slot */}
        {exhibitsPanel && <section className="mt-6">{exhibitsPanel}</section>}

        {/* Flexible Children Slot */}
        {children}
      </main>

      {/* Modal / Dialog Overlay Slot */}
      {modal}
    </div>
  );
};

export default DossierLayout;
