#!/usr/bin/env node
/**
 * Guards against three defect classes that `tsc --noEmit` cannot see, each of
 * which shipped to this branch during the July 2026 hardening pass:
 *
 *   1. A hook called after an early return. The cancellation screen crashed
 *      with "Rendered more hooks than during the previous render" for every
 *      player who opened it, because a sync effect was inserted below the
 *      `if (!booking) return` guard.
 *
 *   2. clearInterval/clearTimeout on a handle declared later in the same
 *      block. The countdown threw a ReferenceError on mount for any match
 *      that had already kicked off, because the first tick runs synchronously
 *      while the `const` holding the timer is still in its temporal dead zone.
 *
 *   3. Per-call callbacks on a shared mutation observer inside a loop. Chat
 *      retry delivered every queued message but dequeued only the last, so
 *      the rest re-sent on each reconnect and duplicated in the thread.
 *
 * No dependencies — plain node, so it runs anywhere the repo does.
 *   node scripts/check-patterns.mjs      (or: pnpm run check:patterns)
 *
 * Exits non-zero on a finding. Heuristic, not a type system: it is meant to
 * be cheap and to fail loudly on the shapes that actually bit us. If it
 * reports something deliberate, restructure or narrow the check — don't
 * silence it wholesale.
 */
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIRS = ["app", "components", "lib"];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const files = DIRS.flatMap((d) => walk(join(ROOT, d)));
const findings = [];

const HOOK_CALL = /\buse(?:State|Effect|LayoutEffect|Memo|Callback|Ref|Reducer|Context|Query|Mutation|InfiniteQuery|Router|LocalSearchParams|WindowDimensions|SafeAreaInsets|Auth|I18n|ServerCountdown|Connectivity|IsOffline|DelayedVisible)\s*\(/;
// A guard clause at component-body indentation, not inside a nested callback.
const EARLY_RETURN = /^ {2}(?:if\s*\([^)]*\)\s*(?:return|\{)|return\b)/;
const COMPONENT = /^export (?:default )?function [A-Z]/;

for (const file of files) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");

  // ── 1. hook after an early return ────────────────────────────────────────
  let inComponent = false;
  let sawReturn = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (COMPONENT.test(line)) { inComponent = true; sawReturn = 0; continue; }
    if (inComponent && /^\}/.test(line)) { inComponent = false; continue; }
    if (!inComponent) continue;
    if (!sawReturn && EARLY_RETURN.test(line) && !line.includes("=>")) { sawReturn = i + 1; continue; }
    if (sawReturn && HOOK_CALL.test(line) && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
      findings.push({
        rule: "hook-after-early-return",
        where: `${rel}:${i + 1}`,
        detail: `hook called below the guard on line ${sawReturn}; hook count changes between renders`,
      });
      break;
    }
  }

  // ── 2. timer cleared before its handle exists ────────────────────────────
  for (const m of src.matchAll(/clear(?:Interval|Timeout)\(\s*(\w+)\s*\)/g)) {
    const name = m.group ? m.group(1) : m[1];
    const decl = src.search(new RegExp(`\\b(?:const|let|var)\\s+${name}\\b`));
    if (decl > -1 && decl > m.index) {
      findings.push({
        rule: "timer-cleared-before-declared",
        where: `${rel}:${src.slice(0, m.index).split("\n").length}`,
        detail: `clear...(${name}) runs before ${name} is initialised (temporal dead zone)`,
      });
    }
  }

  // ── 3. shared mutation observer driven from a loop ───────────────────────
  if (/\.mutate\(/.test(src)) {
    for (let i = 0; i < lines.length; i++) {
      if (!/\b(?:forEach|map)\s*\(/.test(lines[i])) continue;
      const window = lines.slice(i, i + 4).join("\n");
      if (/\w+\s*\(/.test(window) && /\.mutate\(/.test(src)) {
        // Only flag when the loop body calls a helper that itself uses .mutate
        // with per-call callbacks — mutateAsync is the correct form here.
        const helper = window.match(/=>\s*(\w+)\(/);
        if (helper) {
          const name = helper[1];
          const body = src.match(new RegExp(`const ${name} = [^;]*?\\.mutate\\(`, "s"));
          if (body && !src.includes(`${name} = async`)) {
            findings.push({
              rule: "shared-mutation-observer-in-loop",
              where: `${rel}:${i + 1}`,
              detail: `${name}() uses .mutate with per-call callbacks; only the last call's callbacks run — use mutateAsync and await`,
            });
          }
        }
      }
    }
  }
}

if (findings.length === 0) {
  console.log(`check-patterns: clean (${files.length} files)`);
  process.exit(0);
}

for (const f of findings) {
  console.error(`${f.where}\n  [${f.rule}] ${f.detail}\n`);
}
console.error(`check-patterns: ${findings.length} finding(s)`);
process.exit(1);
