import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown01, ArrowUp01, BarChart2, Hash, Info, ListOrdered, Plus, Table2, X } from "lucide-react";
import {
  apiAnaliticaFrecuencias,
  apiAnaliticaVariables,
  VariableInstrumento,
} from "../../../api/client";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import { CifrasPestana } from "../CifrasPestana";
import { InterruptorOpcion } from "../InterruptorOpcion";
import { DIRECCION_DATOS } from "../direccionesAnalitica";
import { resumenSecciones, variablesAnalizables } from "../estructuraDeSecciones";
import { useAnaliticaStore } from "../store";
import { VariableSelect } from "../VariableSelect";
import { Section, GenerateFooter } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";
import { NotasPieEditor } from "./NotasPieEditor";

// FrecuenciasPane — configuración específica del reporte de frecuencias.
// Las secciones del instrumento y las variables excluidas se deciden en la
// pestaña Datos; aquí el analista solo decide QUÉ variables resumir
// numéricamente y CÓMO ordenar las respuestas. Las secciones activas son las
// no ocultas; sin secciones declaradas, el motor usa las del instrumento.

export function FrecuenciasPane() {
  const frec = useAnaliticaStore((s) => s.config.frecuencias);
  const secciones = useAnaliticaStore((s) => s.config.secciones);
  const numericasGlobal = useAnaliticaStore((s) => s.config.numericas);
  const excluidas = useAnaliticaStore((s) => s.config.variables_excluidas);
  const setFrec = useAnaliticaStore((s) => s.setFrecuencias);
  const run = useReporteRun();

  const [variables, setVariables] = useState<VariableInstrumento[]>([]);
  // Mientras llegan las variables (el backend puede tardar varios segundos en
  // preparar la fuente) la pestaña no afirma «0 analizables»: dice que lee.
  const [lecturaVariables, setLecturaVariables] = useState<"leyendo" | "lista" | "error">("leyendo");

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const r = await apiAnaliticaVariables();
        if (!vigente) return;
        setVariables(r.variables);
        setLecturaVariables("lista");
      } catch {
        if (vigente) setLecturaVariables("error");
      }
    })();
    return () => { vigente = false; };
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

  // Resumen de qué entra. Sin secciones declaradas no son «0 activas»: el
  // motor agrupa por la estructura del instrumento (C5, vacío por
  // desconexión que bloqueaba «Generar» sin motivo).
  const resumen = resumenSecciones(secciones);
  const variablesExcluidas = useMemo(() => new Set(excluidas), [excluidas]);
  const nVariablesAfectadas = variablesAnalizables(secciones, variables, variablesExcluidas, numericas);
  const ordenOptions = [
    { k: "desc", label: "Más frecuentes", hint: "Prioriza lectura ejecutiva", icon: <ArrowDown01 size={13} /> },
    { k: "asc", label: "Menos frecuentes", hint: "Útil para detectar minorías", icon: <ArrowUp01 size={13} /> },
    { k: "original", label: "Instrumento", hint: "Respeta el orden del XLSForm", icon: <ListOrdered size={13} /> },
  ] as const;
  const variablesConTabla = useMemo(
    () => variables.filter((v) => !variablesExcluidas.has(v.name) && (!!v.categorica || numericas.includes(v.name))),
    [variables, variablesExcluidas, numericas],
  );
  const ordenActual = ordenOptions.find((o) => o.k === frec.orden) ?? ordenOptions[0];

  return (
    <Panel className="analitica-frecuencias-panel">
      {/* C1: barra, nota, secciones, notas al pie y pie de generación son
          bloques independientes de alto intrínseco. */}
      <div
        className="analitica-report-shell analitica-frecuencias-workbench"
        data-qa-geometry-group="analitica/frecuencias-workbench"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="analitica-frecuencias-docbar">
          <span className="analitica-frecuencias-docbar-icon" aria-hidden="true">
            <BarChart2 size={16} />
          </span>
          <div className="analitica-frecuencias-docbar-copy">
            <span>Producto tabular</span>
            <strong>Frecuencias</strong>
            <small>Tablas univariadas estilo SPSS agrupadas por instrumento.</small>
          </div>
          <CifrasPestana
            ariaLabel="Estado del reporte de frecuencias"
            cifras={[
              {
                etiqueta: "Secciones",
                valor: resumen.modo === "instrumento"
                  ? "del instrumento"
                  : `${formatoConteo(resumen.activas)} ${resumen.activas === 1 ? "activa" : "activas"}`,
                titulo: resumen.modo === "instrumento" ? "Sin secciones declaradas en Datos: se usan las del instrumento." : undefined,
              },
              {
                etiqueta: "Variables",
                valor: lecturaVariables === "leyendo"
                  ? "leyendo…"
                  : lecturaVariables === "error"
                    ? "sin leer"
                    : `${formatoConteo(nVariablesAfectadas)} analizables`,
                tono: lecturaVariables === "error" ? "alerta" : undefined,
                titulo: lecturaVariables === "error" ? "No se pudieron leer las variables del instrumento. Vuelve a abrir la pestaña." : undefined,
              },
              { etiqueta: "Orden", valor: ordenActual.label },
            ]}
          />
        </div>

        <div className="analitica-report-note">
          <Info size={14} />
          <div>
            Secciones y exclusiones se deciden en <Link to={DIRECCION_DATOS} className="analitica-enlace-pestana">Datos</Link>. Aquí solo ajustas cómo se resumen las variables y cómo queda presentada la tabla final.
            {excluidas.length > 0 && (
              <> Hay <strong>{formatoConteo(excluidas.length)}</strong> {excluidas.length === 1 ? "variable excluida" : "variables excluidas"}.</>
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
              <PulsoButton
                variant="ghost"
                size="sm"
                onClick={clearNumericas}
                className="analitica-frecuencias-clear"
                title="Quitar todas las variables numéricas de este reporte"
              >
                <X size={12} aria-hidden="true" />
                Quitar numéricas
              </PulsoButton>
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
              <InterruptorOpcion
                checked={frec.mostrar_todo}
                onToggle={() => setFrec({ mostrar_todo: !frec.mostrar_todo })}
                titulo="Mostrar catálogo completo"
                descripcion="Incluye opciones sin respuestas para reportes comparables entre mediciones."
              />

              <InterruptorOpcion
                checked={frec.incluir_secciones}
                onToggle={() => setFrec({ incluir_secciones: !frec.incluir_secciones })}
                titulo="Mostrar nombres de sección"
                descripcion="Agrega la celda separadora con el nombre de cada sección del instrumento."
              />

            </div>

            {/* Lo que no es una opción no lleva forma de opción (P-B5). */}
            <p className="analitica-presentation-hint analitica-presentation-note">
              <Table2 size={13} aria-hidden="true" />
              <span>
                <strong>Salida Excel:</strong> cada tabla conserva el título de su variable y sale con hoja blanca, sin líneas de cuadrícula y con las columnas numéricas centradas.
              </span>
            </p>
          </div>
        </Section>

        <NotasPieEditor variante="frecuencias" variables={variablesConTabla} />

        <GenerateFooter
          label="Generar frecuencias"
          busy={run.busy}
          fileId={run.fileId}
          downloadName={run.filename ?? "frecuencias.xlsx"}
          error={run.error}
          onGenerate={onGenerate}
          disabled={nVariablesAfectadas === 0}
          disabledHint={nVariablesAfectadas === 0
            ? lecturaVariables === "leyendo"
              ? "Leyendo las variables del instrumento…"
              : lecturaVariables === "error"
                ? "No se pudieron leer las variables del instrumento. Vuelve a abrir la pestaña."
                : resumen.modo === "declaradas" && resumen.activas === 0
              ? "Todas las secciones están ocultas. Muestra alguna en la pestaña Datos."
              : "No hay variables que tabular. Incluye alguna en la pestaña Datos."
            : undefined}
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
        <EstadoVacio
          icono={<Hash size={15} />}
          titulo="Sin resumen numérico"
          descripcion="Marca edades, ingresos o puntajes para resumirlos aparte."
        />
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
          <PulsoButton variant="primary" onClick={commitAdd} disabled={!pendingVar}>
            Añadir
          </PulsoButton>
          <PulsoButton variant="secondary" onClick={() => { setAdding(false); setPendingVar(""); }}>
            Cancelar
          </PulsoButton>
        </div>
      ) : (
        <div className="analitica-picker-actions">
          <PulsoButton variant="secondary" onClick={() => setAdding(true)}>
            <Plus size={13} aria-hidden="true" />
            Añadir variable numérica
          </PulsoButton>
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
