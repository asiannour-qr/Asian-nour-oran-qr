import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const NEXT_BIN = path.join(PROJECT_ROOT, "node_modules", ".bin", "next");
const TARGET_PORTS = Array.from({ length: 11 }, (_, idx) => 3000 + idx);
const HOST = "127.0.0.1";
const PORT_READY_REGEX = /started server on [^:]+:(\d+)/i;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureNextBinary() {
  if (!fs.existsSync(NEXT_BIN)) {
    console.error("❌ Binaire Next introuvable. Exécutez `npm install` avant `npm run dev:auto`.");
    process.exit(1);
  }
}

function collectPortPids(port) {
  try {
    const output = execSync(`lsof -ti :${port}`, {
      stdio: ["pipe", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (!output) return [];
    return output
      .split(/\s+/)
      .map((pid) => Number.parseInt(pid, 10))
      .filter((pid) => Number.isInteger(pid));
  } catch {
    return [];
  }
}

function collectNextDevPids() {
  try {
    const output = execSync("ps -axo pid=,command=", {
      stdio: ["pipe", "pipe", "ignore"],
    }).toString();

    const lines = output.split("\n");
    const pids = [];
    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\s+(.*)$/);
      if (!match) continue;
      const pid = Number.parseInt(match[1], 10);
      const command = match[2] || "";
      if (!Number.isInteger(pid) || pid === process.pid) continue;
      const isNextDev =
        /\bnext\b.*\bdev\b/i.test(command) ||
        /\bnode\b.*\bnext\b.*\bdev\b/i.test(command);
      if (isNextDev) {
        pids.push(pid);
      }
    }
    return pids;
  } catch {
    return [];
  }
}

async function killPids(pids) {
  const uniquePids = [...new Set(pids)].filter(
    (pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid,
  );
  if (!uniquePids.length) return;

  for (const pid of uniquePids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore
    }
  }

  await delay(400);

  for (const pid of uniquePids) {
    try {
      process.kill(pid, 0);
    } catch {
      continue;
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ignore
    }
  }
}

async function clearExistingServers() {
  const portPids = TARGET_PORTS.flatMap((port) => collectPortPids(port));
  const nextDevPids = collectNextDevPids();
  const allPids = [...portPids, ...nextDevPids];
  await killPids(allPids);
}

function startNextDev() {
  const child = spawn(NEXT_BIN, ["dev", "-H", HOST, "-p", "0"], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: "0",
    },
    stdio: ["inherit", "pipe", "pipe"],
  });

  let portAnnounced = false;

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    if (!portAnnounced) {
      const match = text.match(PORT_READY_REGEX);
      if (match) {
        portAnnounced = true;
        console.log(`🔗 Next écoute sur http://localhost:${match[1]}`);
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  child.on("close", (code) => {
    process.exitCode = code ?? 0;
  });

  child.on("error", (error) => {
    console.error("❌ Impossible de lancer Next :", error);
    process.exitCode = 1;
  });

  const forward = (signal) => {
    child.kill(signal);
  };

  for (const signal of ["SIGINT", "SIGTERM", "SIGQUIT"]) {
    process.on(signal, forward);
  }
}

async function main() {
  ensureNextBinary();
  await clearExistingServers();
  console.log("✅ Port(s) libérés. Démarrage de Next sur un port libre…");
  startNextDev();
}

main().catch((error) => {
  console.error("❌ Erreur inattendue :", error);
  process.exit(1);
});
