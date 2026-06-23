#!/usr/bin/env node
/**
 * Agent d'impression Asian Nour — à exécuter SUR PLACE (même réseau que l'imprimante).
 *
 * Il interroge le serveur en production, récupère les tickets en attente
 * et les envoie à l'imprimante thermique en TCP (port 9100, ESC/POS).
 *
 * Prérequis : Node.js 18+ (fonctionne dans Termux sur Android).
 *
 * Utilisation :
 *   PRINT_AGENT_TOKEN=xxxx node print-agent.mjs
 *
 * Variables d'environnement :
 *   PRINT_AGENT_TOKEN  (obligatoire) — même valeur que sur Vercel
 *   SERVER_URL         (défaut : https://asiannourqr.vercel.app)
 *   POLL_MS            (défaut : 3000)
 */

import net from "node:net";

const SERVER_URL = (process.env.SERVER_URL || "https://asiannourqr.vercel.app").replace(/\/+$/, "");
const TOKEN = process.env.PRINT_AGENT_TOKEN || "";
const POLL_MS = Math.max(1000, Number(process.env.POLL_MS) || 3000);

if (!TOKEN) {
  console.error("ERREUR : définissez PRINT_AGENT_TOKEN (le même que sur Vercel).");
  console.error("Exemple : PRINT_AGENT_TOKEN=xxxx node print-agent.mjs");
  process.exit(1);
}

const HEADERS = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

function log(...args) {
  console.log(new Date().toLocaleTimeString("fr-FR"), ...args);
}

function sendToPrinter(ip, port, payload) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    const succeed = () => {
      if (settled) return;
      settled = true;
      socket.end();
      resolve();
    };
    socket.setTimeout(5000);
    socket.once("timeout", () => fail(new Error("Imprimante injoignable (délai dépassé)")));
    socket.once("error", fail);
    socket.connect(port, ip, () => {
      socket.write(payload, (err) => (err ? fail(err) : succeed()));
    });
  });
}

async function reportJob(id, ok, error) {
  try {
    await fetch(`${SERVER_URL}/api/print-agent/jobs/${id}`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(ok ? { ok: true } : { ok: false, error: String(error) }),
    });
  } catch (err) {
    log("⚠ Impossible de signaler le job", id, "-", err.message);
  }
}

let lastErrorMessage = "";
let loggedPrintersOnce = false;

async function tick() {
  let data;
  try {
    const res = await fetch(`${SERVER_URL}/api/print-agent/jobs`, { headers: HEADERS });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    data = await res.json();
    if (lastErrorMessage) {
      log("✓ Connexion au serveur rétablie");
      lastErrorMessage = "";
    }
  } catch (err) {
    if (err.message !== lastErrorMessage) {
      log("⚠ Serveur injoignable :", err.message);
      lastErrorMessage = err.message;
    }
    return;
  }

  const { printers, printer, jobs } = data;

  if (!loggedPrintersOnce) {
    loggedPrintersOnce = true;
    const k = printers?.kitchen ?? printer;
    const c = printers?.customer;
    const x = printers?.extra;
    log("Imprimante cuisine :", k?.ip ? `${k.ip}:${k.port || 9100}` : "NON CONFIGURÉE");
    log("Imprimante caisse   :", c?.ip ? `${c.ip}:${c.port || 9100}` : "NON CONFIGURÉE");
    log("Imprimante extra    :", x?.ip ? `${x.ip}:${x.port || 9100}` : "NON CONFIGURÉE");
    if (k?.ip && c?.ip && k.ip === c.ip) {
      log("⚠ ATTENTION : les deux imprimantes ont la MÊME IP — tous les tickets sortiront au même endroit !");
    }
  }

  if (!jobs?.length) return;

  for (const job of jobs) {
    const target =
      job.target === "customer" ? "customer" : job.target === "extra" ? "extra" : "kitchen";
    const resolved =
      (printers && printers[target]) || (target === "kitchen" ? printer : null);

    if (!resolved?.ip) {
      const label =
        target === "customer" ? "caisse" : target === "extra" ? "supplementaire" : "cuisine";
      log(`⚠ Imprimante ${label} non configurée ; job en attente :`, job.label);
      await reportJob(job.id, false, `Imprimante ${target} non configurée`);
      continue;
    }

    const payload = Buffer.from(job.payload, "base64");
    try {
      await sendToPrinter(resolved.ip, resolved.port || 9100, payload);
      log(`🖨 [${target}] ${resolved.ip}:${resolved.port || 9100} → ${job.label}`);
      await reportJob(job.id, true);
    } catch (err) {
      log(`✗ [${target}] Échec « ${job.label} » :`, err.message);
      await reportJob(job.id, false, err.message);
      break;
    }
  }
}

log("Agent d'impression Asian Nour démarré");
log("Serveur :", SERVER_URL, "| Intervalle :", POLL_MS, "ms");
log("Appuyez sur Ctrl+C pour arrêter.");

(async function loop() {
  for (;;) {
    await tick();
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
})();
