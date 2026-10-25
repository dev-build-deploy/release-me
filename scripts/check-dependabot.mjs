// SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
// SPDX-License-Identifier: CC0-1.0

// pre-commit hook: the commit messages Dependabot writes must pass .github/.commit-me.json.
//
// Dependabot writes `<prefix>(deps)` for production and `<prefix>(deps-dev)` for development
// dependencies (with `include: scope`), or `<prefix>` alone. Every update block in
// .github/dependabot.yml must set `commit-message.prefix` explicitly, and the resulting
// type and scopes must be allowed by the CommitMe configuration.

import { existsSync, readFileSync } from "node:fs";

const DEPENDABOT = ".github/dependabot.yml";
const COMMIT_ME = ".github/.commit-me.json";
if (!existsSync(DEPENDABOT)) process.exit(0);

const config = JSON.parse(readFileSync(COMMIT_ME, "utf8"));
const strip = (v) =>
  v
    .replace(/\s+#.*$/, "")
    .trim()
    .replace(/^["']|["']$/g, "");

// Minimal line-based read of the `updates:` list (no YAML dependency needed).
const updates = [];
let current = null;
let inMessage = false;
let messageIndent = 0;
for (const raw of readFileSync(DEPENDABOT, "utf8").split("\n")) {
  if (/^\s*(#|$)/.test(raw)) continue;
  const indent = raw.match(/^ */)[0].length;
  const item = raw.match(/^\s*- package-ecosystem:\s*(.+)$/);
  if (item) {
    current = { ecosystem: strip(item[1]), message: {} };
    updates.push(current);
    inMessage = false;
    continue;
  }
  if (!current) continue;
  const block = raw.match(/^\s*commit-message:\s*$/);
  if (block) {
    inMessage = true;
    messageIndent = indent;
    continue;
  }
  if (inMessage && indent <= messageIndent) inMessage = false;
  const kv = raw.match(/^\s*([a-z-]+):\s*(.*)$/);
  if (inMessage && kv) current.message[kv[1]] = strip(kv[2]);
}

const errors = [];
for (const u of updates) {
  const m = u.message;
  if (!m.prefix) {
    errors.push(
      `${u.ecosystem}: set commit-message.prefix explicitly (Dependabot otherwise guesses it from history).`,
    );
    continue;
  }
  const prefixes = new Set([m.prefix, m["prefix-development"] ?? m.prefix]);
  const scopes =
    m.include !== "scope"
      ? []
      : u.ecosystem === "github-actions"
        ? ["deps"]
        : ["deps", "deps-dev"];
  for (const type of prefixes) {
    if (config.types && !config.types.includes(type))
      errors.push(
        `${u.ecosystem}: type "${type}" is not in ${COMMIT_ME} types (${config.types.join(", ")}).`,
      );
  }
  for (const scope of scopes) {
    if (config.scopes && !config.scopes.includes(scope))
      errors.push(
        `${u.ecosystem}: Dependabot writes scope "${scope}", missing from ${COMMIT_ME} scopes.`,
      );
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}
