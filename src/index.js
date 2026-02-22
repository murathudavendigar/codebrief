#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { scanDirectory } = require("./scanner");
const { analyzeProject } = require("./analyzer");
const {
  generateContextMd,
  generateCursorRule,
  generateVSCodeInstructions,
  parseExistingContext,
} = require("./generator");
const { enhanceWithAI } = require("./ai");
const {
  getAvailableModels,
  getDefaultModel,
  getAllProviders,
} = require("./models");

// ── Load env files (no external deps) ────────────────────────
// Reads KEY=VALUE lines from a file and sets missing process.env vars
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

// Priority (lowest → highest): ~/.codebrief → .env → .env.local
loadEnvFile(path.join(require("os").homedir(), ".codebrief"));
loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

// ── Simple CLI argument parser (no dependencies needed) ───────
const args = process.argv.slice(2);

function hasFlag(flag) {
  return args.includes(flag);
}

function getFlagValue(flag, defaultVal) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return defaultVal;
}

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
  codebrief — AI Context Generator for Developer Projects
  
  Usage:
    node src/index.js [options]
  
  Options:
    --depth <n>       Max folder depth to scan (default: 4)
    --no-cursor       Skip generating .cursor/rules/project.mdc
    --vscode          Also generate .github/copilot-instructions.md
    --output <dir>    Output directory (default: current directory)
    --update          Re-generate but preserve your Architecture Notes & Never Do sections
    --init            Interactively fill in Architecture Notes & Never Do after generation
    --ai              Use AI to generate a deeply detailed CONTEXT.md (requires API key)
    --provider <p>    AI provider: groq (default, free), openai, anthropic, gemini, grok, ollama
    --model <m>       Override the default model for the chosen provider
    --models          List all available models for the chosen provider (use with --provider)
    --help            Show this help message
    --version         Show version

  AI environment variables:
    GROQ_API_KEY        Required for --provider groq (FREE at console.groq.com)
    GEMINI_API_KEY      Required for --provider gemini (FREE at aistudio.google.com)
    OPENAI_API_KEY      Required for --provider openai
    ANTHROPIC_API_KEY   Required for --provider anthropic
    XAI_API_KEY         Required for --provider grok (console.x.ai)
    (Ollama needs no key — just run ollama locally)

  Examples:
    node src/index.js
    node src/index.js --depth 3
    node src/index.js --vscode --no-cursor
    node src/index.js --update
    node src/index.js --init
    node src/index.js --ai
    node src/index.js --ai --provider groq
    node src/index.js --ai --provider anthropic
    node src/index.js --ai --provider ollama --model mistral
  `);
  process.exit(0);
}

if (hasFlag("--version") || hasFlag("-v")) {
  const pkg = require("../package.json");
  console.log(pkg.version || "1.0.0");
  process.exit(0);
}

if (hasFlag("--models")) {
  const provider = getFlagValue("--provider", null);
  if (!provider) {
    console.log("\n  Usage: codebrief --models --provider <name>\n");
    console.log(
      "  Available providers: " + getAllProviders().join(", ") + "\n",
    );
  } else {
    const list = getAvailableModels(provider);
    if (list.length === 0) {
      console.log(
        `\n  Unknown provider "${provider}". Available: ${getAllProviders().join(", ")}\n`,
      );
    } else {
      const def = getDefaultModel(provider);
      console.log(`\n  Models for ${provider}:\n`);
      list.forEach((m) => {
        const tag = m === def ? " (default)" : "";
        console.log(`    ${m}${tag}`);
      });
      console.log(
        `\n  Usage: codebrief --ai --provider ${provider} --model <model>\n`,
      );
    }
  }
  process.exit(0);
}

const maxDepth = parseInt(getFlagValue("--depth", "4"), 10);
const skipCursor = hasFlag("--no-cursor");
const includeVSCode = hasFlag("--vscode");
const updateMode = hasFlag("--update");
const initMode = hasFlag("--init");
const aiMode = hasFlag("--ai");
const aiProvider = getFlagValue("--provider", "groq");
const aiModel = getFlagValue("--model", null);
const outputDir = getFlagValue("--output", process.cwd());
const rootDir = process.cwd();

// ── Simple terminal output helpers ───────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
};

function print(msg) {
  process.stdout.write(msg + "\n");
}
function bold(msg) {
  return c.bold + msg + c.reset;
}
function cyan(msg) {
  return c.cyan + msg + c.reset;
}
function green(msg) {
  return c.green + msg + c.reset;
}
function dim(msg) {
  return c.dim + msg + c.reset;
}

// ── Spinner ───────────────────────────────────────────────────
const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerInterval = null;
let spinnerIdx = 0;

function startSpinner(text) {
  if (spinnerInterval) clearInterval(spinnerInterval);
  spinnerIdx = 0;
  spinnerInterval = setInterval(() => {
    process.stdout.write(
      `\r${c.cyan}${frames[spinnerIdx % frames.length]}${c.reset} ${text}  `,
    );
    spinnerIdx++;
  }, 80);
}

function stopSpinner(successMsg) {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  process.stdout.write(`\r${green("✔")} ${successMsg}                    \n`);
}

// ── Interactive init prompts ──────────────────────────────────
async function runInitPrompts(contextPath) {
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const question = (q) => new Promise((resolve) => rl.question(q, resolve));

  print("");
  print(bold("  ✏️  Interactive Setup") + dim(" (--init mode)"));
  print(
    dim(
      "  Fill in key sections of CONTEXT.md now. Press Enter on an empty line to finish each section.",
    ),
  );

  // Architecture Notes
  print("");
  print(
    bold("  🏗️  Architecture Notes") +
      dim(" — describe your app's key structures"),
  );
  print(dim('     e.g. "Auth via NextAuth, session in all server components"'));
  print(dim("     Leave blank and press Enter to skip."));
  print("");
  const archNotes = [];
  while (true) {
    const line = await question(`     ${c.cyan}+${c.reset} `);
    if (!line.trim()) break;
    archNotes.push(line.trim());
  }

  // Never Do
  print("");
  print(bold("  🚫  Never Do") + dim(" — rules the AI must never break"));
  print(dim('     e.g. "Never use class components"'));
  print(dim("     Leave blank and press Enter to skip."));
  print("");
  const neverDo = [];
  while (true) {
    const line = await question(`     ${c.cyan}+${c.reset} `);
    if (!line.trim()) break;
    neverDo.push(line.trim());
  }

  rl.close();

  if (archNotes.length === 0 && neverDo.length === 0) {
    print("");
    print(dim("  No input provided — CONTEXT.md unchanged."));
    return;
  }

  let content = fs.readFileSync(contextPath, "utf-8");

  if (archNotes.length > 0) {
    const block = archNotes.map((n) => `- ${n}`).join("\n");
    content = content.replace(
      /## 🏗️ Architecture Notes\n[\s\S]*?(?=\n## )/,
      `## 🏗️ Architecture Notes\n${block}\n\n`,
    );
  }

  if (neverDo.length > 0) {
    const block = neverDo.map((n) => `- ${n}`).join("\n");
    content = content.replace(
      /## 🚫 Never Do\n[\s\S]*?(?=\n---|$)/,
      `## 🚫 Never Do\n${block}\n\n---\n`,
    );
  }

  fs.writeFileSync(contextPath, content, "utf-8");
  print("");
  print(`${green("✔")} ${bold("CONTEXT.md")} updated with your notes!`);
  print("");
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  print("");
  print(bold(cyan("⚡ codebrief") + " — AI Context Generator"));
  print("");

  // Step 1: Scan
  startSpinner("Scanning project...");
  const fileTree = scanDirectory(rootDir, maxDepth);

  // Step 2: Analyze
  const analysis = analyzeProject(rootDir);
  stopSpinner(
    `${fileTree.length} files · ${analysis.stack.join(", ") || "unknown stack"}`,
  );

  // Step 3: Generate files
  startSpinner("Generating context files...");

  const filesCreated = [];

  // Always write CONTEXT.md
  const contextPath = path.join(outputDir, "CONTEXT.md");
  const preserved = updateMode ? parseExistingContext(contextPath) : null;
  if (updateMode && preserved) {
    process.stdout.write(
      `\r${cyan("↺")} Preserving your Architecture Notes and Never Do sections...\n`,
    );
  }
  const contextMd = generateContextMd(analysis, fileTree, preserved);
  fs.writeFileSync(contextPath, contextMd, "utf-8");
  filesCreated.push({ label: "CONTEXT.md", path: contextPath });

  // Write Cursor rules unless --no-cursor
  if (!skipCursor) {
    const cursorDir = path.join(outputDir, ".cursor", "rules");
    fs.mkdirSync(cursorDir, { recursive: true });
    const cursorPath = path.join(cursorDir, "project.mdc");
    fs.writeFileSync(cursorPath, generateCursorRule(analysis), "utf-8");
    filesCreated.push({ label: ".cursor/rules/project.mdc", path: cursorPath });
  }

  // Write VS Code / Copilot instructions if requested
  if (includeVSCode) {
    const ghDir = path.join(outputDir, ".github");
    fs.mkdirSync(ghDir, { recursive: true });
    const vscodePath = path.join(ghDir, "copilot-instructions.md");
    fs.writeFileSync(vscodePath, generateVSCodeInstructions(analysis), "utf-8");
    filesCreated.push({
      label: ".github/copilot-instructions.md",
      path: vscodePath,
    });
  }

  stopSpinner("Files generated successfully!");

  // ── AI Enhancement ────────────────────────────────────────
  if (aiMode) {
    print("");
    const providerLabel =
      aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1);

    // Validate --model against known list and warn if unrecognised
    if (aiModel) {
      const known = getAvailableModels(aiProvider);
      if (known.length > 0 && !known.includes(aiModel)) {
        print(
          `${c.yellow}⚠${c.reset}  Unknown model "${aiModel}" for ${providerLabel}.`,
        );
        print(`   Known models: ${known.join(", ")}`);
        print(`   ${dim("Proceeding anyway — the provider may accept it.")}`);
        print("");
      }
    }

    startSpinner(
      `Enhancing CONTEXT.md with AI (${providerLabel} / ${aiModel || getDefaultModel(aiProvider)})...`,
    );
    try {
      const enhanced = await enhanceWithAI(analysis, fileTree, rootDir, {
        provider: aiProvider,
        model: aiModel,
      });
      if (enhanced && enhanced.trim().length > 100) {
        fs.writeFileSync(contextPath, enhanced, "utf-8");
        stopSpinner(
          `CONTEXT.md enhanced by ${providerLabel} — deeply detailed context written!`,
        );
      } else {
        stopSpinner("AI returned empty response — using standard CONTEXT.md");
      }
    } catch (err) {
      if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
      }

      const isKeyMissing =
        err.message.includes("_API_KEY") && err.message.includes("not set");

      if (isKeyMissing) {
        const keyName =
          aiProvider === "anthropic"
            ? "ANTHROPIC_API_KEY"
            : aiProvider === "openai"
              ? "OPENAI_API_KEY"
              : aiProvider === "gemini"
                ? "GEMINI_API_KEY"
                : aiProvider === "grok"
                  ? "XAI_API_KEY"
                  : "GROQ_API_KEY";
        const keyUrl =
          aiProvider === "anthropic"
            ? "https://console.anthropic.com"
            : aiProvider === "openai"
              ? "https://platform.openai.com/api-keys"
              : aiProvider === "gemini"
                ? "https://aistudio.google.com/app/apikey"
                : aiProvider === "grok"
                  ? "https://console.x.ai"
                  : "https://console.groq.com";
        const isFree = aiProvider === "groq" || aiProvider === "gemini";

        process.stdout.write(
          `\r${c.yellow}⚠${c.reset}  No API key found for ${bold(aiProvider)}.\n\n`,
        );
        print(bold("  🔑 Quick setup (takes ~30 seconds):"));
        print("");
        print(`     1. Go to ${cyan(keyUrl)}`);
        if (isFree)
          print(`        ${dim("→ Free account, no credit card needed")}`);
        print(`     2. Create an API key`);
        print(`     3. Set it in your terminal:`);
        print("");
        print(`        ${c.green}export ${keyName}=your_key_here${c.reset}`);
        print(
          `        ${dim("# Add that line to ~/.zshrc to make it permanent")}`,
        );
        print("");
        print(`     4. Re-run: ${cyan("codebrief --ai")}`);
        print("");
        print(dim("  Standard CONTEXT.md has been kept in the meantime."));
      } else {
        process.stdout.write(
          `\r${c.yellow}⚠${c.reset}  AI enhancement failed: ${err.message}\n`,
        );
        process.stdout.write(
          `   ${c.dim}Standard CONTEXT.md has been kept.${c.reset}\n`,
        );
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────
  print("");
  filesCreated.forEach((f) => print(`  ${green("✔")} ${bold(f.label)}`));

  if (!aiMode) {
    print("");
    print(dim(`  Tip: use ${cyan("--ai")} for an AI-enhanced CONTEXT.md.`));
  }
  print("");

  // ── Interactive --init prompts ───────────────────────────────
  if (initMode) {
    await runInitPrompts(contextPath);
  }
}

main().catch((err) => {
  process.stdout.write("\n");
  print(`${c.red}Error:${c.reset} ${err.message}`);
  process.exit(1);
});
