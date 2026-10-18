// =============================================================================
// shell/FormSummaryView.tsx — pestaña «Resumen» del editor de formularios
// =============================================================================
// Rediseño 2026-10-15 («esto puede verse muchísimo mejor»). Usa todo el ancho
// de la pestaña:
//   - una banda de cifras en lenguaje llano (sin jerga XLSForm);
//   - «Qué falta para publicar e imprimir», conectado a lo que el editor ya
//     sabe (lógica por revisar, escalas repetidas, avisos, preguntas sin lista,
//     previa del impreso), con su enlace;
//   - la composición en barras apiladas de UN sistema de color;
//   - las secciones como tabla ordenable con su peso, dueña de su scroll.
// Las cifras salen de `resumen/modeloResumen.ts`. Su propósito es DIAGNOSTICAR
// (ítem 50): una fila de la tabla se despliega ahí mismo con sus preguntas (la
// abierta es el `foco`), un tramo del recorrido resalta su fila, y al
// Constructor sólo se va con el «Editar» de cada pregunta o con los botones de
// «Qué falta», que ya dicen adónde llevan. Una pestaña no se cierra.
// =============================================================================

import { useCallback, useMemo, useState } from "react";
import type { BuilderDiagnostic, BuilderStructure, XlsformEditorWorkbook } from "../types";
import { buildCatalogs } from "../parsing/buildIndex";
import { BarraComposicion } from "../resumen/BarraComposicion";
import { TiposConMaqueta } from "../resumen/TiposConMaqueta";
import { PendientesPublicar } from "../resumen/PendientesPublicar";
import { TablaSecciones } from "../resumen/TablaSecciones";
import { LineaTiempo } from "../resumen/LineaTiempo";
import {
  pendientesParaPublicar,
  porcentaje,
  rangoMinutos,
  resumirFormulario,
  type AccionPendiente,
} from "../resumen/modeloResumen";
import { claveSeccion, preguntasDeSeccion } from "../resumen/preguntasDeSeccion";
import { usePreviaImpreso } from "../impreso/storePrevia";
import { alternarFicha } from "./detalleEnSitio";
// Hoja del Resumen partida en dos (revamp EM); el orden de estos imports es el de la cascada.
import "../styles/xf-summary/01-el-overlay-de-antes-sigue-ex.css";
import "../styles/xf-summary/02-secciones.css";

/** Lo que el editor sabe fuera de la estructura: lógica, listas, impreso y adónde llevar cada cosa. */
export type ContextoResumen = {
  formId: string | null;
  logica: { pendiente: boolean; externa: string | null };
  escalasRepetidas: number;
  /** Correcciones que el backend exige para publicar y que no son diagnósticos locales. */
  erroresPublicacion: number;
  onRevisarLogica?: () => void;
  onAbrirListas: () => void;
  onIrAPregunta: (name: string) => void;
  onIrImpreso: () => void;
};

export type FormSummaryViewProps = {
  /** Nombre del formulario en la biblioteca (el mismo del selector). El form_title va como secundario si difiere. */
  nombre?: string;
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure | null;
  diagnostics: BuilderDiagnostic[];
  /** «Ir al primero» de los avisos en «Qué falta»: una acción explícita hacia el Constructor. */
  onSelectRow?: (rowIndex: number) => void;
  contexto: ContextoResumen;
  /** Clave de la sección desplegada en la tabla (el `foco` de la dirección), o null. */
  seccionAbierta: string | null;
  onSeccionAbierta: (clave: string | null) => void;
};

function readFormTitle(workbook: XlsformEditorWorkbook): string {
  const idx = workbook.settings.columns.indexOf("form_title");
  if (idx < 0) return "";
  return (workbook.settings.rows[0]?.[idx] ?? "").trim();
}

type Cifra = { clave: string; rotulo: string; valor: string; detalle: string };

export function FormSummaryView({
  nombre,
  workbook,
  structure,
  diagnostics,
  onSelectRow,
  contexto,
  seccionAbierta,
  onSeccionAbierta,
}: FormSummaryViewProps) {
  const formTitle = useMemo(() => readFormTitle(workbook), [workbook]);
  const catalogos = useMemo(() => buildCatalogs(workbook.choices), [workbook]);
  const resumen = useMemo(() => resumirFormulario(structure, catalogos), [structure, catalogos]);
  const preguntasDe = useCallback(
    (seccionId: string) => preguntasDeSeccion(structure, catalogos, seccionId),
    [structure, catalogos],
  );
  // El tramo pedido en el «Recorrido en el tiempo»: su fila se resalta y se trae a la vista.
  const [resaltada, setResaltada] = useState<{ id: string; clave: string } | null>(null);

  const previa = usePreviaImpreso();
  const estadoImpreso: "sin-previa" | "al-dia" | "vieja" =
    previa.fase !== "lista" || previa.formId !== contexto.formId
      ? "sin-previa"
      : previa.workbook === workbook ? "al-dia" : "vieja";

  const errores = diagnostics.filter((d) => d.level === "error").length + contexto.erroresPublicacion;
  const avisos = diagnostics.filter((d) => d.level === "warn").length;
  const primeraFila = diagnostics.find((d) => d.level !== "info" && d.rowIndex != null)?.rowIndex ?? null;
  const pendientes = pendientesParaPublicar({
    logica: contexto.logica,
    escalasRepetidas: contexto.escalasRepetidas,
    diagnosticos: { errores, avisos, primeraFila },
    sinLista: resumen.sinLista,
    impreso: { estado: estadoImpreso, paginas: previa.cifras?.paginas ?? null },
  });

  const irA = (destino: AccionPendiente) => {
    if (destino.tipo === "revisar-logica") contexto.onRevisarLogica?.();
    else if (destino.tipo === "listas") contexto.onAbrirListas();
    else if (destino.tipo === "fila") onSelectRow?.(destino.rowIndex);
    else if (destino.tipo === "pregunta") contexto.onIrAPregunta(destino.name);
    else contexto.onIrImpreso();
  };

  const masLarga = [...resumen.filasSecciones].sort((a, b) => b.preguntas - a.preguntas)[0];
  const cifras: Cifra[] = [
    {
      clave: "preguntas",
      rotulo: "Preguntas",
      valor: String(resumen.preguntas),
      detalle: resumen.notas ? `y ${resumen.notas} ${resumen.notas === 1 ? "nota" : "notas"}` : "sin notas aparte",
    },
    {
      clave: "secciones",
      rotulo: "Secciones",
      valor: String(resumen.secciones),
      detalle: masLarga && masLarga.preguntas ? `la más larga tiene ${masLarga.preguntas}` : "sin secciones",
    },
    {
      clave: "obligatorias",
      rotulo: "Obligatorias",
      valor: String(resumen.obligatorias),
      detalle: `${porcentaje(resumen.obligatorias, resumen.preguntas)} de las preguntas`,
    },
    {
      clave: "condiciones",
      rotulo: "Con condición",
      valor: String(resumen.conCondiciones),
      detalle: resumen.conCondiciones
        ? `${porcentaje(resumen.conCondiciones, resumen.preguntas)} son condicionales`
        : contexto.logica.pendiente ? "la lógica está por revisar" : "todas aparecen siempre",
    },
    {
      clave: "listas",
      rotulo: "Listas de opciones",
      valor: String(resumen.listas),
      detalle: contexto.escalasRepetidas
        ? `${contexto.escalasRepetidas} ${contexto.escalasRepetidas === 1 ? "escala repetida" : "escalas repetidas"}`
        : "ninguna escala repetida",
    },
    {
      clave: "duracion",
      rotulo: "Duración estimada",
      valor: resumen.preguntas ? rangoMinutos(resumen.segundosSinCondicion, resumen.segundos) : "—",
      detalle: resumen.preguntas
        ? resumen.segundosSinCondicion < resumen.segundos ? "según cuántas condiciones se cumplan" : `unos ${Math.round(resumen.segundos / resumen.preguntas)} s por pregunta`
        : "sin preguntas",
    },
  ];

  return (
    <div
      className="pulso-graph-overlay pulso-xfsum-overlay is-embebido"
      role="region"
      aria-label="Resumen del formulario"
      data-audit-ready="xlsform-resumen"
    >
      <header className="pulso-graph-header">
        <div className="pulso-graph-header-left">
          <div className="pulso-graph-header-title">
            <strong>Resumen</strong>
            <span>
              {nombre?.trim() || formTitle || "Formulario sin título"}
              {nombre?.trim() && formTitle && formTitle !== nombre.trim() ? ` · título en el formulario: ${formTitle}` : ""}
            </span>
          </div>
        </div>
      </header>

      <div className="pulso-xf-res" data-qa-scroll-owner="resumen">
        <section className="pulso-xf-res-cifras" aria-label="El formulario en cifras"
          data-qa-geometry-group="xlsform/resumen-cifras" data-qa-geometry-contract="equal">
          {cifras.map((c) => (
            <article key={c.clave} className={`pulso-xf-res-cifra is-${c.clave}`} data-qa-geometry-member="">
              <span className="pulso-xf-res-cifra-rotulo">{c.rotulo}</span>
              <strong className="pulso-xf-res-cifra-valor">{c.valor}</strong>
              <span className="pulso-xf-res-cifra-detalle" title={c.detalle}>{c.detalle}</span>
            </article>
          ))}
        </section>

        <LineaTiempo
          filas={resumen.filasSecciones}
          segundos={resumen.segundos}
          resaltada={resaltada?.id ?? null}
          onResaltar={(fila) => setResaltada({ id: fila.id, clave: claveSeccion(fila) })}
        />

        <div className="pulso-xf-res-cuerpo" data-qa-geometry-group="xlsform/resumen-cuerpo" data-qa-geometry-contract="intrinsic">
            <PendientesPublicar items={pendientes} onAccion={irA} />
            <section className="pulso-xf-res-panel pulso-xf-res-composicion" aria-labelledby="xf-res-composicion-titulo" data-qa-geometry-member=""
              data-qa-geometry-capacity="owned">
              <header className="pulso-xf-res-panel-cabeza">
                <h3 id="xf-res-composicion-titulo">Composición</h3>
                <span className="pulso-xf-res-panel-nota">{resumen.preguntas} preguntas</span>
              </header>
              {resumen.preguntas === 0 ? (
                <p className="pulso-xf-res-vacio">Aún no hay preguntas: agrega la primera en el Constructor.</p>
              ) : (
                <div className="pulso-xf-res-comp-pila" data-qa-geometry-group="xlsform/resumen-composicion" data-qa-geometry-contract="intrinsic">
                  <TiposConMaqueta tipos={resumen.tipos} total={resumen.preguntas} />
                  <BarraComposicion
                    titulo="Obligatoriedad"
                    total={resumen.preguntas}
                    segmentos={[
                      { clave: "obligatorias", rotulo: "Obligatorias", valor: resumen.obligatorias },
                      { clave: "opcionales", rotulo: "Opcionales", valor: resumen.preguntas - resumen.obligatorias },
                    ]}
                  />
                  <BarraComposicion
                    titulo="Forma de responder"
                    total={resumen.preguntas}
                    segmentos={[
                      { clave: "cerradas", rotulo: "Cerradas", valor: resumen.cerradas, detalle: "Se elige entre opciones" },
                      { clave: "abiertas", rotulo: "Abiertas", valor: resumen.abiertas, detalle: "Se escribe o se anota un número o una fecha" },
                    ]}
                  />
                </div>
              )}
            </section>
          <TablaSecciones
            filas={resumen.filasSecciones}
            kindDe={(id) => structure?.sections.get(id)?.kind ?? "root"}
            abierta={seccionAbierta}
            onAlternar={(clave) => {
              setResaltada(null);
              onSeccionAbierta(alternarFicha(seccionAbierta, clave));
            }}
            resaltada={resaltada?.clave ?? null}
            preguntasDe={preguntasDe}
            onEditarPregunta={contexto.onIrAPregunta}
          />
        </div>
      </div>
    </div>
  );
}
