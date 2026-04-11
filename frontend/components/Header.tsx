import Link from "next/link";

type HeaderProps = {
  packageName?: string;
  filesScanned?: number;
  filesTotal?: number;
  progress?: number; // 0-100
};

export default function Header({
  packageName,
  filesScanned,
  filesTotal,
  progress,
}: HeaderProps) {
  const showProgress = packageName !== undefined;

  return (
    <header className="flex items-center border-b border-[#e0dbd4] bg-[#f0ebe4] px-6 py-3">
      <Link
        href="/"
        className="text-base font-bold tracking-tight text-[#1a1a1a] no-underline"
      >
        Validus
      </Link>

      {/* Nav links */}
      <nav className="ml-8 flex items-center gap-6">
        <Link
          href="/check"
          className="text-sm font-medium text-[#6b6b6b] no-underline transition hover:text-[#1a1a1a]"
        >
          Audit
        </Link>
        <Link
          href="/report"
          className="text-sm font-medium text-[#6b6b6b] no-underline transition hover:text-[#1a1a1a]"
        >
          Report
        </Link>
        <Link
          href="/profile"
          className="text-sm font-medium text-[#6b6b6b] no-underline transition hover:text-[#1a1a1a]"
        >
          Profile
        </Link>
      </nav>

      {showProgress && (
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#4ade80]" />
            <span className="text-sm font-medium text-[#1a1a1a]">
              {packageName}
            </span>
          </div>

          {/* Progress bar — smooth continuous */}
          <div className="flex items-center gap-2">
            <div className="h-[4px] w-32 rounded-full bg-[#d6d0c8] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#4ade80]"
                style={{
                  width: `${progress ?? 0}%`,
                  transition: "width 0.6s ease-in-out",
                }}
              />
            </div>
            <span className="text-[11px] font-medium text-[#8a8580] tabular-nums">
              {progress ?? 0}%
            </span>
          </div>

          {filesTotal !== undefined && (
            <span className="text-xs text-[#8a8580]">
              {filesScanned ?? 0}/{filesTotal} files
            </span>
          )}

          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1a1a1a]" />
        </div>
      )}
    </header>
  );
}
