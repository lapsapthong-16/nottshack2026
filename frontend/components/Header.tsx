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
        <div className="ml-auto flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
            </span>
            <span className="text-sm font-semibold text-[#1a1a1a]">
              {packageName}
            </span>
          </div>

          <div className="h-4 w-px bg-black/10" />

          {/* Progress indicators */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => {
                const segmentProgress = ((progress ?? 0) / 100) * 5;
                const filled = i < segmentProgress;
                return (
                  <div key={i} className="flex items-center gap-0.5">
                    <div
                      className={`h-1 w-4 rounded-full transition-colors duration-500 ${
                        filled ? "bg-green-500" : "bg-black/10"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {filesTotal !== undefined && (
              <span className="font-mono text-[10px] font-medium tracking-tighter text-[#8a8580]">
                {filesScanned ?? 0}/{filesTotal}
              </span>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
