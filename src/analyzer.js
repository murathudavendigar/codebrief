const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function fileExists(rootDir, ...parts) {
  return fs.existsSync(path.join(rootDir, ...parts));
}

function analyzeProject(rootDir) {
  const result = {
    name: path.basename(rootDir),
    type: "unknown",
    language: "javascript",
    packageManager: "npm",
    stack: [],
    scripts: {},
    entryPoints: [],
    conventions: [],
    testFramework: null,
    cssFramework: null,
    uiLibrary: null,
    stateManagement: null,
    database: null,
    deployment: null,
    auth: null,
    api: null,
    bundler: null,
    linter: null,
    formatter: null,
    validation: null,
    extraRules: [],
    isMonorepo: false,
    packages: [],
  };

  // ── Package.json ─────────────────────────────────────────────
  const pkgPath = path.join(rootDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = readJson(pkgPath);
    if (pkg) {
      if (pkg.name) result.name = pkg.name;
      result.scripts = pkg.scripts || {};

      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      // Framework detection (order: full-stack first, then SPA, then backend)
      if (deps["next"]) result.type = "Next.js";
      else if (deps["@remix-run/react"]) result.type = "Remix";
      else if (deps["@sveltejs/kit"]) result.type = "SvelteKit";
      else if (deps["astro"]) result.type = "Astro";
      else if (deps["nuxt"]) result.type = "Nuxt.js";
      else if (deps["gatsby"]) result.type = "Gatsby";
      else if (deps["solid-js"]) result.type = "SolidJS";
      else if (deps["@builder.io/qwik"]) result.type = "Qwik";
      else if (deps["@eleventy/eleventy"] || deps["@11ty/eleventy"])
        result.type = "Eleventy";
      else if (deps["react"]) result.type = "React";
      else if (deps["vue"]) result.type = "Vue.js";
      else if (deps["svelte"]) result.type = "Svelte";
      else if (deps["@angular/core"]) result.type = "Angular";
      else if (deps["@nestjs/core"]) result.type = "NestJS";
      else if (deps["express"]) result.type = "Express.js API";
      else if (deps["fastify"]) result.type = "Fastify API";
      else if (deps["hono"]) result.type = "Hono API";
      else if (deps["koa"]) result.type = "Koa API";
      else if (deps["@trpc/server"]) result.type = "tRPC API";
      else if (deps["electron"]) result.type = "Electron";
      else if (deps["react-native"]) result.type = "React Native";
      else if (deps["expo"]) result.type = "Expo (React Native)";

      // Language
      if (deps["typescript"] || fileExists(rootDir, "tsconfig.json")) {
        result.language = "TypeScript";
        result.extraRules.push("Always use TypeScript. Never use `any` type.");
      }

      // CSS Framework
      if (deps["tailwindcss"]) {
        result.cssFramework = "Tailwind CSS";
        result.extraRules.push(
          "Use Tailwind utility classes for all styling. No inline styles.",
        );
      } else if (deps["styled-components"]) {
        result.cssFramework = "styled-components";
      } else if (deps["@emotion/react"]) {
        result.cssFramework = "Emotion CSS-in-JS";
      } else if (deps["sass"] || deps["node-sass"]) {
        result.cssFramework = "SASS/SCSS";
      } else if (deps["@vanilla-extract/css"]) {
        result.cssFramework = "Vanilla Extract";
      } else if (deps["unocss"]) {
        result.cssFramework = "UnoCSS";
      }

      // UI Library
      if (
        fileExists(rootDir, "components", "ui") ||
        deps["@radix-ui/react-dialog"]
      ) {
        result.uiLibrary = "shadcn/ui";
        result.extraRules.push(
          "Use shadcn/ui components from /components/ui before creating new ones.",
        );
      } else if (deps["@mui/material"]) {
        result.uiLibrary = "Material UI";
      } else if (deps["antd"]) {
        result.uiLibrary = "Ant Design";
      } else if (deps["@chakra-ui/react"]) {
        result.uiLibrary = "Chakra UI";
      } else if (deps["@mantine/core"]) {
        result.uiLibrary = "Mantine";
      } else if (deps["@headlessui/react"]) {
        result.uiLibrary = "Headless UI";
      } else if (deps["@nextui-org/react"]) {
        result.uiLibrary = "NextUI";
      } else if (deps["daisyui"]) {
        result.uiLibrary = "DaisyUI";
      }

      // State management
      if (deps["@tanstack/react-query"] || deps["react-query"]) {
        result.stateManagement = "TanStack Query (React Query)";
        result.extraRules.push(
          "Use TanStack Query for all server state. Never use useEffect for data fetching.",
        );
      } else if (deps["zustand"]) {
        result.stateManagement = "Zustand";
      } else if (deps["jotai"]) {
        result.stateManagement = "Jotai";
      } else if (deps["@reduxjs/toolkit"]) {
        result.stateManagement = "Redux Toolkit";
      } else if (deps["mobx"]) {
        result.stateManagement = "MobX";
      } else if (deps["pinia"]) {
        result.stateManagement = "Pinia (Vue)";
      } else if (deps["vuex"]) {
        result.stateManagement = "Vuex (Vue)";
      } else if (deps["recoil"]) {
        result.stateManagement = "Recoil";
      } else if (deps["valtio"]) {
        result.stateManagement = "Valtio";
      }

      // Test framework
      if (deps["vitest"]) result.testFramework = "Vitest";
      else if (deps["jest"]) result.testFramework = "Jest";
      else if (deps["@playwright/test"]) result.testFramework = "Playwright";
      else if (deps["cypress"]) result.testFramework = "Cypress";
      else if (deps["@testing-library/react"])
        result.testFramework = "React Testing Library";
      else if (deps["mocha"]) result.testFramework = "Mocha";
      else if (deps["ava"]) result.testFramework = "AVA";

      // Database / ORM
      if (deps["prisma"] || deps["@prisma/client"]) {
        result.database = "Prisma ORM";
        result.extraRules.push(
          "Database access only through Prisma client. Never write raw SQL.",
        );
      } else if (deps["drizzle-orm"]) {
        result.database = "Drizzle ORM";
      } else if (deps["mongoose"]) {
        result.database = "MongoDB with Mongoose";
      } else if (deps["@supabase/supabase-js"]) {
        result.database = "Supabase";
      } else if (deps["firebase"] || deps["firebase-admin"]) {
        result.database = "Firebase";
      } else if (deps["typeorm"]) {
        result.database = "TypeORM";
      } else if (deps["sequelize"]) {
        result.database = "Sequelize";
      } else if (deps["knex"]) {
        result.database = "Knex.js";
      } else if (deps["pg"] || deps["mysql2"] || deps["better-sqlite3"]) {
        result.database = deps["pg"]
          ? "PostgreSQL (pg)"
          : deps["mysql2"]
            ? "MySQL"
            : "SQLite";
      } else if (deps["redis"] || deps["ioredis"]) {
        result.database = "Redis";
      } else if (deps["@elastic/elasticsearch"]) {
        result.database = "Elasticsearch";
      } else if (deps["dynamoose"] || deps["@aws-sdk/client-dynamodb"]) {
        result.database = "DynamoDB";
      }

      // Auth
      if (deps["next-auth"] || deps["@auth/core"]) {
        result.auth = "NextAuth.js (Auth.js)";
        result.extraRules.push(
          "Auth is managed by NextAuth.js. Use getServerSession() on the server.",
        );
      } else if (deps["@clerk/nextjs"] || deps["@clerk/clerk-react"]) {
        result.auth = "Clerk";
      } else if (deps["@supabase/auth-helpers-nextjs"]) {
        result.auth = "Supabase Auth";
      } else if (deps["passport"]) {
        result.auth = "Passport.js";
      } else if (deps["@lucia-auth/lucia"] || deps["lucia"]) {
        result.auth = "Lucia Auth";
      } else if (deps["jsonwebtoken"]) {
        result.auth = "JWT (jsonwebtoken)";
      }

      // API / Data fetching
      if (deps["@trpc/client"] || deps["@trpc/server"]) {
        result.api = "tRPC";
        result.extraRules.push(
          "Use tRPC for all API communication. Never use raw fetch for internal APIs.",
        );
      } else if (deps["axios"]) {
        result.api = "Axios";
      } else if (deps["graphql"] || deps["@apollo/client"]) {
        result.api = "GraphQL" + (deps["@apollo/client"] ? " (Apollo)" : "");
      } else if (deps["swr"]) {
        result.api = "SWR";
      }

      // Validation
      if (deps["zod"]) {
        result.validation = "Zod";
        result.extraRules.push(
          "Use Zod for all input validation and type inference.",
        );
      } else if (deps["yup"]) {
        result.validation = "Yup";
      } else if (deps["joi"]) {
        result.validation = "Joi";
      } else if (deps["@sinclair/typebox"]) {
        result.validation = "TypeBox";
      }

      // Bundler / Build tool
      if (deps["vite"]) result.bundler = "Vite";
      else if (deps["webpack"]) result.bundler = "Webpack";
      else if (deps["esbuild"]) result.bundler = "esbuild";
      else if (deps["rollup"]) result.bundler = "Rollup";
      else if (deps["turbopack"]) result.bundler = "Turbopack";
      else if (deps["tsup"]) result.bundler = "tsup";
      else if (deps["swc"]) result.bundler = "SWC";

      // Linter / Formatter
      if (deps["eslint"]) result.linter = "ESLint";
      if (deps["@biomejs/biome"]) result.linter = "Biome";
      if (deps["prettier"]) result.formatter = "Prettier";
      if (deps["@biomejs/biome"] && !deps["prettier"])
        result.formatter = "Biome";
    }
  }

  // ── Package Manager ───────────────────────────────────────────
  if (fileExists(rootDir, "bun.lockb")) result.packageManager = "bun";
  else if (fileExists(rootDir, "pnpm-lock.yaml"))
    result.packageManager = "pnpm";
  else if (fileExists(rootDir, "yarn.lock")) result.packageManager = "yarn";

  // ── Deployment hints ─────────────────────────────────────────
  if (fileExists(rootDir, "vercel.json") || fileExists(rootDir, ".vercel")) {
    result.deployment = "Vercel";
  } else if (fileExists(rootDir, "netlify.toml")) {
    result.deployment = "Netlify";
  } else if (
    fileExists(rootDir, "railway.json") ||
    fileExists(rootDir, "railway.toml")
  ) {
    result.deployment = "Railway";
  } else if (fileExists(rootDir, "fly.toml")) {
    result.deployment = "Fly.io";
  } else if (fileExists(rootDir, "render.yaml")) {
    result.deployment = "Render";
  } else if (
    fileExists(rootDir, "app.yaml") ||
    fileExists(rootDir, "app.yml")
  ) {
    result.deployment = "Google Cloud (App Engine)";
  } else if (
    fileExists(rootDir, "serverless.yml") ||
    fileExists(rootDir, "serverless.yaml")
  ) {
    result.deployment = "Serverless Framework (AWS)";
  } else if (fileExists(rootDir, "Dockerfile")) {
    result.deployment = "Docker";
  } else if (
    fileExists(rootDir, "docker-compose.yml") ||
    fileExists(rootDir, "docker-compose.yaml")
  ) {
    result.deployment = "Docker Compose";
  }

  // ── Python project ────────────────────────────────────────────
  if (
    fileExists(rootDir, "requirements.txt") ||
    fileExists(rootDir, "pyproject.toml") ||
    fileExists(rootDir, "setup.py") ||
    fileExists(rootDir, "Pipfile")
  ) {
    result.language = "Python";
    if (fileExists(rootDir, "manage.py")) result.type = "Django";
    else if (fileExists(rootDir, "main.py") || fileExists(rootDir, "app.py")) {
      try {
        const reqPath = fileExists(rootDir, "requirements.txt")
          ? path.join(rootDir, "requirements.txt")
          : null;
        const pyprojectPath = fileExists(rootDir, "pyproject.toml")
          ? path.join(rootDir, "pyproject.toml")
          : null;
        const content = reqPath
          ? fs.readFileSync(reqPath, "utf-8")
          : pyprojectPath
            ? fs.readFileSync(pyprojectPath, "utf-8")
            : "";
        if (content.includes("fastapi")) result.type = "FastAPI";
        else if (content.includes("flask")) result.type = "Flask";
        else if (content.includes("streamlit")) result.type = "Streamlit";
      } catch {}
    }
    if (fileExists(rootDir, "pyproject.toml"))
      result.packageManager = "pip/poetry";
  }

  // ── Go project ──────────────────────────────────────────────
  if (fileExists(rootDir, "go.mod")) {
    result.language = "Go";
    result.packageManager = "go modules";
    try {
      const goMod = fs.readFileSync(path.join(rootDir, "go.mod"), "utf-8");
      if (goMod.includes("gin-gonic/gin")) result.type = "Gin (Go)";
      else if (goMod.includes("gofiber/fiber")) result.type = "Fiber (Go)";
      else if (goMod.includes("labstack/echo")) result.type = "Echo (Go)";
      else if (goMod.includes("go-chi/chi")) result.type = "Chi (Go)";
      else result.type = "Go application";
    } catch {
      result.type = "Go application";
    }
  }

  // ── Rust project ────────────────────────────────────────────
  if (fileExists(rootDir, "Cargo.toml")) {
    result.language = "Rust";
    result.packageManager = "cargo";
    try {
      const cargo = fs.readFileSync(path.join(rootDir, "Cargo.toml"), "utf-8");
      if (cargo.includes("actix-web")) result.type = "Actix Web (Rust)";
      else if (cargo.includes("axum")) result.type = "Axum (Rust)";
      else if (cargo.includes("rocket")) result.type = "Rocket (Rust)";
      else if (cargo.includes("tauri")) result.type = "Tauri (Rust)";
      else result.type = "Rust application";
    } catch {
      result.type = "Rust application";
    }
  }

  // ── Java / Kotlin project ───────────────────────────────────
  if (
    fileExists(rootDir, "pom.xml") ||
    fileExists(rootDir, "build.gradle") ||
    fileExists(rootDir, "build.gradle.kts")
  ) {
    result.language = fileExists(rootDir, "build.gradle.kts")
      ? "Kotlin"
      : "Java";
    result.packageManager = fileExists(rootDir, "pom.xml") ? "Maven" : "Gradle";
    if (fileExists(rootDir, "pom.xml")) {
      try {
        const pom = fs.readFileSync(path.join(rootDir, "pom.xml"), "utf-8");
        if (pom.includes("spring-boot")) result.type = "Spring Boot";
        else if (pom.includes("quarkus")) result.type = "Quarkus";
      } catch {}
    } else {
      try {
        const gradle = fs.readFileSync(
          path.join(
            rootDir,
            fileExists(rootDir, "build.gradle.kts")
              ? "build.gradle.kts"
              : "build.gradle",
          ),
          "utf-8",
        );
        if (gradle.includes("spring-boot")) result.type = "Spring Boot";
        else if (gradle.includes("ktor")) result.type = "Ktor (Kotlin)";
        else if (gradle.includes("android")) result.type = "Android";
      } catch {}
    }
    if (result.type === "unknown")
      result.type = `${result.language} application`;
  }

  // ── Ruby project ────────────────────────────────────────────
  if (fileExists(rootDir, "Gemfile")) {
    result.language = "Ruby";
    result.packageManager = "bundler";
    try {
      const gemfile = fs.readFileSync(path.join(rootDir, "Gemfile"), "utf-8");
      if (gemfile.includes("rails")) result.type = "Ruby on Rails";
      else if (gemfile.includes("sinatra")) result.type = "Sinatra";
      else result.type = "Ruby application";
    } catch {
      result.type = "Ruby application";
    }
  }

  // ── PHP project ─────────────────────────────────────────────
  if (fileExists(rootDir, "composer.json")) {
    result.language = "PHP";
    result.packageManager = "composer";
    try {
      const composer = readJson(path.join(rootDir, "composer.json"));
      const req = {
        ...(composer?.require || {}),
        ...(composer?.["require-dev"] || {}),
      };
      if (req["laravel/framework"]) result.type = "Laravel";
      else if (req["symfony/framework-bundle"]) result.type = "Symfony";
      else if (req["slim/slim"]) result.type = "Slim (PHP)";
      else result.type = "PHP application";
    } catch {
      result.type = "PHP application";
    }
  }

  // ── C# / .NET project ──────────────────────────────────────
  const csprojFiles = (() => {
    try {
      return fs
        .readdirSync(rootDir)
        .filter((f) => f.endsWith(".csproj") || f.endsWith(".sln"));
    } catch {
      return [];
    }
  })();
  if (csprojFiles.length > 0) {
    result.language = "C#";
    result.packageManager = "dotnet / NuGet";
    if (fileExists(rootDir, "Program.cs")) {
      try {
        const prog = fs.readFileSync(path.join(rootDir, "Program.cs"), "utf-8");
        if (prog.includes("WebApplication")) result.type = "ASP.NET Core";
        else if (prog.includes("Blazor")) result.type = "Blazor";
        else result.type = ".NET application";
      } catch {
        result.type = ".NET application";
      }
    } else {
      result.type = ".NET application";
    }
  }

  // ── Folder conventions ────────────────────────────────────────
  let topDirs = [];
  try {
    topDirs = fs
      .readdirSync(rootDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {}

  if (topDirs.includes("components"))
    result.conventions.push("UI components → /components");
  if (topDirs.includes("hooks"))
    result.conventions.push("Custom React hooks → /hooks");
  if (topDirs.includes("lib"))
    result.conventions.push("Shared utilities → /lib");
  if (topDirs.includes("utils"))
    result.conventions.push("Helper functions → /utils");
  if (topDirs.includes("store") || topDirs.includes("stores")) {
    result.conventions.push("Global state → /store");
  }
  if (topDirs.includes("types"))
    result.conventions.push("TypeScript types → /types");
  if (topDirs.includes("api")) result.conventions.push("API layer → /api");
  if (topDirs.includes("services"))
    result.conventions.push("Business logic / services → /services");
  if (topDirs.includes("context"))
    result.conventions.push("React contexts → /context");
  if (topDirs.includes("middleware"))
    result.conventions.push("Middleware → /middleware");
  if (topDirs.includes("prisma"))
    result.conventions.push("Database schema → /prisma");
  if (topDirs.includes("config"))
    result.conventions.push("Configuration files → /config");
  if (topDirs.includes("constants"))
    result.conventions.push("Constants & enums → /constants");
  if (topDirs.includes("layouts"))
    result.conventions.push("Page layouts → /layouts");
  if (topDirs.includes("features"))
    result.conventions.push("Feature-based modules → /features");
  if (topDirs.includes("modules"))
    result.conventions.push("Domain modules → /modules");
  if (topDirs.includes("pages"))
    result.conventions.push("Page components → /pages");
  if (topDirs.includes("routes"))
    result.conventions.push("Route definitions → /routes");
  if (topDirs.includes("controllers"))
    result.conventions.push("Controllers → /controllers");
  if (topDirs.includes("models"))
    result.conventions.push("Data models → /models");
  if (topDirs.includes("helpers"))
    result.conventions.push("Helper functions → /helpers");
  if (topDirs.includes("tests") || topDirs.includes("__tests__"))
    result.conventions.push("Tests → /tests");
  if (topDirs.includes("public") || topDirs.includes("static"))
    result.conventions.push("Static assets → /public");
  if (topDirs.includes("assets"))
    result.conventions.push("Assets (images, fonts) → /assets");

  // ── Monorepo detection ──────────────────────────────────────
  const pkgJsonMonorepo = (() => {
    try {
      const p = readJson(path.join(rootDir, "package.json"));
      return !!(p && p.workspaces);
    } catch {
      return false;
    }
  })();

  if (
    pkgJsonMonorepo ||
    fileExists(rootDir, "pnpm-workspace.yaml") ||
    fileExists(rootDir, "turbo.json") ||
    fileExists(rootDir, "lerna.json")
  ) {
    result.isMonorepo = true;
    const pkgDirs = ["packages", "apps", "libs", "services"];
    for (const dir of pkgDirs) {
      const dirPath = path.join(rootDir, dir);
      if (!fs.existsSync(dirPath)) continue;
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        entries
          .filter((e) => e.isDirectory())
          .forEach((e) => {
            const subPkg = readJson(path.join(dirPath, e.name, "package.json"));
            result.packages.push({
              name: subPkg?.name || e.name,
              path: `${dir}/${e.name}`,
            });
          });
      } catch {}
    }
  }

  // Build stack array
  result.stack = [
    result.type !== "unknown" ? result.type : null,
    result.language,
    result.cssFramework,
    result.uiLibrary,
    result.stateManagement,
    result.auth,
    result.api,
    result.validation,
    result.testFramework,
    result.database,
    result.bundler,
    result.linter ? `Linter: ${result.linter}` : null,
    result.formatter ? `Formatter: ${result.formatter}` : null,
    result.deployment ? `Deployed on ${result.deployment}` : null,
  ].filter(Boolean);

  return result;
}

module.exports = { analyzeProject };
