import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { NextRequest } from "next/server.js";
// Load the actual TypeScript implementation without changing app module aliases.
function load(path, dependencies = {}) {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  const require = createRequire(filename);
  new Function("require", "module", "exports", compiled)(
    (name) => dependencies[name] || require(name),
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}
const site = load("../src/lib/site.ts");
const { proxy } = load("../src/proxy.ts", { "@/lib/site": site });
const keys = ["VERCEL_ENV", "APP_URL", "NEXTAUTH_URL"];
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
try {
  delete process.env.APP_URL;
  process.env.VERCEL_ENV = "production";
  process.env.NEXTAUTH_URL = "https://priyo-email-tracker.vercel.app";
  assert.equal(site.applicationOrigin(), "https://track.drdoom.world");
  assert.equal(
    site.authenticationRedirect(
      "https://priyo-email-tracker.vercel.app/settings",
      process.env.NEXTAUTH_URL,
    ),
    "https://track.drdoom.world/settings",
  );
  assert.equal(
    site.authenticationRedirect(
      "/campaigns?status=DRAFT",
      process.env.NEXTAUTH_URL,
    ),
    "https://track.drdoom.world/campaigns?status=DRAFT",
  );
  assert.equal(
    site.authenticationRedirect(
      "https://attacker.example",
      process.env.NEXTAUTH_URL,
    ),
    "https://track.drdoom.world",
  );
  let response = await proxy(
    new NextRequest(
      "https://priyo-email-tracker.vercel.app/login?callbackUrl=%2Fsettings",
    ),
  );
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://track.drdoom.world/login?callbackUrl=%2Fsettings",
  );
  response = await proxy(new NextRequest("https://track.drdoom.world/login"));
  assert.equal(response.status, 200);
  // Regression: the old guard returned 403 before NextAuth could check CSRF.
  response = await proxy(
    new NextRequest(
      "https://track.drdoom.world/api/auth/callback/credentials",
      { method: "POST", headers: { origin: "https://track.drdoom.world" } },
    ),
  );
  assert.equal(response.status, 200);
  response = await proxy(
    new NextRequest("https://track.drdoom.world/api/campaigns", {
      method: "POST",
      headers: { origin: "https://track.drdoom.world" },
    }),
  );
  assert.equal(response.status, 200);
  response = await proxy(
    new NextRequest("https://track.drdoom.world/api/campaigns", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    }),
  );
  assert.equal(response.status, 403);
  process.env.VERCEL_ENV = "preview";
  process.env.NEXTAUTH_URL = "https://preview.vercel.app";
  assert.equal(site.applicationOrigin(), "https://preview.vercel.app");
  response = await proxy(new NextRequest("https://preview.vercel.app/login"));
  assert.equal(response.status, 200);
  delete process.env.VERCEL_ENV;
  process.env.NEXTAUTH_URL = "http://localhost:3100";
  assert.equal(
    site.authenticationRedirect("/", process.env.NEXTAUTH_URL),
    "http://localhost:3100/",
  );
  console.log(
    "Passed 13 production-domain, callback, origin-guard, preview, and local-origin checks.",
  );
} finally {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}
