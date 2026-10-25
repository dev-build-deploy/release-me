// SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
// SPDX-License-Identifier: CC0-1.0

// pre-commit hook: rebuilds the bundles and fails when they differ from what is staged.
// Usage: node scripts/check-lib.mjs [dir...] (default: lib).

import { spawnSync } from "node:child_process";

const dirs = process.argv.length > 2 ? process.argv.slice(2) : ["lib"];

const build = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (build.status !== 0) {
  console.error("\nerror: `npm run build` failed (see above).");
  process.exit(1);
}

const run = (args) =>
  spawnSync("git", args, { encoding: "utf8" }).stdout.trim();
const changed = run(["diff", "--name-only", "--", ...dirs]);
const untracked = run([
  "ls-files",
  "--others",
  "--exclude-standard",
  "--",
  ...dirs,
]);

if (changed || untracked) {
  console.error(
    `\nerror: ${dirs.join(", ")} is out of date with the source you are committing:`,
  );
  for (const f of [changed, untracked].join("\n").split("\n").filter(Boolean))
    console.error(`  ${f}`);
  console.error(`\nhint: npm run build && git add ${dirs.join(" ")}`);
  process.exit(1);
}
