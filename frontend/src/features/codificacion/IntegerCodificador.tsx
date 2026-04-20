import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, ChevronDown, ChevronUp, Loader2, Plus, Trash2, AlertCircle, AlertTriangle,
} from "lucide-react";
import {
  apiCodifGrupos,
  apiCodifRespuestas,
  Grupo,
  ReglaInteger,
  RespuestaUnica,
} from "../../api/client";
import { Alert } from "../../components/Alert";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type Props = { parent: string };

// Evalúa una regla contra los valores únicos. Devuelve el set de
// texto_normalizado que la regla cubre. Una regla incompleta (falta un
// valor obligatorio) devuelve set vacío — no hay "sin límite implícito".
function matchRule(regla: ReglaInteger | undefined, respuestas: RespuestaUnica[]): Set<string> {
  const s = new Set<string>();
  if (!regla) return s;
  if (regla.tipo === "between") {
    if (regla.min == null || regla.max == null) return s;
    for (const r of respuestas) {
      const n = Number(r.texto_normalizado);
      if (Number.isNaN(n)) continue;
      if (n >= regla.min && n <= regla.max) s.add(r.texto_normalizado);
    }
  } else if (regla.tipo === "gte") {
    if (regla.value == null) return s;
    for (const r of respuestas) {
      const n = Number(r.texto_normalizado);
      if (Number.isNaN(n)) continue;
      if (n >= regla.value) s.add(r.texto_normalizado);
    }
  } else if (regla.tipo === "lte") {
    if (regla.value == null) return s;
    for (const r of respuestas) {
      const n = Number(r.texto_normalizado);
      if (Number.isNaN(n)) continue;
      if (n <= regla.value) s.add(r.texto_normalizado);
    }
  }
  return s;
}

// Migra grupos legacy cuyo regla tenía tipo "range" o "values" a las
// nuevas formas.
function migrateRegla(g: Grupo): Grupo {
  const r: unknown = g.regla;
  if (!r || typeof r !== "object") return g;
  const obj = r as { tipo?: string; min?: number | null; max?: number | null };
  if (obj.tipo === "range") {
    const min = obj.min ?? null;
    const max = obj.max ?? null;
    let regla: ReglaInteger;
    if (min != null && max != null) regla = { tipo: "between", min, max };
    else if (min != null) regla = { tipo: "gte", value: min };
    else if (max != null) regla = { tipo: "lte", value: max };
    else regla = { tipo: "between", min: null, max: null };
    return { ...g, regla };
  }
  // "values" ya no se soporta → convertir a regla between vacía
  if (obj.tipo === "values") {
    return { ...g, regla: { tipo: "between", min: null, max: null } };
  }
  return g;
}

export function IntegerCodificador({ parent }: Props) {
  const [respuestas, setRespuestas] = useState<RespuestaUnica[] | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");

  const skipNext = useRef(true);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiCodifRespuestas(parent);
        skipNext.current = true;
        setRespuestas(r.respuestas);
        setGrupos((r.grupos ?? []).map(migrateRegla));
        setSaveStatus("idle");
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [parent]);

  useEffect(() => {
    if (!respuestas) return;
    if (skipNext.current) { skipNext.current = false; return; }
    setSaveStatus("dirty");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaveStatus("saving");
      try {
        // Pre-computar respuestas desde reglas para que el backend cuente bien
        const gruposToSave: Grupo[] = grupos.map((g) => {
          if (!g.regla) return g;
          const covered = Array.from(matchRule(g.regla, respuestas));
          return { ...g, respuestas: covered };
        });
        await apiCodifGrupos(parent, gruposToSave);
        setSaveStatus("saved");
      } catch (e) {
        setSaveStatus("error");
        setError((e as Error).message);
      }
    }, 2000);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [grupos, parent, respuestas]);

  const stats = useMemo(() => {
    if (!respuestas) return { total: 0, totalCasos: 0, covered: 0, cases: 0, overlaps: 0 };
    const byValue = new Map(respuestas.map((r) => [r.texto_normalizado, r]));
    const total = respuestas.length;
    const totalCasos = respuestas.reduce((s, r) => s + r.frecuencia, 0);
    const count = new Map<string, number>();
    for (const g of grupos) {
      const covered = g.regla ? matchRule(g.regla, respuestas) : new Set<string>();
      for (const v of covered) count.set(v, (count.get(v) ?? 0) + 1);
    }
    let coveredValues = 0, coveredCases = 0, overlaps = 0;
    for (const [v, c] of count) {
      if (c >= 1) {
        coveredValues++;
        coveredCases += byValue.get(v)?.frecuencia ?? 0;
      }
      if (c > 1) overlaps++;
    }
    return { total, totalCasos, covered: coveredValues, cases: coveredCases, overlaps };
  }, [grupos, respuestas]);

  const uncovered = useMemo(() => {
    if (!respuestas) return [];
    const assigned = new Set<string>();
    for (const g of grupos) {
      const s = g.regla ? matchRule(g.regla, respuestas) : new Set<string>();
      for (const v of s) assigned.add(v);
    }
    return respuestas.filter((r) => !assigned.has(r.texto_normalizado));
  }, [grupos, respuestas]);

  function nextCodigo(): string {
    const nums = grupos.map((g) => parseInt(g.codigo, 10)).filter((n) => !Number.isNaN(n));
    return String((nums.length === 0 ? 0 : Math.max(...nums)) + 1);
  }

  function addGroup() {
    const id = `g_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const regla: ReglaInteger = { tipo: "between", min: null, max: null };
    // Integer siempre produce códigos nuevos (no hay choice list a reutilizar).
    // Marcamos origen:"nuevo" para que el backend declare el código en el
    // bloque auxiliar del xlsx plantilla y ppra_adaptar_data lo acepte.
    const nuevo: Grupo = { id, codigo: nextCodigo(), etiqueta: "", respuestas: [], regla, origen: "nuevo" };
    setGrupos((gs) => [...gs, nuevo]);
  }

  function updateGroup(id: string, patch: Partial<Grupo>) {
    setGrupos((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function deleteGroup(id: string) {
    setGrupos((gs) => gs.filter((g) => g.id !== id));
  }

  // Reordena reglas ↑/↓. Importante en integer: el orden define la
  // precedencia first-match-wins al aplicar el bridge.
  function moveGroup(id: string, direction: "up" | "down") {
    setGrupos((gs) => {
      const i = gs.findIndex((g) => g.id === id);
      if (i < 0) return gs;
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= gs.length) return gs;
      const next = [...gs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!respuestas) return <Alert kind="info">Cargando valores…</Alert>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <SaveBadge status={saveStatus} />
        <span style={{ fontSize: 13, color: "var(--pulso-text-soft)" }}>
          <strong style={{ color: "var(--pulso-text)" }}>{stats.covered}</strong> de <strong>{stats.total}</strong> valores únicos cubiertos
          {stats.cases > 0 && <> · <strong>{stats.cases}</strong> de {stats.totalCasos} casos</>}
          {grupos.length > 0 && <> · <strong>{grupos.length}</strong> {grupos.length === 1 ? "grupo" : "grupos"}</>}
          {stats.overlaps > 0 && <> · <span style={{ color: "#a51f1f", fontWeight: 700 }}>{stats.overlaps} valor(es) en más de un grupo</span></>}
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" className="pulso-primary" onClick={addGroup} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Nuevo rango
        </button>
      </div>

      {grupos.length === 0 && (
        <div style={{ padding: 18, border: "2px dashed var(--pulso-border)", borderRadius: 8, textAlign: "center", fontSize: 13, color: "var(--pulso-text-soft)" }}>
          Define rangos para agrupar los valores numéricos.
          <br />
          Ejemplo: <strong>de 18 a 29</strong> con código <strong>1 "Jóvenes"</strong>; <strong>de 30 a 59</strong> con código <strong>2 "Adultos"</strong>; <strong>60 o más</strong> con código <strong>3 "Mayores"</strong>.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {grupos.map((g, idx) => (
          <GrupoReglaCard
            key={g.id}
            grupo={g}
            respuestas={respuestas}
            onUpdate={(patch) => updateGroup(g.id, patch)}
            onDelete={() => deleteGroup(g.id)}
            onMoveUp={() => moveGroup(g.id, "up")}
            onMoveDown={() => moveGroup(g.id, "down")}
            isFirst={idx === 0}
            isLast={idx === grupos.length - 1}
          />
        ))}
      </div>

      {uncovered.length > 0 && (
        <section style={{ marginTop: 20, padding: 14, background: "var(--pulso-surface-2)", border: "1px solid var(--pulso-border)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-text-soft)", marginBottom: 8 }}>
            Valores sin rango ({uncovered.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {uncovered.slice(0, 40).map((r) => (
              <span
                key={r.texto_normalizado}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  background: "white", border: "1px solid var(--pulso-border)",
                  borderRadius: 10, padding: "1px 8px", fontSize: 11,
                }}
              >
                <span style={{ fontFamily: "monospace" }}>{r.texto}</span>
                <span style={{ color: "var(--pulso-text-soft)", fontSize: 9 }}>×{r.frecuencia}</span>
              </span>
            ))}
            {uncovered.length > 40 && <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", alignSelf: "center" }}>+ {uncovered.length - 40} más</span>}
          </div>
        </section>
      )}
    </div>
  );
}

function GrupoReglaCard({ grupo, respuestas, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: {
  grupo: Grupo;
  respuestas: RespuestaUnica[];
  onUpdate: (p: Partial<Grupo>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const regla = (grupo.regla ?? { tipo: "between", min: null, max: null }) as ReglaInteger;
  const cobertura = useMemo(() => {
    const covered = matchRule(regla, respuestas);
    let casos = 0;
    for (const r of respuestas) if (covered.has(r.texto_normalizado)) casos += r.frecuencia;
    return { n: covered.size, casos };
  }, [regla, respuestas]);

  function setRegla(r: ReglaInteger) { onUpdate({ regla: r }); }
  function setTipo(tipo: "between" | "gte" | "lte") {
    if (tipo === "between") setRegla({ tipo: "between", min: null, max: null });
    else if (tipo === "gte") setRegla({ tipo: "gte", value: null });
    else setRegla({ tipo: "lte", value: null });
  }

  const incompleta =
    (regla.tipo === "between" && (regla.min == null || regla.max == null)) ||
    (regla.tipo === "gte" && regla.value == null) ||
    (regla.tipo === "lte" && regla.value == null);

  return (
    <article style={{
      border: `1px solid ${incompleta ? "#f0d799" : "var(--pulso-border)"}`,
      background: incompleta ? "#fffcf3" : "white",
      borderRadius: 8, padding: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "nowrap" }}>
        <input
          type="text"
          value={grupo.codigo}
          onChange={(e) => onUpdate({ codigo: e.target.value })}
          placeholder="código"
          style={{ fontFamily: "monospace", fontWeight: 700, width: 56, fontSize: 13, textAlign: "center", flexShrink: 0 }}
          aria-label="Código del grupo"
        />
        <input
          type="text"
          value={grupo.etiqueta}
          onChange={(e) => onUpdate({ etiqueta: e.target.value })}
          placeholder="Etiqueta (ej. Jóvenes)"
          style={{ flex: 1, fontSize: 13, minWidth: 0 }}
          aria-label="Etiqueta del grupo"
        />
        <select
          value={regla.tipo}
          onChange={(e) => setTipo(e.target.value as "between" | "gte" | "lte")}
          style={{ fontSize: 12, padding: "4px 6px", flexShrink: 0 }}
          aria-label="Tipo de rango"
        >
          <option value="between">De X a Y</option>
          <option value="gte">X o más</option>
          <option value="lte">X o menos</option>
        </select>
        <span style={{ display: "inline-flex", gap: 2, flexShrink: 0 }}>
          <button
            type="button"
            className="pulso-icon"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Mover arriba · el orden define precedencia en integer"
            aria-label="Mover arriba"
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            className="pulso-icon"
            onClick={onMoveDown}
            disabled={isLast}
            title="Mover abajo · el orden define precedencia en integer"
            aria-label="Mover abajo"
          >
            <ChevronDown size={12} />
          </button>
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="pulso-icon pulso-icon-danger"
          title="Eliminar grupo"
          aria-label="Eliminar grupo"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {regla.tipo === "between" ? (
        <BetweenEditor regla={regla} onChange={setRegla} />
      ) : regla.tipo === "gte" ? (
        <SingleBoundEditor label="Desde" regla={regla} onChange={setRegla} />
      ) : (
        <SingleBoundEditor label="Hasta" regla={regla} onChange={setRegla} />
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: "var(--pulso-text-soft)" }}>
        {incompleta ? (
          <>
            <AlertTriangle size={11} color="#8a5000" style={{ verticalAlign: "middle" }} />{" "}
            <span style={{ color: "#8a5000" }}>Rango incompleto — completa los valores para que cubra respuestas.</span>
          </>
        ) : cobertura.n > 0 ? (
          <>
            <Check size={11} color="#166534" style={{ verticalAlign: "middle" }} />{" "}
            <strong>{cobertura.n}</strong> valor{cobertura.n === 1 ? "" : "es"} ·{" "}
            <strong>{cobertura.casos}</strong> caso{cobertura.casos === 1 ? "" : "s"} cubierto{cobertura.casos === 1 ? "" : "s"}
          </>
        ) : (
          <>
            <AlertTriangle size={11} color="#8a5000" style={{ verticalAlign: "middle" }} />{" "}
            Ningún valor en el dataset cae en este rango.
          </>
        )}
      </div>
    </article>
  );
}

function BetweenEditor({ regla, onChange }: { regla: { tipo: "between"; min: number | null; max: number | null }; onChange: (r: ReglaInteger) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>De</label>
      <input
        type="number"
        value={regla.min ?? ""}
        onChange={(e) => onChange({ ...regla, min: e.target.value === "" ? null : Number(e.target.value) })}
        placeholder="—"
        style={{ width: 80, fontSize: 13, fontFamily: "monospace", textAlign: "center" }}
        aria-label="Valor mínimo del rango"
      />
      <label style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>a</label>
      <input
        type="number"
        value={regla.max ?? ""}
        onChange={(e) => onChange({ ...regla, max: e.target.value === "" ? null : Number(e.target.value) })}
        placeholder="—"
        style={{ width: 80, fontSize: 13, fontFamily: "monospace", textAlign: "center" }}
        aria-label="Valor máximo del rango"
      />
    </div>
  );
}

function SingleBoundEditor({ label, regla, onChange }: {
  label: string;
  regla: { tipo: "gte"; value: number | null } | { tipo: "lte"; value: number | null };
  onChange: (r: ReglaInteger) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>{label}</label>
      <input
        type="number"
        value={regla.value ?? ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : Number(e.target.value);
          onChange({ ...regla, value: v });
        }}
        placeholder="—"
        style={{ width: 80, fontSize: 13, fontFamily: "monospace", textAlign: "center" }}
        aria-label={`Valor ${label.toLowerCase()}`}
      />
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === "saving") return <Badge bg="#eef3ff" fg="#2446a3"><Loader2 size={12} className="pulso-spin" /> Guardando…</Badge>;
  if (status === "saved") return <Badge bg="#e8f5ea" fg="#1b6b2f"><Check size={12} /> Guardado</Badge>;
  if (status === "dirty") return <Badge bg="#fff7e0" fg="#8a6100">Cambios sin guardar</Badge>;
  if (status === "error") return <Badge bg="#fde7e7" fg="#a51f1f"><AlertCircle size={12} /> Error</Badge>;
  return <Badge bg="#f0f2f7" fg="#555">Sin cambios</Badge>;
}
function Badge({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: fg, background: bg }}>{children}</span>;
}
