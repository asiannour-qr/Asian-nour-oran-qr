/** Identifiant maître dédié à la tablette serveur (prioritaire sur les convives). */
export function getStaffTableDeviceId(tableId: string): string {
  return `staff-serv-${String(tableId).trim()}`;
}
