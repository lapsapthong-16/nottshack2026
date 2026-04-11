export type UnpkgNode = {
  type: string;
  path: string;
  size?: number;
  files?: UnpkgNode[];
};

export function extractFiles(node: UnpkgNode): UnpkgNode[] {
  let result: UnpkgNode[] = [];
  if (node.type !== "directory" && node.path) {
    result.push(node);
  }
  if (node.files && Array.isArray(node.files)) {
    for (const child of node.files) {
      result = result.concat(extractFiles(child));
    }
  }
  return result;
}

export async function fetchPackageCode(name: string, version: string) {
  const metaRes = await fetch(`https://unpkg.com/${name}@${version}/?meta`);
  if (!metaRes.ok) throw new Error(`Failed to fetch package metadata from unpkg (${metaRes.status})`);

  const meta: UnpkgNode = await metaRes.json();
  const allFiles = extractFiles(meta);

  // Filter for code files and sort by importance
  const codeFiles = allFiles
    .filter(
      (f) =>
        (f.size ?? 0) < 400000 && // Increased max absolute limit to 400KB
        (f.path.endsWith(".js") ||
          f.path.endsWith(".ts") ||
          f.path.endsWith(".json") ||
          f.path.endsWith(".md"))
    )
    .sort((a, b) => {
      if (a.path === "/package.json") return -1;
      if (b.path === "/package.json") return 1;
      return (a.size ?? 0) - (b.size ?? 0);
    });

  const MAX_TOTAL_SIZE = 80000;
  const chunks: string[] = [];
  const chunkFileMap: string[][] = []; // tracks which files are in each chunk
  const fileContentMap: Record<string, string> = {}; // caches actual file content per path
  let currentChunk = "";
  let currentChunkFiles: string[] = [];
  const fetchedFiles: { path: string; size: number }[] = [];

  for (const file of codeFiles) {
    const fileSize = file.size ?? 0;
    
    // If adding this file exceeds the normal chunk limit, flush the current chunk first
    if (currentChunk.length + fileSize > MAX_TOTAL_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk);
        chunkFileMap.push(currentChunkFiles);
        currentChunk = "";
        currentChunkFiles = [];
    }

    try {
      const fileRes = await fetch(`https://unpkg.com/${name}@${version}${file.path}`);
      if (fileRes.ok) {
        const content = await fileRes.text();
        
        // If the file is extremely large, give it its own dedicated chunk for a single agent
        if (content.length > MAX_TOTAL_SIZE) {
            chunks.push(`\n--- FILE: ${file.path} ---\n${content}\n`);
            chunkFileMap.push([file.path]);
            fileContentMap[file.path] = content;
            fetchedFiles.push({ path: file.path, size: content.length });
        } else {
            currentChunk += `\n--- FILE: ${file.path} ---\n${content}\n`;
            currentChunkFiles.push(file.path);
            fileContentMap[file.path] = content;
            fetchedFiles.push({ path: file.path, size: content.length });
        }
      }
    } catch {
      // skip failed files
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
    chunkFileMap.push(currentChunkFiles);
  }

  return {
    chunks: chunks.length > 0 ? chunks : ["No readable code files found."],
    chunkFileMap: chunkFileMap.length > 0 ? chunkFileMap : [[]],
    fileContentMap,
    fetchedFiles,
    totalFiles: allFiles.length,
  };
}
