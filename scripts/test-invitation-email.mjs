import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";

const filename = new URL("../src/lib/email-templates.ts", import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const loadedModule = { exports: {} };
const require = createRequire(filename);
new Function("require", "module", "exports", compiled)(
  (name) =>
    name === "@/lib/permissions"
      ? {
          roleLabels: {
            ADMIN: "Admin",
            CAMPAIGN_MANAGER: "Campaign manager",
            MEMBER: "Member",
            VIEWER: "Viewer",
          },
        }
      : require(name),
  loadedModule,
  loadedModule.exports,
);

const email = loadedModule.exports.invitationEmail({
  name: '<img src=x onerror="alert(1)">',
  workspaceName: "Design & Delivery",
  inviterName: "Alex <alex@example.com>",
  role: "CAMPAIGN_MANAGER",
  inviteUrl: "https://signalpost.example/invite/secure-token?source=email&next=team",
});

assert.equal(email.subject, "You're invited to Signalpost");
assert.ok(email.text.includes("Design & Delivery"));
assert.ok(email.text.includes("Campaign manager"));
assert.ok(email.text.includes("expires in 7 days"));
assert.ok(email.html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
assert.ok(email.html.includes("Alex &lt;alex@example.com&gt;"));
assert.ok(
  email.html.includes(
    "https://signalpost.example/invite/secure-token?source=email&amp;next=team",
  ),
);
assert.ok(!email.html.includes('<img src=x onerror="alert(1)">'));
console.log("Invitation email content and HTML escaping checks passed.");
