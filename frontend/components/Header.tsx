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
        href="/landing"
        className="text-base font-bold tracking-tight text-[#1a1a1a] no-underline"
      >
        npmguard
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

          {/* Progress bar */}
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => {
              const segmentProgress = ((progress ?? 0) / 100) * 5;
              const filled = i < segmentProgress;
              return (
                <div key={i} className="flex items-center gap-1">
                  <div
                    className={`h-[3px] w-5 rounded-full ${
                      filled ? "bg-[#4ade80]" : "bg-[#c5c0b8]"
                    }`}
                  />
                  {i < 4 && (
                    <span
                      className={`inline-block h-1 w-1 rounded-full ${
                        filled ? "bg-[#4ade80]" : "bg-[#c5c0b8]"
                      }`}
                    />
                  )}
                </div>
              );
            })}
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
