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
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><BarChart2 size={16} /> Frecuencias</span>}
      hint="Tablas univariadas estilo SPSS, una por variable, agrupadas según la estructura del instrumento. Ideal para revisar distribuciones rápidas."
    >
      <div className="analitica-report-shell">
        <div className="analitica-report-overview">
          <Metric label="Secciones" value={seccionesActivas.length} suffix={seccionesActivas.length === 1 ? "activa" : "activas"} />
          <Metric label="Variables" value={nVariablesAfectadas} suffix="analizables" />
          <Metric label="Numéricas" value={numericas.length} suffix="resumen" />
          <Metric label="Orden" value={ordenActual.label} compact />
        </div>

        <div className="analitica-report-note">
          <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
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
            Las variables marcadas aquí se muestran con <strong>media, desviación, mínimo, máximo y percentiles</strong> en lugar de una tabla de frecuencias. Útil para edades, ingresos, tiempos de espera, etc.
          </>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                style={{ alignSelf: "flex-start", fontSize: 11, padding: "3px 8px" }}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="analitica-segmented" role="group" aria-label="Orden de respuestas">
              {ordenOptions.map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setFrec({ orden: o.k })}
                  className={frec.orden === o.k ? "is-on" : undefined}
                  title={o.hint}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {o.icon}
                    {o.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="analitica-control-grid">
              <label className={`analitica-control-card ${frec.mostrar_todo ? "is-active" : ""}`} style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={frec.mostrar_todo}
                  onChange={(e) => setFrec({ mostrar_todo: e.target.checked })}
                  style={{ marginTop: 6, accentColor: "var(--pulso-primary)" }}
                />
                <span className="analitica-control-icon">
                  {frec.mostrar_todo ? <CheckCircle2 size={15} /> : <Rows3 size={15} />}
                </span>
                <span>
                  <span className="analitica-control-title">Mostrar catálogo completo</span>
                  <span className="analitica-control-copy">
                    Incluye opciones sin respuestas para reportes comparables entre olas.
                  </span>
                </span>
              </label>

              <label className={`analitica-control-card ${frec.incluir_secciones ? "is-active" : ""}`} style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={frec.incluir_secciones}
                  onChange={(e) => setFrec({ incluir_secciones: e.target.checked })}
                  style={{ marginTop: 6, accentColor: "var(--pulso-primary)" }}
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
          downloadName="frecuencias.xlsx"
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {numericas.length === 0 && !adding && (
        <div className="analitica-empty">
          Aún no hay variables marcadas como numéricas.
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
                  style={{ minWidth: 16, minHeight: 16 }}
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {adding ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
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
            style={{ fontSize: 12, padding: "6px 14px" }}
          >
            Añadir
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setPendingVar(""); }}
            style={{ fontSize: 12, padding: "6px 10px" }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Plus size={12} /> Añadir variable numérica
          </button>
          {sugeridas.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginLeft: 4 }}>
                sugerencias:
              </span>
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
