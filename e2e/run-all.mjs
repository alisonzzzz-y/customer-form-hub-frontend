// One-command E2E runner: starts the contract mock backend (:8080) and a
// dedicated Vite dev server (:5199), waits for both, then runs every
// *.spec.mjs in this folder sequentially. Requires nothing to be running.
import { spawn, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

async function waitFor(url, label, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`${label} did not become reachable at ${url}`);
}

const mock = spawn("node", [join(root, "tools", "mock-backend.mjs")], { stdio: "ignore" });
const vite = spawn("npx", ["vite", "--port", "5199", "--strictPort"], {
  cwd: root,
  stdio: "ignore",
});
const cleanup = () => {
  mock.kill();
  vite.kill();
};
process.on("exit", cleanup);

try {
  await waitFor("http://localhost:8080/api/tickets", "mock backend");
  await waitFor("http://localhost:5199/", "vite dev server");

  const specs = readdirSync(here).filter((f) => f.endsWith(".spec.mjs")).sort();
  let failed = 0;
  for (const spec of specs) {
    process.stdout.write(`\n── ${spec} ──\n`);
    const r = spawnSync("node", [join(here, spec)], { stdio: "inherit" });
    if (r.status !== 0) failed++;
  }
  console.log(failed === 0 ? `\nAll ${specs.length} suites passed.` : `\n${failed} suite(s) FAILED.`);
  process.exitCode = failed === 0 ? 0 : 1;
} finally {
  cleanup();
}
