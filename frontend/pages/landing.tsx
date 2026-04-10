import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Header from "@/components/Header";

export default function Landing() {
  const router = useRouter();
  const [packageName, setPackageName] = useState("");
  const [version, setVersion] = useState("latest");

  const examples = ["event-stream", "ua-parser-js", "colors"];

  function handleAudit() {
    if (!packageName.trim()) return;
    const query: Record<string, string> = { name: packageName.trim() };
    if (version.trim() && version.trim() !== "latest") {
      query.version = version.trim();
    }
    void router.push({ pathname: "/check", query });
  }

  function handleExampleClick(name: string) {
    setPackageName(name);
    setVersion("latest");
    void router.push({ pathname: "/check", query: { name } });
  }

  return (
    <>
      <Head>
        <title>npmguard – Know what you install</title>
      </Head>

      <div className="min-h-screen bg-[#f0ebe4] text-[#1a1a1a]">
        <Header />

        {/* Hero */}
        <main className="flex flex-col items-center px-6 pt-28 pb-20">
          <h1 className="text-center text-5xl font-bold leading-[1.15] tracking-tight text-[#1a1a1a] sm:text-6xl md:text-7xl">
            Know what
            <br />
            you install.
          </h1>

          <p className="mt-6 text-center text-sm leading-6 text-[#6b6b6b]">
            AI-powered security audit for npm packages.
            <br />
            Results published on-chain.
          </p>

          {/* Search bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAudit();
            }}
            className="mt-10 flex items-center gap-0 overflow-hidden rounded-xl border border-[#d6d0c8] bg-white shadow-sm"
          >
            <input
              type="text"
              placeholder="package name"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              className="w-44 border-none bg-transparent px-5 py-3.5 text-sm text-[#1a1a1a] placeholder-[#a8a8a8] outline-none sm:w-56"
            />
            <div className="h-6 w-px bg-[#d6d0c8]" />
            <input
              type="text"
              placeholder="latest"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-20 border-none bg-transparent px-4 py-3.5 text-sm text-[#1a1a1a] placeholder-[#a8a8a8] outline-none sm:w-24"
            />
            <button
              type="submit"
              className="ml-1 mr-1.5 cursor-pointer rounded-lg bg-[#b8a9c8] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#a494b4]"
            >
              Audit
            </button>
          </form>

          {/* Example packages */}
          <div className="mt-6 flex items-center gap-4">
            {examples.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => handleExampleClick(name)}
                className="cursor-pointer border-none bg-transparent font-mono text-xs tracking-wide text-[#a8a09a] transition hover:text-[#6b6b6b]"
              >
                {name}
              </button>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
