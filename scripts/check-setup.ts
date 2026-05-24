import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: false, quiet: true });
dotenv.config({ path: ".env", override: false, quiet: true });

type CheckLevel = "ok" | "warn" | "missing";

const results: Array<{ level: CheckLevel; label: string; detail?: string }> = [];

function add(level: CheckLevel, label: string, detail?: string) {
  results.push({ level, label, detail });
}

function env(name: string) {
  return process.env[name]?.trim();
}

function commandExists(command: string) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function checkEnv(name: string, required = true) {
  const value = env(name);
  if (value) add("ok", name, "set");
  else add(required ? "missing" : "warn", name, required ? "required" : "optional");
}

function checkPath(name: string, value?: string) {
  if (!value) {
    add("missing", name, "not set");
    return;
  }
  if (!existsSync(value)) {
    add("missing", name, `${value} does not exist`);
    return;
  }
  add("ok", name, value);
}

function checkExecutable(label: string, preferred?: string, fallbackCommand?: string) {
  if (preferred && existsSync(preferred)) {
    add("ok", label, preferred);
    return preferred;
  }

  if (fallbackCommand) {
    const found = commandExists(fallbackCommand);
    if (found) {
      add("ok", label, found);
      return found;
    }
  }

  add("missing", label, preferred || fallbackCommand || "not found");
  return null;
}

function checkPythonPackage(pythonBin: string | null, packageName: string) {
  if (!pythonBin) {
    add("missing", packageName, "python not found");
    return;
  }
  const result = spawnSync(pythonBin, ["-c", `import ${packageName.replace("-", "_")}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status === 0) add("ok", packageName, "installed");
  else add("missing", packageName, `install with: ${pythonBin} -m pip install --user ${packageName}`);
}

console.log("YouTube Production Hub setup check\n");

add(existsSync(".env.local") ? "ok" : "warn", ".env.local", existsSync(".env.local") ? "present" : "copy from .env.example");
add(existsSync("node_modules") ? "ok" : "missing", "node_modules", existsSync("node_modules") ? "present" : "run npm install");

checkEnv("NEXT_PUBLIC_SUPABASE_URL");
checkEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
checkEnv("SUPABASE_SERVICE_ROLE_KEY");
checkEnv("ALLOWED_EMAILS", false);
checkEnv("NEXT_PUBLIC_SITE_URL", false);

checkEnv("GOOGLE_DRIVE_FOLDER_ID", false);
const googleCredPath = env("GOOGLE_APPLICATION_CREDENTIALS");
const googleCredJson = env("GOOGLE_SERVICE_ACCOUNT_JSON");
if (googleCredJson) add("ok", "Google credentials", "GOOGLE_SERVICE_ACCOUNT_JSON set");
else checkPath("GOOGLE_APPLICATION_CREDENTIALS", googleCredPath);

if (env("TRANSCRIPT_MARKDOWN_EXPORT") === "1") {
  checkPath("OBSIDIAN_VAULT_DIR", env("OBSIDIAN_VAULT_DIR"));
} else {
  add("warn", "OBSIDIAN_VAULT_DIR", "not required when TRANSCRIPT_MARKDOWN_EXPORT=0");
}
checkEnv("GITHUB_TRANSCRIPTS_DIR", false);

checkExecutable("git", undefined, "git");
checkExecutable("gh", undefined, "gh");
checkExecutable("vercel", undefined, "vercel");
checkExecutable("yt-dlp", env("YTDLP_BIN"), "yt-dlp");
const pythonBin = checkExecutable("python", env("PYTHON_BIN"), "python3");
checkPythonPackage(pythonBin, "faster-whisper");

for (const result of results) {
  const icon = result.level === "ok" ? "OK" : result.level === "warn" ? "WARN" : "MISSING";
  console.log(`${icon.padEnd(7)} ${result.label}${result.detail ? ` - ${result.detail}` : ""}`);
}

const missing = results.filter((result) => result.level === "missing").length;
const warnings = results.filter((result) => result.level === "warn").length;
console.log(`\n${results.length - missing - warnings} OK, ${warnings} warnings, ${missing} missing`);

if (missing) process.exitCode = 1;
