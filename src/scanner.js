const fs = require("fs");
const path = require("path");

const ALWAYS_IGNORE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".turbo",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
  ".env",
  "vendor",
  ".idea",
  ".vscode",
];

const IGNORE_EXTENSIONS = [
  ".lock",
  ".log",
  ".map",
  ".min.js",
  ".min.css",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".ico",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".mp4",
  ".mp3",
  ".mov",
];

function readIgnoreFile(filePath) {
  const rules = [];
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        rules.push(trimmed.replace(/\/$/, ""));
      }
    });
  }
  return rules;
}

function getGitignoreRules(rootDir) {
  return readIgnoreFile(path.join(rootDir, ".gitignore"));
}

function getCodebriefIgnoreRules(rootDir) {
  return readIgnoreFile(path.join(rootDir, ".codebriefignore"));
}

function shouldIgnore(name, gitignoreRules) {
  if (ALWAYS_IGNORE.includes(name)) return true;
  if (
    name.startsWith(".") &&
    !name.startsWith(".cursor") &&
    name !== ".env.example"
  )
    return true;
  if (gitignoreRules.includes(name)) return true;
  return false;
}

function hasIgnoredExtension(filename) {
  return IGNORE_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

function scanDirectory(rootDir, maxDepth = 4) {
  const gitignoreRules = getGitignoreRules(rootDir);
  const codebriefIgnoreRules = getCodebriefIgnoreRules(rootDir);
  const allIgnoreRules = [...gitignoreRules, ...codebriefIgnoreRules];
  const tree = [];

  function walk(dir, depth) {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    // Sort: dirs first, then files
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (shouldIgnore(entry.name, allIgnoreRules)) continue;
      if (!entry.isDirectory() && hasIgnoredExtension(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        tree.push({ type: "dir", path: relativePath, name: entry.name, depth });
        walk(fullPath, depth + 1);
      } else {
        const stat = fs.statSync(fullPath);
        tree.push({
          type: "file",
          path: relativePath,
          name: entry.name,
          depth,
          size: stat.size,
        });
      }
    }
  }

  walk(rootDir, 0);
  return tree;
}

module.exports = { scanDirectory };
