import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Filter, Grid3x3, Plus, X } from "lucide-react";
import {
  apiAnaliticaColumnValues,
  apiAnaliticaCruces,
  apiAnaliticaVariables,
  ValorColumna,
  VariableInstrumento,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { CruceVarConfig, useAnaliticaStore } from "../store";
import { VariableSelect } from "../VariableSelect";
import { Section, GenerateFooter } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";

// CrucesPane — rediseño final.
// 1. Variables a cruzar con posibilidad de excluir categorías específicas
//    cuando la variable es cruce (columna). La exclusión filtra filas
//    globalmente del data antes de generar — lo comunicamos en la UI.
// 2. Presentación (solo incluir_total).
// 3. Generar.
//
// Semáforo y brechas se removieron del UI: su uso natural es en el
// módulo de dimensiones, aún no integrado. La config persiste en el
// store y los endpoints siguen aceptándola, para reusarla ahí.

export function CrucesPane() {
  const cruces = useAnaliticaStore((s) => s.config.cruces);
  const setCruces = useAnaliticaStore((s) => s.setCruces);
  const addCruceVar = useAnaliticaStore((s) => s.addCruceVar);
  const removeCruceVar = useAnaliticaStore((s) => s.removeCruceVar);
  const setCruceVarExcluidas = useAnaliticaStore((s) => s.setCruceVarExcluidas);
  const run = useReporteRun();

  const [variables, setVariables] = useState<VariableInstrumento[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await apiAnaliticaVariables();
        setVariables(r.variables);
      } catch {/* no-op */}
    })();
  }, []);

  async function onGenerate() {
    // Forzar modo estándar + sig default antes de lanzar.
    if (cruces.modo !== "estandar" || !cruces.show_sig || cruces.alpha !== 0.05) {
      setCruces({ modo: "estandar", show_sig: true, alpha: 0.05 });
    }
    await run.runAsync(() => apiAnaliticaCruces());
  }

  const nVars = cruces.cruces_vars.length;
  const nResto = Math.max(0, variables.length - nVars);

  // Sugerencias: select_one no seleccionadas.
  const sugeridas = useMemo(() => {
    const picked = new Set(cruces.cruces_vars.map((cv) => cv.name));
    return variables
      .filter((v) => v.tipo === "select_one")
      .filter((v) => !picked.has(v.name))
      .slice(0, 4);
  }, [variables, cruces.cruces_vars]);

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Grid3x3 size={16} /> Cruces</span>}
      hint={<>Tablas cruzadas 2D. Cada variable elegida se cruza contra el resto del instrumento, con chi² al <strong>5%</strong> para marcar diferencias significativas.</>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* 1. Variables a cruzar */}
        <Section
          title="1. Variables a cruzar"
          subtitle={<>
            Cada variable que elijas <strong>define las columnas</strong> de un bloque de tablas y se cruza contra todas las demás del instrumento. Típicamente: sexo, distrito, servicio, grupo etario. Puedes excluir categorías específicas de cada variable cuando tengan casi ninguna respuesta.
          </>}
        >
          <VariableChips
            selected={cruces.cruces_vars}
            variables={variables}
            sugeridas={sugeridas}
            onAdd={addCruceVar}
            onRemove={removeCruceVar}
            onSetExcluidas={setCruceVarExcluidas}
          />
          {nVars > 0 && (
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 8 }}>
              El reporte generará <strong>{nVars}</strong> {nVars === 1 ? "bloque de tablas" : "bloques de tablas"} cruzando cada variable seleccionada contra las otras <strong>{nResto}</strong> variables del instrumento.
            </div>
          )}
        </Section>

        {/* 2. Presentación */}
        <Section
          title="2. Presentación"
          subtitle="Cómo se compone cada tabla cruzada."
        >
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={cruces.incluir_total}
              onChange={(e) => setCruces({ incluir_total: e.target.checked })}
              style={{ marginTop: 3 }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>Incluir columna y fila de total</div>
              <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
                Agrega la fila "Total" al final de cada tabla con la suma de las categorías. Útil para comparar cada grupo contra la muestra completa.
              </div>
            </div>
          </label>
        </Section>

        {/* 3. Generar */}
        <GenerateFooter
          label="Generar cruces"
          busy={run.busy}
          jobId={run.jobId}
          fileId={run.fileId}
          downloadName="cruces.xlsx"
          error={run.error}
          onGenerate={onGenerate}
          disabled={nVars === 0}
          disabledHint={nVars === 0 ? "Agrega al menos una variable a cruzar arriba." : undefined}
          onJobDone={run.onJobDone}
          onJobError={run.onJobError}
          onJobCancelled={run.onJobCancelled}
        />
      </div>
    </Panel>
  );
}

// -- Variable chips + picker (schema v2 con exclusiones) ---------------------

function VariableChips({
  selected, variables, sugeridas, onAdd, onRemove, onSetExcluidas,
}: {
  selected: CruceVarConfig[];
  variables: VariableInstrumento[];
  sugeridas: VariableInstrumento[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onSetExcluidas: (name: string, excluidas: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [pendingVar, setPendingVar] = useState("");
  const [editingExclusion, setEditingExclusion] = useState<string | null>(null);

  function commit() {
    if (pendingVar) onAdd(pendingVar);
    setPendingVar("");
    setAdding(false);
  }

  const editingCr = selected.find((cv) => cv.name === editingExclusion) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {selected.length === 0 && !adding && (
        <div style={{ padding: 14, border: "1px dashed var(--pulso-border)", borderRadius: 6, textAlign: "center", fontSize: 12, color: "var(--pulso-text-soft)" }}>
          Aún no elegiste variables. Haz click en <strong>+ Añadir variable</strong> o usa una sugerencia.
        </div>
      )}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {selected.map((cv) => {
            const meta = variables.find((x) => x.name === cv.name);
            const nExcl = cv.excluidas?.length ?? 0;
            return (
              <div
                key={cv.name}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px",
                  background: "var(--pulso-primary-soft)",
                  border: "1px solid var(--pulso-primary)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                <code style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--pulso-primary)" }}>{cv.name}</code>
                {meta?.label && (
                  <span style={{ color: "var(--pulso-text-soft)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    · {meta.label}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditingExclusion(editingExclusion === cv.name ? null : cv.name)}
                  title="Excluir categorías cuando esta variable sea cruce"
                  style={{
                    fontSize: 11, padding: "3px 8px",
                    display: "inline-flex", alignItems: "center", gap: 4,
                    borderRadius: 4,
                    border: `1px solid ${nExcl > 0 ? "#b45309" : "var(--pulso-border)"}`,
                    background: nExcl > 0 ? "#fff7e8" : "white",
                    color: nExcl > 0 ? "#8a5000" : "var(--pulso-text)",
                    cursor: "pointer",
                  }}
                >
                  <Filter size={11} />
                  {nExcl === 0 ? "Excluir…" : `${nExcl} excluida${nExcl === 1 ? "" : "s"}`}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(cv.name)}
                  className="pulso-icon"
                  aria-label={`Quitar ${cv.name}`}
                  style={{ minWidth: 20, minHeight: 20 }}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editingCr && (
        <ExclusionEditor
          cruceVar={editingCr}
          onChange={(excl) => onSetExcluidas(editingCr.name, excl)}
          onClose={() => setEditingExclusion(null)}
        />
      )}

      {adding ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <VariableSelect
              variables={variables.filter((v) => !selected.some((cv) => cv.name === v.name))}
              value={pendingVar}
              onChange={setPendingVar}
              placeholder="Seleccionar variable a cruzar…"
            />
          </div>
          <button type="button" className="pulso-primary" onClick={commit} disabled={!pendingVar} style={{ fontSize: 12, padding: "6px 14px" }}>Añadir</button>
          <button type="button" onClick={() => { setAdding(false); setPendingVar(""); }} style={{ fontSize: 12, padding: "6px 10px" }}>Cancelar</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Plus size={12} /> Añadir variable
          </button>
          {sugeridas.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginLeft: 4 }}>sugerencias:</span>
              {sugeridas.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => onAdd(v.name)}
                  title={v.label}
                  style={{
                    fontSize: 10, padding: "3px 8px", borderRadius: 999,
                    border: "1px dashed var(--pulso-border)",
                    background: "white", color: "var(--pulso-text-soft)",
                    cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 3,
                  }}
                >
                  <Plus size={9} />
                  <code style={{ fontFamily: "monospace" }}>{v.name}</code>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// -- Exclusion editor --------------------------------------------------------

function ExclusionEditor({
  cruceVar, onChange, onClose,
}: {
  cruceVar: CruceVarConfig;
  onChange: (excl: string[]) => void;
  onClose: () => void;
}) {
  const [valores, setValores] = useState<ValorColumna[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const excluidas = cruceVar.excluidas ?? [];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await apiAnaliticaColumnValues(cruceVar.name);
        if (!cancelled) setValores(r.values);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cruceVar.name]);

  function toggle(value: string) {
    onChange(excluidas.includes(value) ? excluidas.filter((x) => x !== value) : [...excluidas, value]);
  }

  return (
    <div
      style={{
        border: "1px solid var(--pulso-border)",
        borderRadius: 8,
        background: "white",
        padding: 12,
        display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Filter size={14} color="#b45309" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            Excluir categorías de <code style={{ fontFamily: "monospace" }}>{cruceVar.name}</code>
          </div>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
            Las categorías marcadas aquí <strong>no aparecerán como columnas</strong> cuando esta variable sea cruce. Útil para ocultar categorías con casi nula frecuencia.
          </div>
        </div>
        <button type="button" onClick={onClose} className="pulso-icon" aria-label="Cerrar" style={{ minWidth: 24, minHeight: 24 }}>
          <X size={13} />
        </button>
      </div>

      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          padding: "8px 10px",
          background: "#fff7e8",
          border: "1px solid #f0d799",
          borderRadius: 6,
          fontSize: 11, color: "#8a5000", lineHeight: 1.5,
        }}
      >
        <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <strong>Limitación conocida:</strong> al excluir una categoría, las filas con ese valor se filtran antes de generar todas las tablas. Eso significa que la categoría <em>tampoco aparece como fila</em> cuando la variable es cruzada por otra. En Frecuencias y Libro de códigos la categoría sigue visible con normalidad.
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: "#b91c1c", padding: "6px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", textAlign: "center", padding: 10 }}>Cargando categorías…</div>
      ) : valores.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", textAlign: "center", padding: 10 }}>
          Esta variable no tiene categorías distintas en la data.
        </div>
      ) : (
        <div
          style={{
            display: "flex", flexDirection: "column", gap: 3,
            maxHeight: 280, overflowY: "auto",
            border: "1px solid var(--pulso-border)", borderRadius: 6,
            padding: 4,
            scrollbarWidth: "thin", scrollbarColor: "var(--pulso-border) transparent",
          }}
        >
          {valores.map((v) => {
            const active = excluidas.includes(v.value);
            return (
              <label
                key={v.value}
                style={{
                  display: "grid", gridTemplateColumns: "14px 1fr", gap: 8, alignItems: "center",
                  padding: "4px 8px", borderRadius: 4,
                  background: active ? "#fff7e8" : "transparent",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--pulso-surface-2)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <input type="checkbox" checked={active} onChange={() => toggle(v.value)} style={{ margin: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <code style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: active ? "#8a5000" : "var(--pulso-text)" }}>{v.value}</code>
                  {v.label && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "var(--pulso-text-soft)" }}>
                      {v.label}
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {excluidas.length > 0 && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button type="button" onClick={() => onChange([])} style={{ fontSize: 11 }}>Quitar todas las exclusiones</button>
        </div>
      )}
    </div>
  );
}
