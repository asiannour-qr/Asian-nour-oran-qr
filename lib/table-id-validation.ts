import { getSettings } from "@/lib/settings";
import { resolveTableCount } from "@/lib/table-count";

/** Valide un numéro de table sur place (1..tableCount). */
export async function assertValidDineInTableId(
  tableId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = String(tableId ?? "").trim();
  if (!id || id === "EMPORTER") {
    return { ok: false, message: "Table invalide" };
  }
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, message: "Numéro de table invalide" };
  }
  const settings = await getSettings();
  const max = resolveTableCount(settings.tableCount);
  if (n > max) {
    return {
      ok: false,
      message: `Cette table n'existe pas (maximum : ${max})`,
    };
  }
  return { ok: true };
}
