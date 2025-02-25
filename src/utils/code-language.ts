type LanguageMap = {
  [key: string]: string;
};

// Mapping file extensions to language identifiers for syntax highlighting
const languageMapping: LanguageMap = {
  // JavaScript and TypeScript
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  mjs: "javascript",
  cjs: "javascript",

  // Web technologies
  html: "html",
  htm: "html",
  xhtml: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",

  // Data formats
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  svg: "svg",

  // Backend languages
  py: "python",
  rb: "ruby",
  php: "php",
  java: "java",
  cs: "csharp",
  go: "go",
  rs: "rust",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",

  // Shell and scripting
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",

  // Markup and documentation
  md: "markdown",
  mdx: "markdown",

  // Configuration files
  toml: "toml",
  ini: "ini",
  conf: "ini",

  // Framework-specific
  astro: "tsx", // Rendering Astro as TSX
  svelte: "svelte",
  vue: "vue",

  // Database
  sql: "sql",

  // Other
  graphql: "graphql",
  gql: "graphql",
  dockerfile: "dockerfile",
};

/**
 * Determines the appropriate syntax highlighting language based on a filename
 *
 * @param filename - The filename or path to analyze
 * @returns The language identifier for syntax highlighting
 */
export function getLanguageFromFilename(filename: string): string {
  if (!filename) return "text";

  // Extract filename from path if needed
  const baseName = filename.split("/").pop() || filename;

  // Special case for files like "Dockerfile" with no extension
  if (baseName.toLowerCase() === "dockerfile") return "dockerfile";
  if (baseName.toLowerCase() === "makefile") return "makefile";

  // Extract extension (lowercase)
  const ext = baseName.split(".").pop()?.toLowerCase() || "";

  // Return the mapped language or default to "text"
  return languageMapping[ext] || "text";
}
