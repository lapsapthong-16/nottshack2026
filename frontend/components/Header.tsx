import Link from "next/link";

type HeaderProps = {
  packageName?: string;
  filesScanned?: number;
  filesTotal?: number;
  progress?: number; // 0-100
  auditPhase?: number;
};

export default function Header({
  packageName,
  filesScanned,
  filesTotal,
  progress,
  auditPhase,
}: HeaderProps) {
  const showProgress = packageName !== undefined;

  const isStep1Done = (auditPhase ?? 0) >= 6;
  const isStep2Done = (auditPhase ?? 0) >= 7;
  const isStep3Done = progress === 100;

  const isStep1Active = (auditPhase ?? 0) >= 1 && !isStep1Done;
  const isStep2Active = isStep1Done && !isStep2Done;
  const isStep3Active = isStep2Done && !isStep3Done;

  return (
    <header className="flex items-center border-b border-[#e0dbd4] bg-[#f0ebe4] px-6 py-3">
      <Link
        href="/"
        className="font-display text-lg font-bold tracking-tight text-[#1a1a1a] no-underline transition-opacity hover:opacity-80"
      >
        Validus
      </Link>

      {/* Nav links */}
      <nav className="ml-8 flex items-center gap-6">
        <Link
          href="/check"
          className="text-sm font-medium text-[#6b6b6b] no-underline transition-colors hover:text-[#1a1a1a]"
        >
          Audit
        </Link>
        <Link
          href="/report"
          className="text-sm font-medium text-[#6b6b6b] no-underline transition-colors hover:text-[#1a1a1a]"
        >
          Reports
        </Link>
        <Link
          href="/profile"
          className="text-sm font-medium text-[#6b6b6b] no-underline transition-colors hover:text-[#1a1a1a]"
        >
          Profile
        </Link>
      </nav>

      {showProgress && (
        <div className="ml-auto flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
            </span>
            <span className="text-sm font-semibold text-[#1a1a1a]">
              {packageName}
            </span>
          </div>

          {/* 3-Point Progress Indicator */}
          <div className="flex items-center gap-1.5" title="1. Scanning & Analysis, 2. Verification, 3. Summary">
            {/* Point 1: Auditor Agent */}
            <div className={`relative flex h-2.5 w-2.5 items-center justify-center rounded-full transition-colors ${isStep1Done ? "bg-[#4ade80]" : isStep1Active ? "bg-[#e8a85c]" : "bg-[#d6d0c8]"}`}>
              {isStep1Active && <div className="absolute h-full w-full animate-ping rounded-full bg-[#e8a85c] opacity-75"></div>}
            </div>
            <div className={`h-[2px] w-6 transition-colors duration-500 ${isStep1Done ? "bg-[#4ade80]" : "bg-[#d6d0c8]"}`} />

            {/* Point 2: Verifier Agent */}
            <div className={`relative flex h-2.5 w-2.5 items-center justify-center rounded-full transition-colors ${isStep2Done ? "bg-[#4ade80]" : isStep2Active ? "bg-[#e8a85c]" : "bg-[#d6d0c8]"}`}>
              {isStep2Active && <div className="absolute h-full w-full animate-ping rounded-full bg-[#e8a85c] opacity-75"></div>}
            </div>
            <div className={`h-[2px] w-6 transition-colors duration-500 ${isStep2Done ? "bg-[#4ade80]" : "bg-[#d6d0c8]"}`} />

            {/* Point 3: Summary / Finalization */}
            <div className={`relative flex h-2.5 w-2.5 items-center justify-center rounded-full transition-colors ${isStep3Done ? "bg-[#4ade80]" : isStep3Active ? "bg-[#e8a85c]" : "bg-[#d6d0c8]"}`}>
              {isStep3Active && <div className="absolute h-full w-full animate-ping rounded-full bg-[#e8a85c] opacity-75"></div>}
            </div>
          </div>

          {filesTotal !== undefined && (
            <span className="text-xs font-medium text-[#8a8580] w-[130px] text-right">
              {isStep3Done ? "Complete" :
                isStep3Active ? "Summarizing..." :
                  isStep2Active ? "Verifying..." :
                    `Scanning ${filesScanned ?? 0}/${filesTotal} files`}
            </span>
          )}

          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1a1a1a]" />
        </div>
      )}
    </header>
  );
}
