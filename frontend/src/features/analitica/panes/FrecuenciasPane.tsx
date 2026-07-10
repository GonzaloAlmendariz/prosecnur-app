import { useEffect, useMemo, useState } from "react";
import { ArrowDown01, ArrowUp01, BarChart2, CheckCircle2, Hash, Info, ListOrdered, Plus, Rows3, Table2, X } from "lucide-react";
import {
  apiAnaliticaFrecuencias,
  apiAnaliticaVariables,
  VariableInstrumento,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore } from "../store";
import { VariableSelect } from "../VariableSelect";
import { Section, GenerateFooter } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";

// FrecuenciasPane — configuración específica del reporte de frecuencias.
// Las secciones del instrumento y las variables excluidas globalmente
// viven en "Definición global" arriba de la página; aquí el analista
// solo decide QUÉ variables resumir numéricamente y CÓMO ordenar las
// respuestas. Las secciones activas = todas las no-ocultas en el global.

export function FrecuenciasPane() {
  const frec = useAnaliticaStore((s) => s.config.frecuencias);
  const secciones = useAnaliticaStore((s) => s.config.secciones);
  const numericasGlobal = useAnaliticaStore((s) => s.config.numericas);
  const excluidas = useAnaliticaStore((s) => s.config.variables_excluidas);
  const setFrec = useAnaliticaStore((s) => s.setFrecuencias);
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
    await run.runSync(() => apiAnaliticaFrecuencias());
  }

  // Numéricas: solo entran al análisis si el usuario las declara aquí
  // o vienen en la definición global. No hay autodetección.
  const numericas = frec.numericas_override ?? numericasGlobal;

  function addNumerica(v: string) {
    if (!v || numericas.includes(v)) return;
    setFrec({ numericas_override: [...numericas, v] });
  }
  function removeNumerica(v: string) {
    setFrec({ numericas_override: numericas.filter((x) => x !== v) });
  }
  function clearNumericas() {
    setFrec({ numericas_override: [] });
  }

  // Resumen de qué entra: todas las secciones no-ocultas del global.
  const seccionesActivas = secciones.filter((s) => !s.oculto);
  const variablesByName = useMemo(() => new Map(variables.map((v) => [v.name, v])), [variables]);
  const variablesExcluidas = useMemo(() => new Set(excluidas), [excluidas]);
  const nVariablesAfectadas = seccionesActivas.reduce((sum, s) => {
    return sum + s.variables.filter((name) => {
      if (variablesExcluidas.has(name)) return false;
      const meta = variablesByName.get(name);
      return !!meta?.categorica || numericas.includes(name);
    }).length;
  }, 0);
  const ordenOptions = [
    { k: "desc", label: "Más frecuentes", hint: "Prioriza lectura ejecutiva", icon: <ArrowDown01 size={13} /> },
    { k: "asc", label: "Menos frecuentes", hint: "Útil para detectar minorías", icon: <ArrowUp01 size={13} /> },
    { k: "original", label: "Instrumento", hint: "Respeta el orden del XLSForm", icon: <ListOrdered size={13} /> },
  ] as const;
  const ordenActual = ordenOptions.find((o) => o.k === frec.orden) ?? ordenOptions[0];

  return (
    <Panel className="analitica-frecuencias-panel">
      <div className="analitica-report-shell analitica-frecuencias-workbench">
        <div className="analitica-frecuencias-docbar">
          <span className="analitica-frecuencias-docbar-icon" aria-hidden="true">
            <BarChart2 size={16} />
          </span>
          <div className="analitica-frecuencias-docbar-copy">
            <span>Producto tabular</span>
            <strong>Frecuencias</strong>
            <small>Tablas univariadas estilo SPSS agrupadas por instrumento.</small>
          </div>
          <div className="analitica-frecuencias-docbar-stats" aria-label="Estado del reporte de frecuencias">
            <span>
              Secciones
              <strong>{seccionesActivas.length} {seccionesActivas.length === 1 ? "activa" : "activas"}</strong>
            </span>
            <span>
              Variables
              <strong>{nVariablesAfectadas} analizables</strong>
            </span>
            <span>
              Orden
              <strong>{ordenActual.label}</strong>
            </span>
          </div>
        </div>

        <div className="analitica-report-note">
          <Info size={14} />
          <div>
            Secciones y exclusiones se controlan en <strong>Definición global</strong>. Aquí solo ajustas cómo se resumen las variables y cómo queda presentada la tabla final.
            {excluidas.length > 0 && (
              <> Hay <strong>{excluidas.length}</strong> {excluidas.length === 1 ? "variable excluida" : "variables excluidas"} activas.</>
            )}
          </div>
        </div>

        <Section
          title="Variables con resumen numérico"
          subtitle={<>
            Se resumen con <strong>media, desviación y percentiles</strong> en lugar de tabla: edades, ingresos, tiempos de espera.
          </>}
        >
          <div className="analitica-frecuencias-picker-stack">
            <NumericasPicker
              numericas={numericas}
              variables={variables}
              onAdd={addNumerica}
              onRemove={removeNumerica}
            />
            {numericas.length > 0 && (
              <button
                type="button"
                onClick={clearNumericas}
                className="analitica-frecuencias-clear"
                title="Quitar todas las variables numéricas de este reporte"
              >
                Quitar numéricas
              </button>
            )}
          </div>
        </Section>

        <Section
          title="Presentación"
          subtitle="Cómo se ordenan las respuestas dentro de cada tabla del reporte."
        >
          <div className="analitica-frecuencias-presentation-stack">
            <div className="analitica-segmented" role="group" aria-label="Orden de respuestas">
              {ordenOptions.map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setFrec({ orden: o.k })}
                  className={frec.orden === o.k ? "is-on" : undefined}
                  title={o.hint}
                >
                  <span className="analitica-inline-title">
                    {o.icon}
                    {o.label}
                  </span>
                </button>
              ))}
            </div>

            <p className="analitica-presentation-hint">
              Las listas marcadas como <strong>ordinales</strong> en <em>Orden de categorías</em> conservan su orden fijo aunque elijas “Más frecuentes”.
            </p>

            <div className="analitica-control-grid">
              <label className={`analitica-control-card ${frec.mostrar_todo ? "is-active" : ""}`}>
                <input
                  type="checkbox"
                  checked={frec.mostrar_todo}
                  onChange={(e) => setFrec({ mostrar_todo: e.target.checked })}
                />
                <span className="analitica-control-icon">
                  {frec.mostrar_todo ? <CheckCircle2 size={15} /> : <Rows3 size={15} />}
                </span>
                <span>
                  <span className="analitica-control-title">Mostrar catálogo completo</span>
                  <span className="analitica-control-copy">
                    Incluye opciones sin respuestas para reportes comparables entre mediciones.
                  </span>
                </span>
              </label>

              <label className={`analitica-control-card ${frec.incluir_secciones ? "is-active" : ""}`}>
                <input
                  type="checkbox"
                  checked={frec.incluir_secciones}
                  onChange={(e) => setFrec({ incluir_secciones: e.target.checked })}
                />
                <span className="analitica-control-icon">
                  {frec.incluir_secciones ? <CheckCircle2 size={15} /> : <Rows3 size={15} />}
                </span>
                <span>
                  <span className="analitica-control-title">Mostrar nombres de sección</span>
                  <span className="analitica-control-copy">
                    Agrega la celda separadora con el nombre de cada sección del instrumento.
                  </span>
                </span>
              </label>

              <div className="analitica-control-card">
                <span className="analitica-control-icon"><Table2 size={15} /></span>
                <div>
                  <div className="analitica-control-title">Salida Excel pulida</div>
                  <div className="analitica-control-copy">
                    Las tablas simples mantienen siempre el título de la variable y salen con hoja blanca, gridlines ocultas y columnas numéricas centradas.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <GenerateFooter
          label="Generar frecuencias"
          busy={run.busy}
          fileId={run.fileId}
          downloadName={run.filename ?? "frecuencias.xlsx"}
          error={run.error}
          onGenerate={onGenerate}
          disabled={nVariablesAfectadas === 0}
          disabledHint={nVariablesAfectadas === 0 ? "No hay secciones visibles. Abre Definición global y activa alguna con el icono del ojo." : undefined}
          perBase={run.perBase}
        />
      </div>
    </Panel>
  );
}

// -- Numéricas picker -------------------------------------------------------

function NumericasPicker({
  numericas, variables, onAdd, onRemove,
}: {
  numericas: string[];
  variables: VariableInstrumento[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [pendingVar, setPendingVar] = useState("");

  // Sugerencias automáticas: variables tipo integer del instrumento que
  // aún no están en el bucket de numéricas.
  const sugeridas = useMemo(() => {
    return variables
      .filter((v) => !!v.numerica)
      .filter((v) => !numericas.includes(v.name))
      .slice(0, 6);
  }, [variables, numericas]);

  function commitAdd() {
    if (pendingVar && !numericas.includes(pendingVar)) {
      onAdd(pendingVar);
    }
    setPendingVar("");
    setAdding(false);
  }

  return (
    <div className="analitica-variable-picker">
      {numericas.length === 0 && !adding && (
        <div className="analitica-empty">
          <span className="analitica-empty-icon" aria-hidden="true">
            <Hash size={15} />
          </span>
          <strong>Sin resumen numérico</strong>
          <small>Marca edades, ingresos o puntajes para resumirlos aparte.</small>
        </div>
      )}
      {numericas.length > 0 && (
        <div className="analitica-token-list">
          {numericas.map((v) => {
            const meta = variables.find((x) => x.name === v);
            return (
              <span
                key={v}
                title={meta?.label}
                className="analitica-token"
              >
                <Hash size={10} />
                {v}
                <button
                  type="button"
                  onClick={() => onRemove(v)}
                  className="pulso-icon"
                  aria-label={`Quitar ${v}`}
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {adding ? (
        <div className="analitica-picker-edit-row">
          <div className="analitica-picker-select">
            <VariableSelect
              variables={variables.filter((v) => !!v.numerica && !numericas.includes(v.name))}
              value={pendingVar}
              onChange={setPendingVar}
              placeholder="Seleccionar variable numérica…"
            />
          </div>
          <button
            type="button"
            className="pulso-primary"
            onClick={commitAdd}
            disabled={!pendingVar}
          >
            Añadir
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setPendingVar(""); }}
            className="pulso-secondary"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="analitica-picker-actions">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="analitica-add-inline"
          >
            <Plus size={12} /> Añadir variable numérica
          </button>
          {sugeridas.length > 0 && (
            <>
              <span className="analitica-picker-hint">
                sugerencias:
              </span>
              {sugeridas.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => onAdd(v.name)}
                  title={v.label}
                  className="analitica-suggestion-chip"
                >
                  <Plus size={9} />
                  <code>{v.name}</code>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
