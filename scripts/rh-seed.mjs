/**
 * Seed RH — 10 lignes placeholder.
 * 2 titulaires par poste (Sushiman, Wokman, Serveur, Piston) + 2 extras polyvalents.
 * Idempotent : ne fait rien si des employés existent déjà (sauf --force).
 *
 * Usage : node scripts/rh-seed.mjs [--force]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const force = process.argv.includes("--force");

const POSTES = ["Sushiman", "Wokman", "Serveur", "Piston"];

const titulaires = POSTES.flatMap((role) =>
  [1, 2].map((n) => ({ name: `${role} ${n}`, role, isExtra: false, phone: null }))
);

const extras = [
  { name: "Extra polyvalent 1", role: "Polyvalent", isExtra: true, phone: null },
  { name: "Extra polyvalent 2", role: "Polyvalent", isExtra: true, phone: null },
];

const rows = [...titulaires, ...extras];

async function main() {
  const existing = await prisma.employee.count();
  if (existing > 0 && !force) {
    console.log(`↷ ${existing} employé(s) déjà présents — seed ignoré (utilisez --force pour ajouter quand même).`);
    return;
  }
  const created = await prisma.employee.createMany({ data: rows });
  console.log(`✓ ${created.count} employés créés (${titulaires.length} titulaires + ${extras.length} extras).`);
  const summary = await prisma.employee.groupBy({ by: ["role", "isExtra"], _count: true });
  summary.forEach((s) => console.log(`  - ${s.role}${s.isExtra ? " (extra)" : ""} : ${s._count}`));
}

main()
  .catch((e) => {
    console.error("Erreur seed RH :", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
