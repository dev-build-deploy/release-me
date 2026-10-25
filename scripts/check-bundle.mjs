// SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
// SPDX-License-Identifier: CC0-1.0

// Fails when an ncc bundle contains a stubbed-out module.
//
// ncc does not fail the build when it cannot resolve a package (e.g. an ESM-only
// release such as @actions/core 3.x); it replaces the import with a stub that throws
// "Cannot find module '...'" at runtime. That makes `npm run build` look green while
// the bundle is broken. Usage: node scripts/check-bundle.mjs [dir...] (default: lib).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MARKER = "webpackMissingModule";
const dirs = process.argv.length > 2 ? process.argv.slice(2) : ["lib"];

function* files(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(c|m)?js$/.test(path)) yield path;
  }
}

let failed = false;
for (const dir of dirs) {
  for (const file of files(dir)) {
    const text = readFileSync(file, "utf8");
    if (!text.includes(MARKER)) continue;
    failed = true;
    const missing = new Set(
      [...text.matchAll(/Cannot find module '([^']+)'/g)].map((m) => m[1]),
    );
    console.error(
      `error: ${file} contains ${MARKER}: ncc could not resolve ${[...missing].join(", ") || "a module"}.`,
    );
  }
}

if (failed) {
  console.error(
    "ncc bundled a stub that throws at runtime. The package is probably ESM-only or has an " +
      "incompatible `exports` map for the installed ncc: do not ship this bump.",
  );
  process.exit(1);
}
