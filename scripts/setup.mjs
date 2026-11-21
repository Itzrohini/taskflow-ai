import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const nodeMajor = Number(process.versions.node.split(".")[0]);

function fail(message) {
  console.error(`Setup failed: ${message}`);
  process.exit(1);
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });
  if (result.error) {
    return { ok: false, error: result.error };
  }
  return { ok: result.status === 0, status: result.status };
}

if (nodeMajor < 20) {
  fail(`Node.js 20+ is required; found ${process.version}.`);
}

function findPython() {
  const candidates = isWindows
    ? [["py", ["-3"]], ["python", []]]
    : [["python3", []], ["python", []]];

  for (const [command, baseArgs] of candidates) {
    const result = spawnSync(command, [...baseArgs, "-c", "import sys; print('.'.join(map(str, sys.version_info[:3])))"], {
      cwd: root,
      encoding: "utf8",
    });
    if (!result.error && result.status === 0) {
      const version = result.stdout.trim();
      const match = /^(\d+)\.(\d+)\./.exec(version);
      if (match && (Number(match[1]) > 3 || (Number(match[1]) === 3 && Number(match[2]) >= 11))) {
        return { command, baseArgs, version };
      }
    }
  }
  return null;
}

const python = findPython();
if (!python) {
  fail("Python 3.11+ was not found. Install Python 3.11+ and ensure py/python3/python is on PATH.");
}

console.log(`Found Node.js ${process.version} and Python ${python.version}.`);

const npm = isWindows ? "npm.cmd" : "npm";
let npmInstall;
if (isWindows) {
  const comspec = process.env.ComSpec || "cmd.exe";
  npmInstall = run(comspec, ["/d", "/c", npm, "install"]);
} else {
  npmInstall = run(npm, ["install"]);
}
if (!npmInstall.ok) {
  fail("npm install failed.");
}

const backendDir = join(root, "backend");
const venvDir = join(backendDir, ".venv");
const venvPython = isWindows
  ? join(venvDir, "Scripts", "python.exe")
  : join(venvDir, "bin", "python");

let venvCreated = false;
if (!existsSync(venvPython)) {
  const venvResult = run(python.command, [...python.baseArgs, "-m", "venv", venvDir]);
  if (!venvResult.ok) {
    fail("Could not create backend/.venv.");
  }
  venvCreated = true;
}
if (!existsSync(venvPython)) {
  fail("The backend virtual environment Python executable was not found.");
}

const requirements = join(backendDir, "requirements-dev.txt");
const pipInstall = run(venvPython, ["-m", "pip", "install", "-r", requirements], backendDir);
if (!pipInstall.ok) {
  fail("Could not install backend development requirements.");
}

let envFilesCreated = 0;
const copies = [
  [join(root, ".env.example"), join(root, ".env.local")],
  [join(backendDir, ".env.example"), join(backendDir, ".env")],
];
for (const [source, target] of copies) {
  if (!existsSync(source)) {
    fail(`Missing required example file: ${source}`);
  }
  if (!existsSync(target)) {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    envFilesCreated += 1;
  }
}

console.log("\nSetup checklist:");
console.log("- Set MONGODB_URI and GEMINI_API_KEY in backend/.env");
console.log("- Start the backend: cd backend && python -m uvicorn app.main:app --reload --port 8000");
console.log("- Start the frontend: npm run dev");

if (!venvCreated && envFilesCreated === 0) {
  console.log("\nSetup is already complete; no environment files or virtual environment needed to change.");
}
