import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Plus,
  Search,
  Trash2,
  AlertCircle,
  ArrowDownToLine,
  X,
  Wand2,
  Sparkles,
} from "lucide-react";

// Classic Levenshtein edit distance (iterative, O(n*m) space O(n)).
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length, n = b.length;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Similarity 0-1 normalized by the longer string.
function similarity(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0 && lb === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(la, lb);
}
import {
  apiCodifGrupos,
  apiCodifRespuestas,
  Grupo,
  RespuestaUnica,
} from "../../api/client";
import { Alert } from "../../components/Alert";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type Props = {
  parent: string;
};

export function RespuestasCodificador({ parent }: Props) {
  const [respuestas, setRespuestas] = useState<RespuestaUnica[] | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [error, setError] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const skipNextSave = useRef(true);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiCodifRespuestas(parent);
        skipNextSave.current = true;
        setRespuestas(r.respuestas);
        // Merge: siempre mostrar las opciones del choice list (existentes)
        // como grupos. Si ya hay un grupo persistido para ese código con
        // origen="existente", usa ese (mantiene respuestas asignadas). Si
        // no, agregar vacío. Luego agregar los grupos persistidos con
        // origen="nuevo" después.
        const persistidos = r.grupos ?? [];
        const existentes = r.opciones_existentes ?? [];
        const persistByCode = new Map(persistidos.map((g) => [g.codigo, g]));
        const merged: Grupo[] = [];
        // 1. Opciones existentes (preservando respuestas si ya había persistido)
        for (const o of existentes) {
          const prior = persistByCode.get(o.codigo);
          if (prior && prior.origen !== "nuevo") {
            merged.push({ ...prior, origen: "existente", etiqueta: o.etiqueta });
            persistByCode.delete(o.codigo);
          } else {
            merged.push({
              id: `ex_${o.codigo}`,
              codigo: o.codigo,
              etiqueta: o.etiqueta,
              respuestas: prior?.respuestas ?? [],
              origen: "existente",
            });
            if (prior) persistByCode.delete(o.codigo);
          }
        }
        // 2. Grupos nuevos (todo lo que queda en persistidos)
        for (const g of persistByCode.values()) {
          merged.push({ ...g, origen: g.origen ?? "nuevo" });
        }
        setGrupos(merged);
        setSaveStatus("idle");
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [parent]);

  // Autosave 2s after any change
  useEffect(() => {
    if (!respuestas) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setSaveStatus("dirty");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await apiCodifGrupos(parent, grupos);
        setSaveStatus("saved");
      } catch (e) {
        setSaveStatus("error");
        setError((e as Error).message);
      }
    }, 2000);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [grupos, parent, respuestas]);

  // Reverse map: texto_normalizado → grupo (para saber qué respuestas están asignadas)
  const asignacion = useMemo(() => {
    const m = new Map<string, Grupo>();
    for (const g of grupos) for (const t of g.respuestas) m.set(t, g);
    return m;
  }, [grupos]);

  const activeGroup = grupos.find((g) => g.id === activeGroupId) ?? null;

  // Filtered respuestas list
  const visibleRespuestas = useMemo(() => {
    if (!respuestas) return [];
    const q = query.trim().toLowerCase();
    return respuestas.filter((r) => {
      if (!q) return true;
      return r.texto.toLowerCase().includes(q) || r.texto_normalizado.includes(q);
    });
  }, [respuestas, query]);

  const codificadas = useMemo(() => asignacion.size, [asignacion]);
  const pendientes = (respuestas?.length ?? 0) - codificadas;

  function nextCodigo(): string {
    const nums = grupos.map((g) => parseInt(g.codigo, 10)).filter((n) => !Number.isNaN(n));
    return String((nums.length === 0 ? 0 : Math.max(...nums)) + 1);
  }

  function addGroup() {
    const id = `g_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const codigo = nextCodigo();
    const etiqueta = "";
    const nuevo: Grupo = { id, codigo, etiqueta, respuestas: [], origen: "nuevo" };
    setGrupos((gs) => [...gs, nuevo]);
    setActiveGroupId(id);
  }

  function updateGroup(id: string, patch: Partial<Grupo>) {
    setGrupos((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function deleteGroup(id: string) {
    setGrupos((gs) => gs.filter((g) => g.id !== id));
    if (activeGroupId === id) setActiveGroupId(null);
  }

  function toggleRespuesta(texto_normalizado: string) {
    const current = asignacion.get(texto_normalizado);
    if (current) {
      // Quitar de su grupo actual
      updateGroup(current.id, {
        respuestas: current.respuestas.filter((r) => r !== texto_normalizado),
      });
      return;
    }
    // Agregar al grupo activo (o crear uno)
    if (!activeGroupId || !activeGroup) {
      addGroup();
      // Wait for re-render; add on next tick
      setTimeout(() => {
        setGrupos((gs) => {
          if (gs.length === 0) return gs;
          const last = gs[gs.length - 1];
          return gs.map((g) => g.id === last.id ? { ...g, respuestas: [...g.respuestas, texto_normalizado] } : g);
        });
      }, 0);
      return;
    }
    updateGroup(activeGroup.id, {
      respuestas: [...activeGroup.respuestas, texto_normalizado],
    });
  }

  function moveToGroup(texto_normalizado: string, targetGroupId: string) {
    // Quitar de donde esté y agregar al target
    setGrupos((gs) => {
      const cleaned = gs.map((g) => ({ ...g, respuestas: g.respuestas.filter((r) => r !== texto_normalizado) }));
      return cleaned.map((g) => g.id === targetGroupId ? { ...g, respuestas: [...g.respuestas, texto_normalizado] } : g);
    });
  }

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!respuestas) return <Alert kind="info">Cargando respuestas…</Alert>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <SaveBadge status={saveStatus} />
        <span style={{ fontSize: 13, color: "var(--pulso-text-soft)" }}>
          <strong style={{ color: "var(--pulso-text)" }}>{codificadas}</strong> de <strong>{respuestas.length}</strong> respuestas codificadas
          {pendientes > 0 && <> · <strong style={{ color: "#8a5000" }}>{pendientes} pendientes</strong></>}
          {grupos.length > 0 && <> · <strong>{grupos.length}</strong> {grupos.length === 1 ? "grupo" : "grupos"}</>}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="pulso-primary"
          onClick={addGroup}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={14} /> Nuevo grupo
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(340px, 1fr)", gap: 16, alignItems: "flex-start" }}>
        {/* LEFT — respuestas */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Search size={14} color="var(--pulso-text-soft)" />
            <input
              placeholder="Buscar respuestas"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, fontSize: 13 }}
            />
          </div>
          <div style={{ border: "1px solid var(--pulso-border)", borderRadius: 6, maxHeight: 540, overflowY: "auto" }}>
            {visibleRespuestas.length === 0 && (
              <div style={{ padding: 14, fontSize: 13, color: "var(--pulso-text-soft)", textAlign: "center" }}>
                No hay respuestas que coincidan.
              </div>
            )}
            {visibleRespuestas.map((r) => {
              const grupo = asignacion.get(r.texto_normalizado);
              const assigned = !!grupo;
              return (
                <div
                  key={r.texto_normalizado}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 1fr auto",
                    gap: 8, alignItems: "center",
                    padding: "8px 10px",
                    borderBottom: "1px solid #f2f2f2",
                    background: assigned ? "var(--pulso-surface-2)" : "white",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={assigned}
                    onChange={() => toggleRespuesta(r.texto_normalizado)}
                    aria-label={`${assigned ? "Quitar" : "Agregar"} "${r.texto}" ${assigned ? `del grupo ${grupo!.etiqueta || grupo!.codigo}` : "al grupo activo"}`}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pulso-text)" }}>
                      {r.label ? (
                        <>
                          <code style={{ fontFamily: "monospace", color: "var(--pulso-primary)", marginRight: 6 }}>{r.texto}</code>
                          {r.label}
                        </>
                      ) : r.texto}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--pulso-text-soft)", display: "flex", gap: 8 }}>
                      <span><strong>{r.frecuencia}</strong> {r.frecuencia === 1 ? "vez" : "veces"}</span>
                      {r.variantes > 1 && <span>{r.variantes} variantes</span>}
                      {assigned && (
                        <span style={{ color: "#166534", fontWeight: 600 }}>
                          → {grupo!.codigo}{grupo!.etiqueta ? ` · ${grupo!.etiqueta}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {!assigned && grupos.length > 1 && (
                    <QuickAssignDropdown grupos={grupos} onPick={(gid) => moveToGroup(r.texto_normalizado, gid)} />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT — grupos */}
        <section>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-text-soft)", marginBottom: 10 }}>
            Grupos de codificación
          </div>
          {grupos.length === 0 && (
            <div style={{ padding: 18, border: "2px dashed var(--pulso-border)", borderRadius: 8, textAlign: "center", fontSize: 13, color: "var(--pulso-text-soft)" }}>
              Crea tu primer grupo con <strong>+ Nuevo grupo</strong> o marca una respuesta para crearlo automáticamente.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {grupos.map((g) => (
              <GrupoCard
                key={g.id}
                grupo={g}
                respuestas={respuestas}
                asignacion={asignacion}
                active={g.id === activeGroupId}
                onActivate={() => setActiveGroupId(g.id)}
                onUpdate={(patch) => updateGroup(g.id, patch)}
                onDelete={() => deleteGroup(g.id)}
                onRemoveRespuesta={(t) => updateGroup(g.id, { respuestas: g.respuestas.filter((r) => r !== t) })}
                onAddRespuesta={(t) => updateGroup(g.id, { respuestas: [...g.respuestas, t] })}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function QuickAssignDropdown({ grupos, onPick }: { grupos: Grupo[]; onPick: (gid: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{ fontSize: 10, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}
        title="Asignar a grupo existente"
      >
        <ArrowDownToLine size={10} /> asignar
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          style={{
            position: "absolute", right: 0, top: "100%", marginTop: 2, zIndex: 10,
            background: "white", border: "1px solid var(--pulso-border)",
            borderRadius: 6, boxShadow: "var(--pulso-shadow-med)",
            minWidth: 180, padding: 4,
          }}
        >
          {grupos.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => { onPick(g.id); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                fontSize: 11, padding: "4px 8px", border: "none", background: "transparent",
                cursor: "pointer", borderRadius: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--pulso-surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <strong>{g.codigo}</strong> {g.etiqueta || <em style={{ color: "var(--pulso-text-soft)" }}>sin nombre</em>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GrupoCard({ grupo, respuestas, asignacion, active, onActivate, onUpdate, onDelete, onRemoveRespuesta, onAddRespuesta }: {
  grupo: Grupo;
  respuestas: RespuestaUnica[];
  asignacion: Map<string, Grupo>;
  active: boolean;
  onActivate: () => void;
  onUpdate: (p: Partial<Grupo>) => void;
  onDelete: () => void;
  onRemoveRespuesta: (texto_normalizado: string) => void;
  onAddRespuesta: (texto_normalizado: string) => void;
}) {
  const respByNorm = useMemo(() => new Map(respuestas.map((r) => [r.texto_normalizado, r])), [respuestas]);
  const total = grupo.respuestas.reduce((sum, t) => sum + (respByNorm.get(t)?.frecuencia ?? 0), 0);

  // Similitud: para cada respuesta SIN asignar, computar max similitud a las
  // respuestas asignadas al grupo. Top 6 con similarity >= 0.5. Solo cuando
  // el grupo está activo y tiene al menos una respuesta.
  const sugerencias = useMemo(() => {
    if (!active || grupo.respuestas.length === 0) return [];
    const seeds = grupo.respuestas;
    const hits: Array<{ t: RespuestaUnica; sim: number }> = [];
    for (const r of respuestas) {
      if (asignacion.has(r.texto_normalizado)) continue;
      let maxSim = 0;
      for (const s of seeds) {
        const sim = similarity(r.texto_normalizado, s);
        if (sim > maxSim) maxSim = sim;
        if (maxSim >= 0.99) break;
      }
      if (maxSim >= 0.35) hits.push({ t: r, sim: maxSim });
    }
    hits.sort((a, b) => b.sim - a.sim);
    return hits.slice(0, 6);
  }, [active, grupo.respuestas, respuestas, asignacion]);
  const esExistente = grupo.origen === "existente";
  return (
    <article
      onClick={active ? undefined : onActivate}
      style={{
        border: active ? "2px solid var(--pulso-primary)" : "1px solid var(--pulso-border)",
        borderRadius: 8,
        padding: 12,
        background: active ? "var(--pulso-primary-soft)" : esExistente ? "var(--pulso-surface-2)" : "white",
        cursor: active ? "default" : "pointer",
        transition: "background 150ms, border-color 150ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {esExistente ? (
          <>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "var(--pulso-primary)", minWidth: 32, textAlign: "center" }}>
              {grupo.codigo}
            </span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{grupo.etiqueta}</span>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-text-soft)", background: "#eef3ff", padding: "2px 6px", borderRadius: 3 }}>
              Opción existente
            </span>
          </>
        ) : (
          <>
            <input
              type="text"
              value={grupo.codigo}
              onChange={(e) => onUpdate({ codigo: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="código"
              style={{ fontFamily: "monospace", fontWeight: 700, width: 56, fontSize: 13, textAlign: "center" }}
              aria-label="Código numérico del grupo"
            />
            <input
              type="text"
              value={grupo.etiqueta}
              onChange={(e) => onUpdate({ etiqueta: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Etiqueta descriptiva del grupo"
              style={{ flex: 1, fontSize: 13 }}
              aria-label="Etiqueta del grupo"
            />
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#166534", background: "#dcfce7", padding: "2px 6px", borderRadius: 3 }}>
              Nuevo
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="pulso-icon pulso-icon-danger"
              title="Eliminar grupo"
              aria-label="Eliminar grupo"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginBottom: 6 }}>
        {grupo.respuestas.length} {grupo.respuestas.length === 1 ? "respuesta" : "respuestas"} · <strong>{total}</strong> casos totales
        {active && <span style={{ color: "var(--pulso-primary)", marginLeft: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, fontSize: 9 }}>← activo</span>}
      </div>
      {grupo.respuestas.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic", padding: "6px 0" }}>
          Aún sin respuestas. Marca respuestas a la izquierda para agregarlas.
        </div>
      )}
      {grupo.respuestas.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {grupo.respuestas.map((t) => {
            const r = respByNorm.get(t);
            const display = r?.texto ?? t;
            const freq = r?.frecuencia ?? 0;
            return (
              <span
                key={t}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  background: "white", border: "1px solid var(--pulso-border)",
                  borderRadius: 12, padding: "1px 4px 1px 8px", fontSize: 11,
                  color: "var(--pulso-text)",
                }}
              >
                {display}
                {freq > 0 && <span style={{ color: "var(--pulso-text-soft)", fontSize: 9 }}>×{freq}</span>}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveRespuesta(t); }}
                  className="pulso-icon"
                  style={{ minWidth: 16, minHeight: 16, padding: 1 }}
                  aria-label={`Quitar "${display}" del grupo`}
                  title="Quitar del grupo"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {active && sugerencias.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 10, padding: 8, borderTop: "1px dashed var(--pulso-border)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-text-soft)", marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Sparkles size={11} /> Sugerencias similares
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {sugerencias.map(({ t, sim }) => {
              const pct = Math.round(sim * 100);
              const simColor = sim >= 0.85 ? "#166534" : sim >= 0.7 ? "#8a5000" : "#6b7280";
              return (
                <button
                  key={t.texto_normalizado}
                  type="button"
                  onClick={() => onAddRespuesta(t.texto_normalizado)}
                  title={`${pct}% similar — click para agregar al grupo`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "#fff7e8", border: "1px dashed #f0d799",
                    borderRadius: 12, padding: "2px 8px", fontSize: 11,
                    color: "var(--pulso-text)", cursor: "pointer",
                  }}
                >
                  <Plus size={10} />
                  <span>{truncateText(t.texto, 22)}</span>
                  {t.frecuencia > 0 && <span style={{ color: "var(--pulso-text-soft)", fontSize: 9 }}>×{t.frecuencia}</span>}
                  <span style={{ color: simColor, fontSize: 9, fontWeight: 700 }}>{pct}%</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

function truncateText(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === "saving")
    return <Badge bg="#eef3ff" fg="#2446a3"><Loader2 size={12} className="pulso-spin" /> Guardando…</Badge>;
  if (status === "saved")
    return <Badge bg="#e8f5ea" fg="#1b6b2f"><Check size={12} /> Guardado</Badge>;
  if (status === "dirty")
    return <Badge bg="#fff7e0" fg="#8a6100">Cambios sin guardar</Badge>;
  if (status === "error")
    return <Badge bg="#fde7e7" fg="#a51f1f"><AlertCircle size={12} /> Error</Badge>;
  return <Badge bg="#f0f2f7" fg="#555">Sin cambios</Badge>;
}
function Badge({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: fg, background: bg }}>{children}</span>;
}

// unused imports guard
export const _k = Wand2;
