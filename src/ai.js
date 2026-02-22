"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const { getDefaultModel, getAllProviders } = require("./models");

// ── File sampler ─────────────────────────────────────────────
// Reads the most informative source files up to a character budget
const IMPORTANT_PATTERNS = [
  "package.json",
  "tsconfig.json",
  "next.config.*",
  "nuxt.config.*",
  "vite.config.*",
  "webpack.config.*",
  "tailwind.config.*",
  "postcss.config.*",
  "prisma/schema.prisma",
  "drizzle.config.*",
  ".env.example",
  "docker-compose.*",
  "Dockerfile",
  "src/index.*",
  "src/main.*",
  "src/app.*",
  "src/server.*",
  "src/config.*",
  "src/routes.*",
  "src/middleware.*",
  "lib/db.*",
  "lib/auth.*",
  "lib/utils.*",
  "app/layout.*",
  "app/page.*",
  "app/api/**/route.*",
  "pages/_app.*",
  "pages/index.*",
  "server/index.*",
  "server/api/**",
  "controllers/*",
  "models/*",
  "services/*",
];

function sampleSourceFiles(rootDir, fileTree, charBudget = 32000) {
  const samples = [];
  let budget = charBudget;

  // Smart read: for large files, take head + tail to capture imports AND exports/env vars
  function smartRead(filePath, maxChars) {
    const raw = fs.readFileSync(filePath, "utf-8");
    if (raw.length <= maxChars) return raw;
    const head = Math.floor(maxChars * 0.6);
    const tail = maxChars - head - 20; // 20 for separator
    return raw.slice(0, head) + "\n// ... (truncated) ...\n" + raw.slice(-tail);
  }

  // First pass: prioritised files (generous budget — these are the most important)
  for (const pattern of IMPORTANT_PATTERNS) {
    const full = path.join(rootDir, pattern);
    if (fs.existsSync(full)) {
      try {
        const content = smartRead(full, 6000);
        samples.push({ file: pattern, content });
        budget -= content.length;
        if (budget <= 0) break;
      } catch {
        /* skip unreadable */
      }
    }
  }

  // Second pass: remaining source files from tree (js/ts/py/go/rs etc.)
  const sourceExts = new Set([
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".vue",
    ".svelte",
    ".py",
    ".go",
    ".rs",
    ".rb",
    ".php",
    ".java",
    ".cs",
  ]);

  for (const entry of fileTree) {
    if (budget <= 0) break;
    if (entry.type !== "file") continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!sourceExts.has(ext)) continue;

    const full = path.join(rootDir, entry.path || entry.name);
    // Skip already-read files
    if (samples.some((s) => full.endsWith(s.file))) continue;

    try {
      const content = smartRead(full, 4000);
      samples.push({
        file: entry.path || entry.name,
        content,
      });
      budget -= content.length;
    } catch {
      /* skip */
    }
  }

  return samples;
}

// ── Env var extractor ────────────────────────────────────────
// Scans all source files for process.env.XXX references
function extractEnvVars(rootDir, fileTree) {
  const envVars = new Map(); // name → [files]
  const sourceExts = new Set([
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".vue",
    ".svelte",
    ".py",
    ".go",
    ".rs",
    ".rb",
    ".php",
  ]);
  const envRegex = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
  const dotenvRegex = /^([A-Z_][A-Z0-9_]*)=/gm;

  for (const entry of fileTree) {
    if (entry.type !== "file") continue;
    const ext = path.extname(entry.name).toLowerCase();
    const name = entry.name.toLowerCase();
    if (!sourceExts.has(ext) && !name.startsWith(".env")) continue;

    const full = path.join(rootDir, entry.path || entry.name);
    try {
      const raw = fs.readFileSync(full, "utf-8");
      const regex = name.startsWith(".env") ? dotenvRegex : envRegex;
      let match;
      while ((match = regex.exec(raw)) !== null) {
        const varName = match[1];
        // Skip generic placeholder names
        if (varName === "XXX" || varName.length < 3) continue;
        if (!envVars.has(varName)) envVars.set(varName, []);
        const file = entry.path || entry.name;
        if (!envVars.get(varName).includes(file))
          envVars.get(varName).push(file);
      }
    } catch {
      /* skip */
    }
  }

  return envVars;
}

// ── Export extractor ─────────────────────────────────────────
// Scans all source files for key function/class exports
function extractExports(rootDir, fileTree) {
  const exports = [];
  const sourceExts = new Set([".js", ".ts", ".jsx", ".tsx"]);
  const patterns = [
    /(?:module\.exports\s*=\s*\{([^}]+)\})/g,
    /(?:exports\.(\w+)\s*=)/g,
    /(?:export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+))/g,
  ];

  for (const entry of fileTree) {
    if (entry.type !== "file") continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!sourceExts.has(ext)) continue;

    const full = path.join(rootDir, entry.path || entry.name);
    try {
      const raw = fs.readFileSync(full, "utf-8");
      const file = entry.path || entry.name;
      for (const regex of patterns) {
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(raw)) !== null) {
          exports.push({ file, exports: match[1] || match[0] });
        }
      }
    } catch {
      /* skip */
    }
  }

  return exports;
}

// ── Prompt builder ───────────────────────────────────────────
function buildPrompt(analysis, fileTree, fileSamples, envVars, fileExports) {
  const fileList = fileTree
    .slice(0, 120)
    .map((e) =>
      e.type === "dir" ? `  ${e.path || e.name}/` : `  ${e.path || e.name}`,
    )
    .join("\n");

  const samplesText = fileSamples
    .map((s) => `### ${s.file}\n\`\`\`\n${s.content}\n\`\`\``)
    .join("\n\n");

  const scripts =
    Object.entries(analysis.scripts)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n") || "  (none)";

  const envVarsText =
    envVars.size > 0
      ? Array.from(envVars.entries())
          .map(
            ([name, files]) =>
              `- \`${name}\` — used in ${files.map((f) => "`" + f + "`").join(", ")}`,
          )
          .join("\n")
      : "(none found)";

  const exportsText =
    fileExports.length > 0
      ? fileExports
          .slice(0, 30)
          .map((e) => `- \`${e.file}\`: ${e.exports}`)
          .join("\n")
      : "(none found)";

  const systemMessage = `You are a world-class software architect. You read source code and produce extremely precise, file-grounded documentation. You NEVER write generic advice. Every sentence you write must cite a real file path, function name, or pattern visible in the code you are given. If you cannot ground a claim in the actual source, you omit it entirely.`;

  const userMessage = `I ran \`codebrief\` and need you to write a CONTEXT.md that lets an AI code assistant (Cursor, Copilot) understand this project so well it can write production code immediately.

---
## HARD RULES (violating these = failure)

1. **File-path grounding**: Every bullet in Architecture Notes, Rules for AI, and Never Do MUST reference at least one real file path or function/export name from the code samples. No exceptions.
2. **No negatives**: NEVER write "X is not used", "the project does not have Y", "no database detected". If something doesn't exist, simply don't mention it.
3. **No generic advice**: NEVER write vague statements like "follow best practices", "maintain code quality", "adhere to coding standards", "ensure security". These are worthless.
4. **Omit, don't guess**: If you can't infer something from the actual code samples, omit that section/bullet entirely. Empty sections should be removed.
5. **Specific > exhaustive**: 5 deeply specific bullets beat 15 vague ones.

## BAD (never write like this)
- "Authentication and session logic are not explicitly handled within the project"
- "Adhere to the project's coding standards and best practices"
- "Regular security audits are essential"
- "Error handling mechanisms are crucial for a robust application"
- "The project follows a modular structure, enhancing maintainability"

## GOOD (write like this)
- "CLI entry point is \`src/index.js:main()\` — parses flags via \`hasFlag()\`/\`getFlagValue()\`, calls \`scanDirectory()\` → \`analyzeProject()\` → \`generateContextFile()\` in sequence"
- "AI enhancement in \`src/ai.js:enhanceWithAI()\` samples up to 32k chars of source via \`sampleSourceFiles()\`, builds a structured prompt, dispatches to the selected provider (Groq/OpenAI/Anthropic/Gemini/Grok/Ollama)"
- "Never add npm dependencies — this project uses zero deps (native \`https\`, \`fs\`, \`path\` only). See \`package.json\` dependencies field is empty."
- "All color output uses the \`c\` object from \`src/index.js\` (ANSI escape codes) — never use chalk or other color libraries"

---
## Project metadata
- Name: ${analysis.name}
- Framework / Type: ${analysis.type}
- Language: ${analysis.language}
- Package manager: ${analysis.packageManager}
- Stack: ${analysis.stack.join(", ") || "unknown"}
- CSS: ${analysis.cssFramework || "none"} · UI: ${analysis.uiLibrary || "none"} · State: ${analysis.stateManagement || "none"}
- DB: ${analysis.database || "none"} · Tests: ${analysis.testFramework || "none"} · Deploy: ${analysis.deployment || "unknown"}
- Monorepo: ${analysis.isMonorepo}

## Scripts
${scripts}

## File tree
${fileList}

## Source code samples (READ CAREFULLY — this is your evidence)
${samplesText}

## Environment variables found in code
${envVarsText}

## Module exports detected
${exportsText}

---

Now produce the CONTEXT.md in EXACTLY this structure. Remove any section where you have nothing concrete to say. Keep the emoji in every section header EXACTLY as shown.

# Project Context: ${analysis.name}
> AI-enhanced by **codebrief** · ${new Date().toISOString().split("T")[0]}

---

## 🧱 Tech Stack
Bullet list. Each bullet: technology name + its specific role citing where it's used.
Example: "Node.js — runtime; entry point at \`src/index.js\`, all code is CommonJS with \`require()\`"

## 🚀 Key Files
The 5–8 most important files to read first. Exact paths. One sentence each explaining what the file does and its key exports/functions.

## 📁 Folder Structure
One bullet per top-level directory, explaining its responsibility based on the actual files inside.

## 🔧 Scripts
One bullet per script. Say what it actually does, not just its command.

## 🏗️ Architecture Notes
8–15 bullets. Each MUST:
- Name specific file(s), function(s), or export(s)
- Describe a concrete data flow, dependency, or design decision
- Be something useful for an AI about to write code in this project

## 🤖 Rules for AI
8–12 rules extracted from the actual code patterns. Format:
- "Always/Never [specific action] — [file or pattern reference]"

## 🚫 Never Do
6–10 prohibitions grounded in the codebase. Each must cite WHY (a file, pattern, or convention).

## 🔐 Environment & Secrets
List actual env var names found in the code (e.g. \`GROQ_API_KEY\`, \`OPENAI_API_KEY\`). Describe how they're loaded and used. If none found, omit this section.

---
*Re-run \`codebrief --ai\` after major refactors to keep this file current.*

Respond with ONLY the Markdown. No preamble, no wrapping code fences.`;

  return { systemMessage, userMessage };
}

// ── HTTP helper (native, no deps) ────────────────────────────
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path,
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`API error ${res.statusCode}: ${raw}`));
          } else {
            try {
              resolve(JSON.parse(raw));
            } catch {
              reject(new Error("Invalid JSON from API: " + raw.slice(0, 200)));
            }
          }
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ── Provider implementations ─────────────────────────────────
async function callGroq(prompt, model) {
  model = model || getDefaultModel("groq");
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey)
    throw new Error(
      "GROQ_API_KEY environment variable is not set.\n" +
        "  Get a free key in ~30s at https://console.groq.com",
    );

  const messages =
    typeof prompt === "string"
      ? [{ role: "user", content: prompt }]
      : [
          { role: "system", content: prompt.systemMessage },
          { role: "user", content: prompt.userMessage },
        ];

  const res = await httpsPost(
    "api.groq.com",
    "/openai/v1/chat/completions",
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    {
      model,
      messages,
      temperature: 0.2,
      max_tokens: 8192,
    },
  );
  return res.choices?.[0]?.message?.content || "";
}

async function callOpenAI(prompt, model) {
  model = model || getDefaultModel("openai");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new Error("OPENAI_API_KEY environment variable is not set.");

  const messages =
    typeof prompt === "string"
      ? [{ role: "user", content: prompt }]
      : [
          { role: "system", content: prompt.systemMessage },
          { role: "user", content: prompt.userMessage },
        ];

  const res = await httpsPost(
    "api.openai.com",
    "/v1/chat/completions",
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    {
      model,
      messages,
      temperature: 0.2,
      max_tokens: 8192,
    },
  );
  return res.choices?.[0]?.message?.content || "";
}

async function callAnthropic(prompt, model) {
  model = model || getDefaultModel("anthropic");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    throw new Error("ANTHROPIC_API_KEY environment variable is not set.");

  const messages =
    typeof prompt === "string"
      ? [{ role: "user", content: prompt }]
      : [{ role: "user", content: prompt.userMessage }];

  const system = typeof prompt === "string" ? undefined : prompt.systemMessage;

  const body = {
    model,
    max_tokens: 8192,
    messages,
  };
  if (system) body.system = system;

  const res = await httpsPost(
    "api.anthropic.com",
    "/v1/messages",
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body,
  );
  return res.content?.[0]?.text || "";
}

async function callGemini(prompt, model) {
  model = model || getDefaultModel("gemini");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new Error(
      "GEMINI_API_KEY environment variable is not set.\n" +
        "  Get a free key at https://aistudio.google.com/app/apikey",
    );

  const fullText =
    typeof prompt === "string"
      ? prompt
      : `${prompt.systemMessage}\n\n${prompt.userMessage}`;

  const res = await httpsPost(
    "generativelanguage.googleapis.com",
    `/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { "Content-Type": "application/json" },
    {
      contents: [{ parts: [{ text: fullText }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    },
  );
  return res.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGrok(prompt, model) {
  model = model || getDefaultModel("grok");
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey)
    throw new Error(
      "XAI_API_KEY environment variable is not set.\n" +
        "  Get a key at https://console.x.ai",
    );

  const messages =
    typeof prompt === "string"
      ? [{ role: "user", content: prompt }]
      : [
          { role: "system", content: prompt.systemMessage },
          { role: "user", content: prompt.userMessage },
        ];

  const res = await httpsPost(
    "api.x.ai",
    "/v1/chat/completions",
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    {
      model,
      messages,
      temperature: 0.2,
      max_tokens: 8192,
    },
  );
  return res.choices?.[0]?.message?.content || "";
}

async function callOllama(prompt, model) {
  model = model || getDefaultModel("ollama");
  // Ollama runs locally on port 11434 — use http
  const http = require("http");
  const fullText =
    typeof prompt === "string"
      ? prompt
      : `${prompt.systemMessage}\n\n${prompt.userMessage}`;
  const body = JSON.stringify({ model, prompt: fullText, stream: false });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: 11434,
        path: "/api/generate",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Ollama error ${res.statusCode}: ${raw}`));
          } else {
            try {
              resolve(JSON.parse(raw).response || "");
            } catch {
              reject(
                new Error("Invalid response from Ollama: " + raw.slice(0, 200)),
              );
            }
          }
        });
      },
    );
    req.on("error", (e) =>
      reject(
        new Error(
          `Cannot reach Ollama at localhost:11434 — is it running? (${e.message})`,
        ),
      ),
    );
    req.write(body);
    req.end();
  });
}

// ── Public API ───────────────────────────────────────────────
async function enhanceWithAI(analysis, fileTree, rootDir, options = {}) {
  const { provider = "openai", model } = options;

  const fileSamples = sampleSourceFiles(rootDir, fileTree);
  const envVars = extractEnvVars(rootDir, fileTree);
  const fileExports = extractExports(rootDir, fileTree);
  const prompt = buildPrompt(
    analysis,
    fileTree,
    fileSamples,
    envVars,
    fileExports,
  );

  switch (provider.toLowerCase()) {
    case "groq":
      return await callGroq(prompt, model);
    case "openai":
      return await callOpenAI(prompt, model);
    case "anthropic":
      return await callAnthropic(prompt, model);
    case "gemini":
      return await callGemini(prompt, model);
    case "grok":
      return await callGrok(prompt, model);
    case "ollama":
      return await callOllama(prompt, model);
    default:
      throw new Error(
        `Unknown provider "${provider}". Available: ${getAllProviders().join(", ")}`,
      );
  }
}

module.exports = { enhanceWithAI };
