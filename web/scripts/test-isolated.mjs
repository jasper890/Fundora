/** Fresh local containers only; no demo database, .env.local, or wallet material. */
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(web, "..");
const scratch = await mkdtemp(resolve(tmpdir(), "proofpay-isolated-"));
const cli = resolve(web, "node_modules/supabase/dist/supabase.js");
const projectId = `proofpay-test-${process.pid}`;
const env = {
  ...process.env,
  PROOFPAY_TEST_ISOLATED: "1",
  STELLAR_USE_FAKE_RPC: "1",
  STELLAR_ALLOW_SUBMISSION: "0",
  STELLAR_WASM_HASH: "",
  NEXT_DIST_DIR: ".next-e2e",
  AUTH_THROTTLE_SECRET: "isolated-test-throttle-only",
  CRON_SECRET: "isolated-test-cron-only",
  SEED_PREFIX: "demo",
  SEED_PASSWORD: "ProofPay-Demo-Password-12",
};
// Never inherit wallet overrides or hosted service credentials into this stack.
for (const key of Object.keys(env)) {
  if (/^SEED_.*WALLET$/.test(key) || /^(SUPABASE_ACCESS_TOKEN|SUPABASE_PROJECT_ID)$/.test(key)) delete env[key];
}

function run(file, args, capture = false) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(file, args, { cwd: web, env, windowsHide: true, stdio: capture ? "pipe" : "inherit" });
    let output = "";
    if (capture) {
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", () => {}); // CLI status can contain credentials.
    }
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolveRun(output) : reject(new Error(`${args[0]} exited ${code}; private CLI output suppressed`)));
  });
}
const supabase = (...args) => run(process.execPath, [cli, ...args, "--workdir", scratch], true);

await mkdir(resolve(scratch, "supabase"));
const original = await readFile(resolve(root, "supabase/config.toml"), "utf8");
const config = original
  .replace(/^project_id = .*$/m, `project_id = "${projectId}"`)
  .replaceAll("5432", "5532")
  .replaceAll("8083", "8183")
  .replaceAll(":3000", ":3001");
await writeFile(resolve(scratch, "supabase/config.toml"), config);
await cp(resolve(root, "supabase/migrations"), resolve(scratch, "supabase/migrations"), { recursive: true });
await cp(resolve(root, "supabase/seed.sql"), resolve(scratch, "supabase/seed.sql"));
await cp(resolve(root, "supabase/tests"), resolve(scratch, "supabase/tests"), { recursive: true });

let started = false;
try {
  console.log("Starting isolated Supabase on ports 55321/55322; existing demo stack is untouched.");
  started = true;
  await supabase("start", "--exclude", "studio,postgres-meta,edge-runtime,logflare,vector,realtime,imgproxy,supavisor");
  const status = JSON.parse(await supabase("status", "--output", "json"));
  env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = status.ANON_KEY;
  env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
  env.DATABASE_URL = status.DB_URL;
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.DATABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Isolated stack status omitted required credentials; nothing was printed.");
  }
  console.log("Seeding fresh synthetic test accounts.");
  await run(process.execPath, [resolve(web, "node_modules/tsx/dist/cli.mjs"), "scripts/seed.ts"], true);
  const dbChecks = await supabase("test", "db");
  console.log(dbChecks);
  if (process.argv.includes("--db-only")) {
    console.log("Isolated database checks completed.");
  } else if (process.argv.includes("--serve")) {
    await run(process.execPath, [resolve(web, "node_modules/next/dist/bin/next"), "build"]);
    console.log("Isolated review app: http://localhost:3001 (FakeRpc only).");
    await run(process.execPath, [resolve(web, "node_modules/next/dist/bin/next"), "start", "-p", "3001", "-H", "127.0.0.1"]);
  } else {
    await run(process.execPath, [resolve(web, "node_modules/@playwright/test/cli.js"), "test", ...process.argv.slice(2)]);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) {
    await supabase("stop").catch(() => { console.error("Stop isolated test stack manually; original demo stack remains untouched."); });
  }
}
