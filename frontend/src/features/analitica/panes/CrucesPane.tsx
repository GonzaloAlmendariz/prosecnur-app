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
    <Panel className="analitica-cruces-panel">
      <div className="analitica-report-shell analitica-cruces-workbench">
        <div className="analitica-cruces-docbar">
          <span className="analitica-cruces-docbar-icon" aria-hidden="true">
            <Grid3x3 size={16} />
          </span>
          <div className="analitica-cruces-docbar-copy">
            <span>Producto comparativo</span>
            <strong>Cruces</strong>
            <small>Comparaciones 2D con totales y significancia opcional.</small>
          </div>
          <div className="analitica-cruces-docbar-stats" aria-label="Estado del reporte de cruces">
            <span>
              Cruces
              <strong>{nVars} {nVars === 1 ? "variable" : "variables"}</strong>
            </span>
            <span>
              Contra
              <strong>{nResto} variables</strong>
            </span>
            <span>
              Modo
              <strong>{modoLabel}</strong>
            </span>
          </div>
        </div>

        <div className="analitica-report-note">
          <Info size={14} />
          <div>
            Elige pocas variables de columna, pero buenas: sexo, distrito, sede, grupo etario o servicio. Cada una abre un bloque y se cruza contra el resto del instrumento.
          </div>
        </div>

        <Section
          title="Variables a cruzar"
          subtitle={<>
            Cada variable <strong>define las columnas</strong> de un bloque y se cruza contra el resto del instrumento; puedes excluir categorías con casi ninguna respuesta.
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
            <div className="analitica-cruces-summary">
              El reporte generará <strong>{nVars}</strong> {nVars === 1 ? "bloque de tablas" : "bloques de tablas"} cruzando cada variable seleccionada contra las otras <strong>{nResto}</strong> variables del instrumento.
            </div>
          )}
        </Section>

        <Section
          title="Modo de cruces"
          subtitle={<>
            <strong>Estándar</strong> reporta frecuencias y porcentajes; <strong>Dimensiones</strong> reporta promedios 0-100 de los índices construidos.
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
            <label className={`analitica-control-card ${cruces.incluir_secciones ? "is-active" : ""}`}>
              <input
                type="checkbox"
                checked={cruces.incluir_secciones}
                onChange={(e) => setCruces({ incluir_secciones: e.target.checked })}
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
            Marca con asterisco las celdas con diferencia significativa entre columnas (chi² al 5%).
          </>}
        >
          <label
            className={`analitica-control-card ${cruces.show_sig ? "is-active" : ""}`}
          >
            <input
              type="checkbox"
              checked={cruces.show_sig}
              onChange={(e) => setCruces({ show_sig: e.target.checked })}
            />
            <span className="analitica-control-icon">
              {cruces.show_sig ? <CheckCircle2 size={15} /> : <Sigma size={15} />}
            </span>
            <div className="analitica-control-stack">
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
          downloadName={run.filename ?? "cruces.xlsx"}
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
    <div className="analitica-variable-picker">
      {selected.length === 0 && !adding && (
        <div className="analitica-empty">
          <span className="analitica-empty-icon" aria-hidden="true">
            <GitBranch size={15} />
          </span>
          <strong>Sin variables de cruce</strong>
          <small>El primer bloque se crea con una variable de columna.</small>
        </div>
      )}
      {selected.length > 0 && (
        <div className="analitica-variable-list">
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
                  className={`analitica-cruces-filter-chip ${nExcl > 0 ? "is-active" : ""}`}
                >
                  <Filter size={11} />
                  {nExcl === 0 ? "Excluir…" : `${nExcl} excluida${nExcl === 1 ? "" : "s"}`}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(cv.name)}
                  className="pulso-icon"
                  aria-label={`Quitar ${cv.name}`}
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
        <div className="analitica-picker-edit-row">
          <div className="analitica-picker-select">
            <VariableSelect
              variables={variables.filter((v) => !selected.some((cv) => cv.name === v.name))}
              value={pendingVar}
              onChange={setPendingVar}
              placeholder="Seleccionar variable a cruzar…"
            />
          </div>
          <button type="button" className="pulso-primary" onClick={commit} disabled={!pendingVar}>Añadir</button>
          <button type="button" className="pulso-secondary" onClick={() => { setAdding(false); setPendingVar(""); }}>Cancelar</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="analitica-add-inline"
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
    <div className="analitica-exclusion-editor">
      <div className="analitica-exclusion-head">
        <span className="analitica-exclusion-icon" aria-hidden="true">
          <Filter size={14} />
        </span>
        <div className="analitica-exclusion-copy">
          <div className="analitica-exclusion-title">
            Excluir categorías de <code>{cruceVar.name}</code>
          </div>
          <div className="analitica-exclusion-subtitle">
            Las categorías marcadas <strong>no aparecen como columnas</strong> de este cruce; útil para frecuencias casi nulas.
          </div>
        </div>
        <button type="button" onClick={onClose} className="pulso-icon analitica-exclusion-close" aria-label="Cerrar">
          <X size={13} />
        </button>
      </div>

      <div className="analitica-exclusion-warning">
        <AlertTriangle size={12} />
        <div>
          <strong>Limitación conocida:</strong> las filas excluidas se filtran de todo el bloque de cruces (tampoco aparecen como fila); en Frecuencias y Libro de códigos siguen visibles.
        </div>
      </div>

      {error && (
        <div className="analitica-exclusion-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="analitica-exclusion-state">Cargando categorías…</div>
      ) : valores.length === 0 ? (
        <div className="analitica-exclusion-state">
          Esta variable no tiene categorías distintas en la data.
        </div>
      ) : (
        <div className="analitica-exclusion-list">
          {valores.map((v) => {
            const active = excluidas.includes(v.value);
            return (
              <label
                key={v.value}
                className={`analitica-exclusion-row${active ? " is-active" : ""}`}
              >
                <input type="checkbox" checked={active} onChange={() => toggle(v.value)} />
                <div className="analitica-exclusion-value">
                  <code>{v.value}</code>
                  {v.label && (
                    <span>
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
        <div className="analitica-exclusion-actions">
          <button type="button" onClick={() => onChange([])} className="pulso-secondary">Quitar todas las exclusiones</button>
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
      className={`analitica-control-card analitica-cruces-mode-option ${active ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
    >
      <span className="analitica-control-icon">{icon}</span>
      <span className="analitica-control-stack">
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
