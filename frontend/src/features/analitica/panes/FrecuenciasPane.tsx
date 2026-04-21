import { useEffect, useMemo, useState } from "react";
import { ArrowDown01, ArrowUp01, BarChart2, ListOrdered, Hash, Plus, X } from "lucide-react";
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
  const excluidasCount = useAnaliticaStore((s) => s.config.variables_excluidas.length);
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

  // Numéricas:
  //   - `numericas_override === undefined` → usa el default auto-detectado
  //     (todas las variables `integer` / `decimal` del instrumento).
  //   - `numericas_override === []` → el usuario dijo explícitamente "ninguna".
  //   - `numericas_override === [...]` → selección manual.
  const numericasAuto = useMemo(
    () => variables.filter((v) => v.tipo === "integer" || v.tipo === "decimal").map((v) => v.name),
    [variables],
  );
  const numericas = frec.numericas_override ?? (numericasGlobal.length > 0 ? numericasGlobal : numericasAuto);

  function addNumerica(v: string) {
    if (!v || numericas.includes(v)) return;
    setFrec({ numericas_override: [...numericas, v] });
  }
  function removeNumerica(v: string) {
    setFrec({ numericas_override: numericas.filter((x) => x !== v) });
  }
  function resetToAuto() {
    setFrec({ numericas_override: undefined });
  }
  const usandoAuto = frec.numericas_override === undefined && numericasGlobal.length === 0;

  // Resumen de qué entra: todas las secciones no-ocultas del global.
  const seccionesActivas = secciones.filter((s) => !s.oculto);
  const nVariablesAfectadas = seccionesActivas.reduce((sum, s) => sum + s.variables.length, 0);

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><BarChart2 size={16} /> Frecuencias</span>}
      hint="Tablas univariadas estilo SPSS, una por variable, agrupadas según la estructura del instrumento. Ideal para revisar distribuciones rápidas."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* Resumen de qué entra al reporte — lee el estado global. */}
        <div
          style={{
            fontSize: 11, color: "var(--pulso-text-soft)",
            padding: "8px 12px", borderRadius: 6,
            background: "var(--pulso-surface)",
            border: "1px solid var(--pulso-border)",
            lineHeight: 1.5,
          }}
        >
          Este reporte incluye <strong style={{ color: "var(--pulso-text)" }}>{seccionesActivas.length}</strong> {seccionesActivas.length === 1 ? "sección" : "secciones"} ({nVariablesAfectadas} variables). Para ajustar qué secciones entran o excluir variables, edita <strong>Definición global</strong> arriba.
          {excluidasCount > 0 && (
            <> Actualmente hay <strong>{excluidasCount}</strong> {excluidasCount === 1 ? "variable excluida" : "variables excluidas"}.</>
          )}
        </div>

        {/* 1. Variables numéricas */}
        <Section
          title="1. Variables con resumen numérico"
          subtitle={<>
            Las variables marcadas aquí se muestran con <strong>media, desviación, mínimo, máximo y percentiles</strong> en lugar de una tabla de frecuencias. Útil para edades, ingresos, tiempos de espera, etc.
          </>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {usandoAuto && numericas.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic", lineHeight: 1.4 }}>
                Detección automática: todas las variables <code>integer</code> y <code>decimal</code> del instrumento están seleccionadas por defecto. Edita la lista para ajustar.
              </div>
            )}
            <NumericasPicker
              numericas={numericas}
              variables={variables}
              onAdd={addNumerica}
              onRemove={removeNumerica}
            />
            {!usandoAuto && (
              <button
                type="button"
                onClick={resetToAuto}
                style={{ alignSelf: "flex-start", fontSize: 11, padding: "3px 8px" }}
                title="Volver a la detección automática (integer + decimal)"
              >
                Restaurar detección automática
              </button>
            )}
          </div>
        </Section>

        {/* 2. Presentación */}
        <Section
          title="2. Presentación"
          subtitle="Cómo se ordenan las respuestas dentro de cada tabla del reporte."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Orden de respuestas</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(
                  [
                    { k: "desc", label: "Más frecuente arriba", icon: <ArrowDown01 size={12} /> },
                    { k: "asc", label: "Menos frecuente arriba", icon: <ArrowUp01 size={12} /> },
                    { k: "original", label: "Orden del instrumento", icon: <ListOrdered size={12} /> },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => setFrec({ orden: o.k })}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 6,
                      border: `1px solid ${frec.orden === o.k ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                      background: frec.orden === o.k ? "var(--pulso-primary-soft)" : "white",
                      color: frec.orden === o.k ? "var(--pulso-primary)" : "var(--pulso-text)",
                      cursor: "pointer", fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {o.icon}
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={frec.mostrar_todo}
                onChange={(e) => setFrec({ mostrar_todo: e.target.checked })}
              />
              <div>
                <div style={{ fontWeight: 500 }}>Mostrar todas las categorías declaradas</div>
                <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
                  Incluye las opciones del instrumento aunque no haya respuestas para ellas. Útil para reportes comparables entre olas.
                </div>
              </div>
            </label>
          </div>
        </Section>

        {/* 5. Generar */}
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
      .filter((v) => v.tipo === "integer" || v.tipo === "decimal")
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
        <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
          Aún no hay variables marcadas como numéricas.
        </div>
      )}
      {numericas.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {numericas.map((v) => {
            const meta = variables.find((x) => x.name === v);
            return (
              <span
                key={v}
                title={meta?.label}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 4px 3px 10px", borderRadius: 999,
                  background: "var(--pulso-primary-soft)",
                  border: "1px solid var(--pulso-primary)",
                  fontSize: 11, fontFamily: "monospace", color: "var(--pulso-primary)",
                }}
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
              variables={variables.filter((v) => !numericas.includes(v.name))}
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
