# ⚡ codebrief — AI Context Generator

> Generate `CONTEXT.md`, Cursor rules, and GitHub Copilot instructions for **any project** in seconds. Zero npm dependencies. Node.js only.

---

## What is codebrief?

codebrief scans your project directory, detects your tech stack, and generates structured context files that AI assistants (Cursor, GitHub Copilot, ChatGPT, Claude, etc.) can read to understand your codebase instantly. Instead of re-explaining your stack on every chat, you run one command and the AI knows everything.

**What it generates:**

| File                              | Purpose                                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| `CONTEXT.md`                      | Full project context: stack, scripts, folder tree, your architecture notes |
| `.cursor/rules/project.mdc`       | Auto-loaded by Cursor for every chat in this project                       |
| `.github/copilot-instructions.md` | Auto-loaded by GitHub Copilot (opt-in via `--vscode`)                      |

**New in v1.1 — AI Enhancement (`--ai`):**  
Add a single flag to have an AI model read your actual source files and rewrite `CONTEXT.md` with deep, project-specific architecture notes, inferred patterns, and AI rules. Uses [Groq](https://console.groq.com) by default — free, no credit card required.

---

## Requirements

- **Node.js 16+** — that's it. Zero npm dependencies.

---

## Quick Start

```bash
# Run on any project instantly
npx codebrief

# With AI enhancement (deeply detailed CONTEXT.md)
npx codebrief --ai
```

Or install globally:

```bash
npm install -g codebrief
codebrief
```

---

## Usage

```
codebrief [options]
```

### All Options

| Flag               | Description                                                                      | Default          |
| ------------------ | -------------------------------------------------------------------------------- | ---------------- |
| `--depth <n>`      | Max folder depth to scan                                                         | `4`              |
| `--no-cursor`      | Skip `.cursor/rules/project.mdc` generation                                      | cursor on        |
| `--vscode`         | Also generate `.github/copilot-instructions.md`                                  | off              |
| `--output <dir>`   | Write output files to a different directory                                      | cwd              |
| `--update`         | Re-generate but **preserve** your Architecture Notes & Never Do                  | —                |
| `--init`           | Interactively fill in Architecture Notes & Never Do after generation             | —                |
| `--ai`             | Use AI to generate a deeply detailed `CONTEXT.md`                                | off              |
| `--provider <p>`   | AI provider: `groq` (default), `openai`, `anthropic`, `gemini`, `grok`, `ollama` | `groq`           |
| `--model <m>`      | Override the default model for the chosen provider                               | provider default |
| `--models`         | List all available models for the chosen `--provider`                            | —                |
| `--version` / `-v` | Print version                                                                    | —                |
| `--help` / `-h`    | Show help                                                                        | —                |

---

## AI Enhancement (`--ai`)

The `--ai` flag makes codebrief read your actual source files and use an AI model to write a deeply detailed `CONTEXT.md` — one that infers architecture patterns, data flow, naming conventions, and project-specific rules from your real code, not just your `package.json`.

### Setup (30 seconds, free)

1. Go to [console.groq.com](https://console.groq.com) and create a free account (no credit card)
2. Create an API key
3. Set it in your terminal:

```bash
export GROQ_API_KEY=gsk_xxxxxxxxxxxx

# Add to ~/.zshrc to make it permanent
echo 'export GROQ_API_KEY=gsk_xxxxxxxxxxxx' >> ~/.zshrc
```

4. Run:

```bash
codebrief --ai
```

### AI Providers

| Provider   | Flag                   | Env Variable        | Cost       | Default Model             |
| ---------- | ---------------------- | ------------------- | ---------- | ------------------------- |
| **Groq**   | `--provider groq`      | `GROQ_API_KEY`      | Free tier  | `llama-3.3-70b-versatile` |
| **Gemini** | `--provider gemini`    | `GEMINI_API_KEY`    | Free tier  | `gemini-2.5-flash`        |
| OpenAI     | `--provider openai`    | `OPENAI_API_KEY`    | Paid       | `gpt-4o`                  |
| Anthropic  | `--provider anthropic` | `ANTHROPIC_API_KEY` | Paid       | `claude-sonnet-4-5`       |
| Grok (xAI) | `--provider grok`      | `XAI_API_KEY`       | Paid       | `grok-4-fast`             |
| Ollama     | `--provider ollama`    | *(none)*            | Free/local | `llama3.3`                |

**Groq and Gemini are both free** — no credit card required. Groq is fastest (~2–3s), Gemini offers Google's latest models.

### Browsing Available Models

Use `--models` to see all available models for any provider before running `--ai`:

```bash
# List all models for a provider
codebrief --models --provider groq
codebrief --models --provider gemini
codebrief --models --provider openai

# List all providers (no --provider given)
codebrief --models
```

Example output:

```
  Models for groq:

    meta-llama/llama-4-maverick-17b-128e-instruct
    llama-3.3-70b-versatile (default)
    llama-3.1-8b-instant
    compound-beta

  Usage: codebrief --ai --provider groq --model <model>
```

All available models are maintained in `src/models.js` — update that file when new models release or old ones are deprecated.

### Examples

```bash
# Free (Groq, default)
codebrief --ai

# Free (Google Gemini)
codebrief --ai --provider gemini

# Paid providers
codebrief --ai --provider openai
codebrief --ai --provider anthropic
codebrief --ai --provider grok

# Use a specific model (see codebrief --models --provider <name>)
codebrief --ai --provider groq --model llama-3.1-8b-instant
codebrief --ai --provider gemini --model gemini-1.5-pro

# Fully local, no API key (needs Ollama running)
codebrief --ai --provider ollama
codebrief --ai --provider ollama --model codellama

# AI + preserve existing notes
codebrief --ai --update

# AI + also generate Copilot instructions
codebrief --ai --vscode
```

> If no API key is found, codebrief prints a friendly setup guide and falls back to the standard `CONTEXT.md` — the tool always delivers value regardless.

---

## Typical Workflows

### First time on a new project

```bash
cd my-project
codebrief
```

Opens `CONTEXT.md` → fill in **Architecture Notes** and **Never Do** manually.

### First time with AI-generated context

```bash
codebrief --ai
```

codebrief reads your source files and writes a fully detailed `CONTEXT.md` — architecture notes, data flow, naming conventions, and AI rules — inferred from your actual code.

### First time + interactive fill-in

```bash
codebrief --init
```

After generating the files, codebrief prompts you to type your architecture notes and "Never Do" rules line-by-line in the terminal.

```
  ✏️  Interactive Setup (--init mode)

  🏗️  Architecture Notes — describe your app's key structures
     e.g. "Auth via NextAuth, session in all server components"

     + Auth is handled by Supabase, JWT stored in cookies
     + All API calls go through /lib/api.ts
     +          ← (press Enter on empty line to finish)

  🚫  Never Do — rules the AI must never break
     + Never use inline styles, always use Tailwind classes
     +
```

### After a major refactor (preserve your notes)

```bash
codebrief --update
```

Re-scans everything and regenerates the stack, scripts, and file tree — but keeps whatever you previously wrote in **Architecture Notes** and **Never Do** intact.

### Generate everything including Copilot instructions

```bash
codebrief --vscode
```

### Skip Cursor, only generate CONTEXT.md

```bash
codebrief --no-cursor
```

### Scan a shallower tree (large or deep projects)

```bash
codebrief --depth 2
```

### Write output to a different directory

```bash
codebrief --output ./docs
```

---

## Output Files Explained

### `CONTEXT.md`

The main context file. Edit freely after generation — especially the two sections marked for your input:

```markdown
## 🏗️ Architecture Notes
- Auth is handled by NextAuth.js. Session is available in all server components.
- All API calls go through /lib/api.ts — never use fetch directly in components.

## 🚫 Never Do
- Never use class components
- Never commit .env files
```

With `--ai`, these sections are written automatically from your actual code. Your manual edits are preserved on subsequent `--update` runs.

### `.cursor/rules/project.mdc`

Automatically loaded by Cursor for every chat session in your project — no setup needed. Contains your stack and conventions so Cursor always has context.

### `.github/copilot-instructions.md`

Generated with `--vscode`. GitHub Copilot reads this file automatically in VS Code.

---

## Customising What Gets Scanned

Place a `.codebriefignore` file in your project root to exclude directories or files from the scan (same syntax as `.gitignore`):

```gitignore
# .codebriefignore
generated/
third_party/
legacy/
db/seeds.sql
```

codebrief always ignores `node_modules`, `.git`, `dist`, `build`, `.next`, and other standard build/cache folders by default.

---

## Monorepo Support

codebrief auto-detects monorepos via `pnpm-workspace.yaml`, `turbo.json`, `lerna.json`, or a `workspaces` field in `package.json`. `CONTEXT.md` will include a **Monorepo Packages** section listing all sub-packages found under `packages/`, `apps/`, `libs/`, and `services/`.

---

## Using Context Files with AI Tools

### Cursor

No setup needed for `.cursor/rules/project.mdc` — it's auto-applied to every chat.

For richer context, reference `CONTEXT.md` in a **Notepad**:
1. Open the Notepads panel (sidebar)
2. Create a new notepad and type `@CONTEXT.md`
3. Reference that notepad in any chat

### GitHub Copilot (VS Code)

Run `codebrief --vscode` once. The `.github/copilot-instructions.md` is picked up by Copilot automatically.

### ChatGPT / Claude / other LLMs

Paste `CONTEXT.md` at the start of any conversation:

```
Here is my project context:
[paste CONTEXT.md contents]

Now help me with: ...
```

---

## Detected Stacks

| Category            | Detected                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frameworks**      | Next.js, Remix, SvelteKit, Astro, Nuxt.js, Gatsby, SolidJS, Qwik, Eleventy, React, Vue.js, Svelte, Angular, NestJS, Express, Fastify, Hono, Koa, tRPC, Electron, React Native, Expo |
| **Languages**       | TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Ruby, PHP, C#                                                                                                               |
| **CSS**             | Tailwind CSS, styled-components, Emotion, SASS/SCSS, Vanilla Extract, UnoCSS                                                                                                        |
| **UI Libraries**    | shadcn/ui, Material UI, Ant Design, Chakra UI, Mantine, Headless UI, NextUI, DaisyUI                                                                                                |
| **State**           | TanStack Query, Zustand, Jotai, Redux Toolkit, MobX, Pinia, Vuex, Recoil, Valtio                                                                                                    |
| **Database/ORM**    | Prisma, Drizzle, TypeORM, Sequelize, Knex, Mongoose, PostgreSQL, MySQL, SQLite, Supabase, Firebase, Redis, Elasticsearch, DynamoDB                                                  |
| **Auth**            | NextAuth.js, Clerk, Supabase Auth, Passport.js, Lucia Auth, JWT                                                                                                                     |
| **API / Data**      | tRPC, Axios, GraphQL (Apollo), SWR                                                                                                                                                  |
| **Validation**      | Zod, Yup, Joi, TypeBox                                                                                                                                                              |
| **Testing**         | Vitest, Jest, Playwright, Cypress, React Testing Library, Mocha, AVA                                                                                                                |
| **Bundlers**        | Vite, Webpack, esbuild, Rollup, Turbopack, tsup, SWC                                                                                                                                |
| **Linting**         | ESLint, Biome, Prettier                                                                                                                                                             |
| **Deployment**      | Vercel, Netlify, Railway, Fly.io, Render, Google Cloud, Serverless (AWS), Docker, Docker Compose                                                                                    |
| **Package Manager** | npm, pnpm, yarn, bun, cargo, go modules, pip/poetry, Maven, Gradle, bundler, composer, dotnet/NuGet                                                                                 |
| **Python**          | Django, FastAPI, Flask, Streamlit                                                                                                                                                   |
| **Go**              | Gin, Fiber, Echo, Chi                                                                                                                                                               |
| **Rust**            | Actix Web, Axum, Rocket, Tauri                                                                                                                                                      |
| **Java/Kotlin**     | Spring Boot, Quarkus, Ktor, Android                                                                                                                                                 |
| **Ruby**            | Ruby on Rails, Sinatra                                                                                                                                                              |
| **PHP**             | Laravel, Symfony, Slim                                                                                                                                                              |
| **C# / .NET**       | ASP.NET Core, Blazor                                                                                                                                                                |
| **Monorepo**        | pnpm workspaces, Turborepo, Lerna, npm workspaces                                                                                                                                   |

---

## Tips for Best Results

1. **Use `--ai` on first run.** It reads your actual code and writes architecture notes you'd spend 20 minutes writing manually.
2. **Fill in Architecture Notes manually if not using `--ai`.** Describe how your app is structured in 3–10 bullet points.
3. **Use `--update` freely.** Run it after any significant refactor to refresh auto-generated sections without losing your notes.
4. **Keep Never Do tight.** Add the top 5–10 things that are easy for an AI to get wrong in your specific project.
5. **Commit `CONTEXT.md`.** Treat it like documentation — keep it in version control so the whole team benefits.
6. **Use `--depth 2`** for very large projects to keep the file tree readable and the token count manageable.

---

## Project Structure

```
codebrief/
  src/
    index.js      ← CLI entry point, argument parsing, orchestration
    scanner.js    ← Directory walker (respects .gitignore + .codebriefignore)
    analyzer.js   ← Stack detection: 10 languages, 50+ frameworks/tools
    generator.js  ← Markdown/MDC generators + section parser for --update
    ai.js         ← AI enhancement: file sampling, prompt builder, 6 providers
    models.js     ← All provider model lists — edit here to update/add models
  package.json
  README.md
  ROADMAP.md
```

---

## License

MIT
