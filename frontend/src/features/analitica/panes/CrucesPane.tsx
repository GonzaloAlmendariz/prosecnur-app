import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Filter, GitBranch, Grid3x3, Info, Layers, Plus, Sigma, X } from "lucide-react";
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
import { useSession } from "../../../lib/SessionContext";

// CrucesPane — configuración mínima.
// 1. Variables a cruzar (con posibilidad de excluir categorías específicas).
// 2. Modo: estándar (frecuencias) o dimensiones (índices 0-100). El modo
//    "dimensiones" solo está disponible cuando el tab Dimensiones ya generó
//    `rp_dim` en backend.
// 3. Significancia estadística.
// 4. Generar.
//
// Hardcodeado: `incluir_total` siempre en true (la fila Total es útil
// siempre), `alpha` fijo en 0.05. Semáforo y brechas se delegan al módulo
// Dashboard cuando se publica; en Cruces solo se persisten al store.

export function CrucesPane() {
  const cruces = useAnaliticaStore((s) => s.config.cruces);
  const frec = useAnaliticaStore((s) => s.config.frecuencias);
  const numericasGlobal = useAnaliticaStore((s) => s.config.numericas);
  const setCruces = useAnaliticaStore((s) => s.setCruces);
  const addCruceVar = useAnaliticaStore((s) => s.addCruceVar);
  const removeCruceVar = useAnaliticaStore((s) => s.removeCruceVar);
  const setCruceVarExcluidas = useAnaliticaStore((s) => s.setCruceVarExcluidas);
  const run = useReporteRun();
  const { state } = useSession();
  const dimOk = !!state?.analitica_dim_ok;

  // Si el usuario tenía guardado modo="dimensiones" pero las dimensiones aún
  // no están construidas, caemos a "estandar" silenciosamente para no fallar.
  useEffect(() => {
    if (cruces.modo === "dimensiones" && !dimOk) {
      setCruces({ modo: "estandar" });
    }
  }, [cruces.modo, dimOk, setCruces]);

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
    // Defaults fijos: alpha 0.05 e incluir_total siempre. `modo` lo
    // controla el usuario (estandar / dimensiones).
    const patch: Partial<typeof cruces> = {};
    if (cruces.alpha !== 0.05) patch.alpha = 0.05;
    if (!cruces.incluir_total) patch.incluir_total = true;
    if (Object.keys(patch).length > 0) setCruces(patch);
    await run.runAsync(() => apiAnaliticaCruces());
  }

  const nVars = cruces.cruces_vars.length;
  const numericas = frec.numericas_override ?? numericasGlobal;
  const crucesVariables = useMemo(
    () => variables.filter((v) => !!v.categorica),
    [variables],
  );
  const nResto = Math.max(
    0,
    variables.filter((v) => !!v.categorica || numericas.includes(v.name)).length - nVars,
  );
  const modoLabel = cruces.modo === "dimensiones" ? "Dimensiones" : "Estándar";

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Grid3x3 size={16} /> Cruces</span>}
      hint="Tablas cruzadas 2D. Cada variable elegida se cruza contra el resto del instrumento. Incluye fila y columna Total por defecto."
    >
      <div className="analitica-report-shell">
        <div className="analitica-report-overview">
          <Metric label="Cruces" value={nVars} suffix={nVars === 1 ? "variable" : "variables"} />
          <Metric label="Contra" value={nResto} suffix="variables" />
          <Metric label="Modo" value={modoLabel} compact />
          <Metric label="Signif." value={cruces.show_sig ? "Sí" : "No"} compact />
        </div>

        <div className="analitica-report-note">
          <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            Elige pocas variables de columna, pero buenas: sexo, distrito, sede, grupo etario o servicio. Cada una abre un bloque y se cruza contra el resto del instrumento.
          </div>
        </div>

        <Section
          title="Variables a cruzar"
          subtitle={<>
            Cada variable que elijas <strong>define las columnas</strong> de un bloque de tablas y se cruza contra todas las demás del instrumento. Típicamente: sexo, distrito, servicio, grupo etario. Puedes excluir categorías específicas de cada variable cuando tengan casi ninguna respuesta.
          </>}
        >
          <VariableChips
            selected={cruces.cruces_vars}
            variables={crucesVariables}
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

        <Section
          title="Modo de cruces"
          subtitle={<>
            <strong>Estándar</strong> reporta frecuencias y porcentajes (modo clásico). <strong>Dimensiones</strong> reporta promedios 0-100 de los índices y bloques construidos en el tab Dimensiones — útil para informes de satisfacción / desempeño donde la unidad de análisis es el índice, no la categoría.
          </>}
        >
          <div className="analitica-control-grid">
            <ModoOption
              active={cruces.modo === "estandar"}
              icon={<Grid3x3 size={13} />}
              label="Estándar"
              hint="Frecuencias % por categoría"
              onClick={() => setCruces({ modo: "estandar" })}
            />
            <ModoOption
              active={cruces.modo === "dimensiones"}
              disabled={!dimOk}
              icon={<Layers size={13} />}
              label="Dimensiones"
              hint={dimOk
                ? "Promedios 0-100 de índices y bloques"
                : "Genera dimensiones primero (tab Dimensiones)"}
              onClick={() => dimOk && setCruces({ modo: "dimensiones" })}
            />
          </div>
        </Section>

        <Section
          title="Presentación del Excel"
          subtitle="Controla si el archivo incluye celdas separadoras de sección. El título de cada variable se conserva siempre al inicio de su tabla."
        >
          <div className="analitica-control-grid">
            <label className={`analitica-control-card ${cruces.incluir_secciones ? "is-active" : ""}`} style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={cruces.incluir_secciones}
                onChange={(e) => setCruces({ incluir_secciones: e.target.checked })}
                style={{ marginTop: 6, accentColor: "var(--pulso-primary)" }}
              />
              <span className="analitica-control-icon">
                {cruces.incluir_secciones ? <CheckCircle2 size={15} /> : <Layers size={15} />}
              </span>
              <span>
                <span className="analitica-control-title">Mostrar nombres de sección</span>
                <span className="analitica-control-copy">
                  Agrega una celda separadora antes de las tablas de cada sección.
                </span>
              </span>
            </label>

            <div className="analitica-control-card">
              <span className="analitica-control-icon"><Grid3x3 size={15} /></span>
              <span>
                <span className="analitica-control-title">Títulos de variables fijos</span>
                <span className="analitica-control-copy">
                  La pregunta o etiqueta de la variable permanece encima de cada tabla de cruce.
                </span>
              </span>
            </div>
          </div>
        </Section>

        <Section
          title="Significancia estadística"
          subtitle={<>
            Marca con un asterisco las celdas cuya diferencia entre columnas es estadísticamente significativa (chi² al 5%). Útil para identificar rápidamente los patrones de interés.
          </>}
        >
          <label
            className={`analitica-control-card ${cruces.show_sig ? "is-active" : ""}`}
            style={{
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={cruces.show_sig}
              onChange={(e) => setCruces({ show_sig: e.target.checked })}
              style={{ marginTop: 3, accentColor: "var(--pulso-primary)" }}
            />
            <span className="analitica-control-icon">
              {cruces.show_sig ? <CheckCircle2 size={15} /> : <Sigma size={15} />}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="analitica-control-title">
                Mostrar diferencias significativas
              </span>
              <span className="analitica-control-copy">
                Activa el test de independencia entre fila y columna. Las celdas con p-valor &lt; 0.05 se marcan con asterisco.
              </span>
            </div>
          </label>
        </Section>

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
          perBase={run.perBase}
        />
      </div>
    </Panel>
  );
}

function Metric({
  label,
  value,
  suffix,
  compact,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  compact?: boolean;
}) {
  return (
    <div className="analitica-stat">
      <span className="analitica-stat-label">{label}</span>
      <span className="analitica-stat-value" style={compact ? { fontSize: 13, paddingTop: 2 } : undefined}>
        {value}
        {suffix && <small>{suffix}</small>}
      </span>
    </div>
  );
}

// -- Variable chips + picker (schema v2 con exclusiones) ---------------------

function VariableChips({
  selected, variables, onAdd, onRemove, onSetExcluidas,
}: {
  selected: CruceVarConfig[];
  variables: VariableInstrumento[];
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
        <div className="analitica-empty">
          Aún no elegiste variables. Usa <strong>Añadir variable</strong> para crear el primer bloque de cruces.
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
                className="analitica-variable-row"
              >
                <code>{cv.name}</code>
                {meta?.label && (
                  <span className="analitica-variable-label">
                    {meta.label}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditingExclusion(editingExclusion === cv.name ? null : cv.name)}
                  title="Excluir categorías cuando esta variable sea cruce"
                  style={{
                    fontSize: 11, padding: "4px 9px",
                    display: "inline-flex", alignItems: "center", gap: 5,
                    borderRadius: 999,
                    border: `1px solid ${nExcl > 0 ? "var(--tipo-text-border)" : "var(--pulso-border)"}`,
                    background: nExcl > 0 ? "var(--tipo-text-bg)" : "white",
                    color: nExcl > 0 ? "var(--tipo-text-fg)" : "var(--pulso-text)",
                    cursor: "pointer",
                    fontWeight: nExcl > 0 ? 600 : 500,
                    transition: "border-color 120ms ease, background 120ms ease",
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
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
        >
          <Plus size={12} /> Añadir variable
        </button>
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
        <Filter size={14} color="var(--pulso-warn-fg)" />
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
          background: "var(--pulso-warn-bg)",
          border: "1px solid #f0d799",
          borderRadius: 6,
          fontSize: 11, color: "var(--pulso-warn-fg)", lineHeight: 1.5,
        }}
      >
        <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <strong>Limitación conocida:</strong> al excluir una categoría, las filas con ese valor se filtran antes de generar todas las tablas. Eso significa que la categoría <em>tampoco aparece como fila</em> cuando la variable es cruzada por otra. En Frecuencias y Libro de códigos la categoría sigue visible con normalidad.
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: "var(--pulso-danger-fg)", padding: "6px 10px", background: "var(--pulso-danger-bg)", border: "1px solid #fecaca", borderRadius: 4 }}>
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
                  background: active ? "var(--pulso-warn-bg)" : "transparent",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--pulso-surface-2)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <input type="checkbox" checked={active} onChange={() => toggle(v.value)} style={{ margin: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <code style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: active ? "var(--pulso-warn-fg)" : "var(--pulso-text)" }}>{v.value}</code>
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

// -- Selector de modo de cruces (estandar / dimensiones) --------------------
// Pill grande tipo radio button. Quedó fuera del PaneKit por ser específica
// de Cruces — si Dashboard reutiliza el patrón en el futuro, se promueve.

function ModoOption({
  active,
  disabled,
  icon,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? hint : undefined}
      className={`analitica-control-card ${active ? "is-active" : ""}`}
      style={{ textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }}
    >
      <span className="analitica-control-icon">{icon}</span>
      <span
        style={{ display: "flex", flexDirection: "column", gap: 3 }}
      >
        <span className="analitica-control-title">
          <GitBranch size={13} />
          {label}
        </span>
        <span className="analitica-control-copy">
          {hint}
        </span>
      </span>
    </button>
  );
}
