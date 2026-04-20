import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, Loader2, Plus, Trash2, AlertCircle, AlertTriangle, Binary,
} from "lucide-react";
import {
  apiCodifGrupos,
  apiCodifRespuestas,
  Grupo,
  ReglaInteger,
  ReglaIntegerRango,
  RespuestaUnica,
} from "../../api/client";
import { Alert } from "../../components/Alert";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type Props = { parent: string };

// Compute which response values match a rule. Used to pre-fill grupo.respuestas
// from the rule and show coverage.
function matchRule(regla: ReglaInteger | undefined, respuestas: RespuestaUnica[]): Set<string> {
  const s = new Set<string>();
  if (!regla) return s;
  if (regla.tipo === "range") {
    for (const r of respuestas) {
      const n = Number(r.texto_normalizado);
      if (Number.isNaN(n)) continue;
      if (regla.min != null && n < regla.min) continue;
      if (regla.max != null && n > regla.max) continue;
      s.add(r.texto_normalizado);
    }
  } else if (regla.tipo === "values") {
    for (const v of regla.values) s.add(v.trim());
  }
  return s;
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
        setGrupos(r.grupos ?? []);
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
        // Re-compute respuestas from regla before sending (backend cuenta por respuestas)
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

  // Stats derived
  const stats = useMemo(() => {
    if (!respuestas) return { total: 0, totalCasos: 0, covered: 0, cases: 0, overlaps: 0 };
    const byValue = new Map(respuestas.map((r) => [r.texto_normalizado, r]));
    const total = respuestas.length;
    const totalCasos = respuestas.reduce((s, r) => s + r.frecuencia, 0);
    const count = new Map<string, number>();
    for (const g of grupos) {
      const covered = g.regla ? matchRule(g.regla, respuestas) : new Set(g.respuestas);
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
      const s = g.regla ? matchRule(g.regla, respuestas) : new Set(g.respuestas);
      for (const v of s) assigned.add(v);
    }
    return respuestas.filter((r) => !assigned.has(r.texto_normalizado));
  }, [grupos, respuestas]);

  function nextCodigo(): string {
    const nums = grupos.map((g) => parseInt(g.codigo, 10)).filter((n) => !Number.isNaN(n));
    return String((nums.length === 0 ? 0 : Math.max(...nums)) + 1);
  }

  function addGroup(preset: "range" | "values" = "range") {
    const id = `g_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const regla: ReglaInteger = preset === "range"
      ? { tipo: "range", min: null, max: null }
      : { tipo: "values", values: [] };
    const nuevo: Grupo = { id, codigo: nextCodigo(), etiqueta: "", respuestas: [], regla };
    setGrupos((gs) => [...gs, nuevo]);
  }

  function updateGroup(id: string, patch: Partial<Grupo>) {
    setGrupos((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function deleteGroup(id: string) {
    setGrupos((gs) => gs.filter((g) => g.id !== id));
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
        <button type="button" onClick={() => addGroup("range")} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Rango
        </button>
        <button type="button" onClick={() => addGroup("values")} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Valores sueltos
        </button>
      </div>

      {grupos.length === 0 && (
        <div style={{ padding: 18, border: "2px dashed var(--pulso-border)", borderRadius: 8, textAlign: "center", fontSize: 13, color: "var(--pulso-text-soft)" }}>
          Define reglas para agrupar los valores numéricos.
          <br />
          Ejemplo: un rango <strong>18 – 29</strong> con código <strong>1 "Jóvenes"</strong>, otro rango <strong>30 – 59</strong> con código <strong>2 "Adultos"</strong>.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {grupos.map((g) => (
          <GrupoReglaCard
            key={g.id}
            grupo={g}
            respuestas={respuestas}
            onUpdate={(patch) => updateGroup(g.id, patch)}
            onDelete={() => deleteGroup(g.id)}
          />
        ))}
      </div>

      {uncovered.length > 0 && (
        <section style={{ marginTop: 20, padding: 14, background: "var(--pulso-surface-2)", border: "1px solid var(--pulso-border)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--pulso-text-soft)", marginBottom: 8 }}>
            Valores sin regla ({uncovered.length})
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

function GrupoReglaCard({ grupo, respuestas, onUpdate, onDelete }: {
  grupo: Grupo;
  respuestas: RespuestaUnica[];
  onUpdate: (p: Partial<Grupo>) => void;
  onDelete: () => void;
}) {
  const cobertura = useMemo(() => {
    const covered = grupo.regla ? matchRule(grupo.regla, respuestas) : new Set<string>();
    let casos = 0;
    for (const r of respuestas) if (covered.has(r.texto_normalizado)) casos += r.frecuencia;
    return { n: covered.size, casos };
  }, [grupo.regla, respuestas]);

  const regla = grupo.regla ?? { tipo: "range", min: null, max: null } as ReglaInteger;

  function setRegla(r: ReglaInteger) { onUpdate({ regla: r }); }
  function setTipo(t: "range" | "values") {
    if (t === "range") setRegla({ tipo: "range", min: null, max: null });
    else setRegla({ tipo: "values", values: [] });
  }

  return (
    <article style={{ border: "1px solid var(--pulso-border)", borderRadius: 8, padding: 12, background: "white" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <input
          type="text"
          value={grupo.codigo}
          onChange={(e) => onUpdate({ codigo: e.target.value })}
          placeholder="código"
          style={{ fontFamily: "monospace", fontWeight: 700, width: 56, fontSize: 13, textAlign: "center" }}
          aria-label="Código del grupo"
        />
        <input
          type="text"
          value={grupo.etiqueta}
          onChange={(e) => onUpdate({ etiqueta: e.target.value })}
          placeholder="Etiqueta descriptiva (ej. Jóvenes)"
          style={{ flex: 1, fontSize: 13 }}
          aria-label="Etiqueta del grupo"
        />
        <select
          value={regla.tipo}
          onChange={(e) => setTipo(e.target.value as "range" | "values")}
          style={{ fontSize: 12, padding: "4px 6px" }}
          aria-label="Tipo de regla"
        >
          <option value="range">Rango</option>
          <option value="values">Valores sueltos</option>
        </select>
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

      {regla.tipo === "range" ? (
        <RangeEditor
          regla={regla}
          onChange={setRegla}
        />
      ) : (
        <ValuesEditor
          regla={regla}
          respuestas={respuestas}
          onChange={setRegla}
        />
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: "var(--pulso-text-soft)" }}>
        {cobertura.n > 0 ? (
          <>
            <Check size={11} color="#166534" style={{ verticalAlign: "middle" }} />{" "}
            <strong>{cobertura.n}</strong> valor{cobertura.n === 1 ? "" : "es"} ·{" "}
            <strong>{cobertura.casos}</strong> caso{cobertura.casos === 1 ? "" : "s"} cubierto{cobertura.casos === 1 ? "" : "s"}
          </>
        ) : (
          <>
            <AlertTriangle size={11} color="#8a5000" style={{ verticalAlign: "middle" }} />{" "}
            Sin valores cubiertos. Ajusta la regla.
          </>
        )}
      </div>
    </article>
  );
}

function RangeEditor({ regla, onChange }: { regla: ReglaIntegerRango; onChange: (r: ReglaInteger) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>Desde</label>
      <input
        type="number"
        value={regla.min ?? ""}
        onChange={(e) => onChange({ ...regla, min: e.target.value === "" ? null : Number(e.target.value) })}
        placeholder="—"
        style={{ width: 80, fontSize: 13, fontFamily: "monospace", textAlign: "center" }}
      />
      <label style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>hasta</label>
      <input
        type="number"
        value={regla.max ?? ""}
        onChange={(e) => onChange({ ...regla, max: e.target.value === "" ? null : Number(e.target.value) })}
        placeholder="—"
        style={{ width: 80, fontSize: 13, fontFamily: "monospace", textAlign: "center" }}
      />
      <span style={{ fontSize: 11, color: "var(--pulso-text-soft)" }}>(ambos inclusive · deja vacío para sin límite)</span>
    </div>
  );
}

function ValuesEditor({ regla, respuestas, onChange }: { regla: { tipo: "values"; values: string[] }; respuestas: RespuestaUnica[]; onChange: (r: ReglaInteger) => void }) {
  const [text, setText] = useState<string>(regla.values.join(", "));
  useEffect(() => { setText(regla.values.join(", ")); }, [regla.values]);
  const availableValues = respuestas.map((r) => r.texto_normalizado);

  function commit(v: string) {
    const list = v
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    onChange({ tipo: "values", values: list });
  }

  return (
    <div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text)}
        placeholder="Valores separados por coma, ej. 1, 3, 7, 99"
        style={{ width: "100%", fontSize: 13, fontFamily: "monospace" }}
        list="integer-values"
      />
      <datalist id="integer-values">
        {availableValues.map((v) => <option key={v} value={v} />)}
      </datalist>
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

// unused import guard
export const _k = Binary;
