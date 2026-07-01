"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Employee = { id: string; name: string; phone: string | null; role: string; isExtra: boolean; active?: boolean };
type Suggestion = { id: string; name: string; phone: string | null; role: string; isExtra: boolean };
type ShiftDTO = {
  id: string;
  dateKey: string;
  role: string;
  startMin: number;
  endMin: number;
  status: "PLANNED" | "ABSENT" | "REPLACED";
  employee: { id: string; name: string; phone: string | null; role: string };
  absence: { id: string; reason: string; note: string | null; replacedById: string | null; resolved: boolean } | null;
};
type Planning = { weekStart: string; days: string[]; employees: Employee[]; shifts: ShiftDTO[] };

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DEFAULT_ROLES = ["Sushiman", "Wokman", "Serveur", "Piston"];

function mm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function toMin(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}
function waLink(phone: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  return clean ? `https://wa.me/${clean}` : null;
}

export default function RhClient() {
  const [tab, setTab] = useState<"planning" | "equipe" | "extras">("planning");
  const [anchor, setAnchor] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Planning | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // panneau actions créneau
  const [panelShift, setPanelShift] = useState<ShiftDTO | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [absReason, setAbsReason] = useState("Imprévu");

  // modal création créneau
  const [addOpen, setAddOpen] = useState<{ dateKey: string; role: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/rh/planning?week=${anchor}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load");
      const json: Planning = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("Impossible de charger le planning.");
    } finally {
      setLoading(false);
    }
  }, [anchor]);

  useEffect(() => {
    load();
  }, [load]);

  // temps réel : rafraîchit toutes les 15 s (sauf si un panneau/modal est ouvert)
  useEffect(() => {
    const id = setInterval(() => {
      if (!panelShift && !addOpen) load();
    }, 15000);
    return () => clearInterval(id);
  }, [load, panelShift, addOpen]);

  const roles = useMemo(() => {
    const set = new Set<string>(DEFAULT_ROLES);
    data?.employees.forEach((e) => !e.isExtra && set.add(e.role));
    data?.shifts.forEach((s) => set.add(s.role));
    return Array.from(set);
  }, [data]);

  const titulaires = data?.employees.filter((e) => !e.isExtra) ?? [];
  const extras = data?.employees.filter((e) => e.isExtra) ?? [];

  const kpis = useMemo(() => {
    const shifts = data?.shifts ?? [];
    const planned = new Set(shifts.filter((s) => s.status !== "ABSENT").map((s) => s.employee.id)).size;
    const toReplace = shifts.filter((s) => s.status === "ABSENT" && !s.absence?.resolved).length;
    return { planned, toReplace, extras: extras.length };
  }, [data, extras.length]);

  function shiftsFor(role: string, dateKey: string): ShiftDTO[] {
    return (data?.shifts ?? []).filter((s) => s.role === role && s.dateKey === dateKey);
  }

  function shiftWeek(delta: number) {
    const d = new Date(`${data?.weekStart ?? anchor}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + delta * 7);
    setAnchor(d.toISOString().slice(0, 10));
    setLoading(true);
  }

  async function openPanel(s: ShiftDTO) {
    setPanelShift(s);
    setSuggestions([]);
    setAbsReason(s.absence?.reason ?? "Imprévu");
  }

  async function markAbsent() {
    if (!panelShift) return;
    const res = await fetch(`/api/admin/rh/shifts/${panelShift.id}/absence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: absReason }),
    });
    if (res.ok) {
      const json = await res.json();
      setSuggestions(json.suggestions ?? []);
      setPanelShift((p) => (p ? { ...p, status: "ABSENT", absence: { id: "tmp", reason: absReason, note: null, replacedById: null, resolved: false } } : p));
      await load();
    }
  }

  async function cancelAbsence() {
    if (!panelShift) return;
    const res = await fetch(`/api/admin/rh/shifts/${panelShift.id}/absence`, { method: "DELETE" });
    if (res.ok) {
      setSuggestions([]);
      setPanelShift(null);
      await load();
    }
  }

  async function chooseReplacement(replacedById: string) {
    if (!panelShift) return;
    const res = await fetch(`/api/admin/rh/shifts/${panelShift.id}/replace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replacedById }),
    });
    if (res.ok) {
      setPanelShift(null);
      setSuggestions([]);
      await load();
    }
  }

  async function deleteShift() {
    if (!panelShift) return;
    const res = await fetch(`/api/admin/rh/shifts/${panelShift.id}`, { method: "DELETE" });
    if (res.ok) {
      setPanelShift(null);
      await load();
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold">Équipe & Planning</h1>
          <p className="text-sm text-black/60">Gérez le planning, les absences et les remplaçants — en temps réel.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => shiftWeek(-1)} className="px-2.5 py-1.5 rounded-lg border border-black/10 hover:bg-black/5">←</button>
          <span className="font-semibold">
            {data ? `Semaine du ${shortDate(data.weekStart)}` : "…"}
          </span>
          <button onClick={() => shiftWeek(1)} className="px-2.5 py-1.5 rounded-lg border border-black/10 hover:bg-black/5">→</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Kpi label="Personnes planifiées" value={String(kpis.planned)} />
        <Kpi label="Absences à remplacer" value={String(kpis.toReplace)} highlight={kpis.toReplace > 0} />
        <Kpi label="Extras disponibles" value={String(kpis.extras)} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {([["planning", "Planning"], ["equipe", "Mon équipe"], ["extras", "Répertoire d'extras"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-lg border text-sm ${tab === id ? "border-[#7a5640] bg-[#7a5640] text-white" : "border-black/10 hover:bg-black/5"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}
      {loading && !data && <div className="text-black/50 py-10 text-center">Chargement…</div>}

      {data && tab === "planning" && (
        <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-black/50 border-b border-black/10">
                <th className="p-3 w-28">Poste</th>
                {data.days.map((d, i) => (
                  <th key={d} className="p-3 font-semibold">
                    {DAY_LABELS[i]} <span className="text-black/40 font-normal">{shortDate(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role} className="border-b border-black/5 align-top">
                  <td className="p-3 font-semibold">{role}</td>
                  {data.days.map((d) => (
                    <td key={d} className="p-2">
                      <div className="flex flex-col gap-1.5">
                        {shiftsFor(role, d).map((s) => (
                          <button
                            key={s.id}
                            onClick={() => openPanel(s)}
                            className={`text-left rounded-lg border px-2 py-1.5 transition ${
                              s.status === "ABSENT"
                                ? "border-red-300 bg-red-50"
                                : s.status === "REPLACED"
                                ? "border-emerald-300 bg-emerald-50"
                                : "border-black/10 bg-black/[0.02] hover:bg-black/5"
                            }`}
                          >
                            <div className="font-medium leading-tight">
                              {s.status === "ABSENT" && <span className="text-red-600">✖ </span>}
                              {s.employee.name}
                            </div>
                            <div className="text-[11px] text-black/50">{mm(s.startMin)}–{mm(s.endMin)}</div>
                          </button>
                        ))}
                        <button
                          onClick={() => setAddOpen({ dateKey: d, role })}
                          className="text-[11px] text-black/40 hover:text-[#7a5640] text-left px-1"
                        >
                          + créneau
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && tab === "equipe" && (
        <TeamList
          people={titulaires}
          roles={roles}
          isExtra={false}
          onChanged={load}
        />
      )}
      {data && tab === "extras" && (
        <TeamList
          people={extras}
          roles={[...roles, "Polyvalent"]}
          isExtra={true}
          onChanged={load}
        />
      )}

      {/* Panneau actions créneau */}
      {panelShift && (
        <Overlay onClose={() => setPanelShift(null)}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-lg font-bold">{panelShift.employee.name}</div>
              <div className="text-sm text-black/50">
                {panelShift.role} · {mm(panelShift.startMin)}–{mm(panelShift.endMin)}
              </div>
            </div>
            <button onClick={() => setPanelShift(null)} className="text-black/40 hover:text-black text-xl leading-none">×</button>
          </div>

          {panelShift.status !== "ABSENT" && (
            <div className="space-y-3">
              <label className="block text-sm font-medium">Motif d&apos;absence</label>
              <select value={absReason} onChange={(e) => setAbsReason(e.target.value)} className="w-full rounded-lg border border-black/15 px-3 py-2">
                {["Imprévu", "Maladie", "Congé", "Retard", "Autre"].map((r) => <option key={r}>{r}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={markAbsent} className="flex-1 rounded-lg bg-red-600 text-white py-2 font-semibold hover:bg-red-700">Marquer absent</button>
                <button onClick={deleteShift} className="rounded-lg border border-black/15 px-3 py-2 hover:bg-black/5">Retirer</button>
              </div>
            </div>
          )}

          {panelShift.status === "ABSENT" && (
            <div className="space-y-3">
              <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">Absent — {panelShift.absence?.reason}</div>
              <div className="text-sm font-semibold">Remplaçants suggérés à contacter</div>
              {suggestions.length === 0 && (
                <button onClick={markAbsent} className="text-sm text-[#7a5640] underline">Proposer des remplaçants</button>
              )}
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2">
                    <div>
                      <div className="font-medium">{s.name} {s.isExtra && <span className="text-[10px] uppercase bg-amber-100 text-amber-700 rounded px-1 ml-1">extra</span>}</div>
                      <div className="text-xs text-black/50">{s.role}{s.phone ? ` · ${s.phone}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {s.phone && <a href={`tel:${s.phone}`} className="rounded-lg border border-black/15 px-2 py-1 text-sm hover:bg-black/5">Appeler</a>}
                      {waLink(s.phone) && <a href={waLink(s.phone)!} target="_blank" rel="noopener" className="rounded-lg bg-emerald-600 text-white px-2 py-1 text-sm hover:bg-emerald-700">WhatsApp</a>}
                      <button onClick={() => chooseReplacement(s.id)} className="rounded-lg bg-[#7a5640] text-white px-2 py-1 text-sm">Choisir</button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={cancelAbsence} className="text-sm text-black/50 underline">Annuler l&apos;absence</button>
            </div>
          )}
        </Overlay>
      )}

      {/* Modal création créneau */}
      {addOpen && data && (
        <AddShiftModal
          dateKey={addOpen.dateKey}
          role={addOpen.role}
          employees={data.employees}
          onClose={() => setAddOpen(null)}
          onSaved={async () => { setAddOpen(null); await load(); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-amber-300 bg-amber-50" : "border-black/10 bg-white"}`}>
      <div className="text-xs text-black/50">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? "text-amber-600" : ""}`}>{value}</div>
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function AddShiftModal({
  dateKey, role, employees, onClose, onSaved,
}: {
  dateKey: string; role: string; employees: Employee[];
  onClose: () => void; onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [r, setR] = useState(role);
  const [start, setStart] = useState("11:00");
  const [end, setEnd] = useState("23:00");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/admin/rh/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, dateKey, role: r, startMin: toMin(start), endMin: toMin(end) }),
    });
    setBusy(false);
    if (res.ok) onSaved();
    else setErr("Vérifiez les champs (horaires, employé).");
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-bold">Ajouter un créneau</div>
        <button onClick={onClose} className="text-black/40 hover:text-black text-xl leading-none">×</button>
      </div>
      <div className="space-y-3 text-sm">
        <div className="text-black/50">{shortDate(dateKey)}</div>
        <label className="block font-medium">Employé</label>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full rounded-lg border border-black/15 px-3 py-2">
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.role}{e.isExtra ? " (extra)" : ""}</option>)}
        </select>
        <label className="block font-medium">Poste</label>
        <input value={r} onChange={(e) => setR(e.target.value)} className="w-full rounded-lg border border-black/15 px-3 py-2" />
        <div className="flex gap-3">
          <div className="flex-1"><label className="block font-medium">Début</label><input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-lg border border-black/15 px-3 py-2" /></div>
          <div className="flex-1"><label className="block font-medium">Fin</label><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-lg border border-black/15 px-3 py-2" /></div>
        </div>
        {err && <div className="text-red-600">{err}</div>}
        <button onClick={save} disabled={busy || !employeeId} className="w-full rounded-lg bg-[#7a5640] text-white py-2 font-semibold disabled:opacity-50">
          {busy ? "Enregistrement…" : "Ajouter au planning"}
        </button>
      </div>
    </Overlay>
  );
}

function TeamList({
  people, roles, isExtra, onChanged,
}: {
  people: Employee[]; roles: string[]; isExtra: boolean; onChanged: () => void;
}) {
  const listId = isExtra ? "rh-roles-extra" : "rh-roles-team";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState(isExtra ? "Polyvalent" : roles[0] ?? "");
  const [busy, setBusy] = useState(false);

  // édition inline
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eRole, setERole] = useState("");

  async function add() {
    if (!name.trim() || !role.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/rh/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, role, isExtra }),
    });
    setBusy(false);
    if (res.ok) { setName(""); setPhone(""); onChanged(); }
  }

  function startEdit(p: Employee) {
    setEditId(p.id); setEName(p.name); setEPhone(p.phone ?? ""); setERole(p.role);
  }

  async function saveEdit(id: string) {
    if (!eName.trim() || !eRole.trim()) return;
    const res = await fetch(`/api/admin/rh/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: eName, phone: ePhone, role: eRole }),
    });
    if (res.ok) { setEditId(null); onChanged(); }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/rh/employees/${id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <datalist id={listId}>
        {roles.map((r) => <option key={r} value={r} />)}
      </datalist>

      <div className="flex flex-wrap gap-2 items-end mb-1">
        <div><label className="block text-xs text-black/50">Nom</label><input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-black/15 px-3 py-2" placeholder="Ex. Karim" /></div>
        <div><label className="block text-xs text-black/50">Téléphone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg border border-black/15 px-3 py-2" placeholder="06…" /></div>
        <div><label className="block text-xs text-black/50">Poste</label>
          <input list={listId} value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-black/15 px-3 py-2" placeholder="Choisir ou créer" />
        </div>
        <button onClick={add} disabled={busy} className="rounded-lg bg-[#7a5640] text-white px-4 py-2 font-semibold disabled:opacity-50">Ajouter</button>
      </div>
      <p className="text-[11px] text-black/40 mb-4">Astuce : tapez un poste qui n&apos;existe pas encore pour le créer.</p>

      <div className="divide-y divide-black/5">
        {people.length === 0 && <div className="text-black/40 text-sm py-4">Personne pour l&apos;instant.</div>}
        {people.map((p) => (
          <div key={p.id} className="py-2.5">
            {editId === p.id ? (
              <div className="flex flex-wrap items-end gap-2">
                <div><label className="block text-xs text-black/50">Nom</label><input value={eName} onChange={(e) => setEName(e.target.value)} className="rounded-lg border border-black/15 px-3 py-1.5" /></div>
                <div><label className="block text-xs text-black/50">Téléphone</label><input value={ePhone} onChange={(e) => setEPhone(e.target.value)} className="rounded-lg border border-black/15 px-3 py-1.5" placeholder="06…" /></div>
                <div><label className="block text-xs text-black/50">Poste</label><input list={listId} value={eRole} onChange={(e) => setERole(e.target.value)} className="rounded-lg border border-black/15 px-3 py-1.5" /></div>
                <button onClick={() => saveEdit(p.id)} className="rounded-lg bg-[#7a5640] text-white px-3 py-1.5 text-sm font-semibold">Enregistrer</button>
                <button onClick={() => setEditId(null)} className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5">Annuler</button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-black/50">{p.role}{p.phone ? ` · ${p.phone}` : ""}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => startEdit(p)} className="rounded-lg border border-black/15 px-2 py-1 text-sm hover:bg-black/5">Éditer</button>
                  {p.phone && <a href={`tel:${p.phone}`} className="rounded-lg border border-black/15 px-2 py-1 text-sm hover:bg-black/5">Appeler</a>}
                  {waLink(p.phone) && <a href={waLink(p.phone)!} target="_blank" rel="noopener" className="rounded-lg bg-emerald-600 text-white px-2 py-1 text-sm hover:bg-emerald-700">WhatsApp</a>}
                  <button onClick={() => remove(p.id)} className="rounded-lg border border-black/15 px-2 py-1 text-sm text-red-600 hover:bg-red-50">Retirer</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
