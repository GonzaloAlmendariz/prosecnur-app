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
// Las cifras salen de `resumen/modeloResumen.ts`. Elegir una sección o una
// pregunta lleva al Constructor (`onSelectRow` / `onIrAPregunta`).
// =============================================================================

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, X } from "../../../vendor/lucide-react";
import type { BuilderDiagnostic, BuilderStructure, XlsformEditorWorkbook } from "../types";
import { buildCatalogs } from "../parsing/buildIndex";
import { BarraComposicion } from "../resumen/BarraComposicion";
import { PendientesPublicar } from "../resumen/PendientesPublicar";
import { TablaSecciones } from "../resumen/TablaSecciones";
import { LineaTiempo } from "../resumen/LineaTiempo";
import {
  minutos,
  pendientesParaPublicar,
  porcentaje,
  resumirFormulario,
  type AccionPendiente,
} from "../resumen/modeloResumen";
import { usePreviaImpreso } from "../impreso/storePrevia";
import "../styles/xf-summary.css";

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
  open: boolean;
  onClose: () => void;
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure | null;
  diagnostics: BuilderDiagnostic[];
  onSelectRow?: (rowIndex: number) => void;
  contexto: ContextoResumen;
  /** Dentro de una pestaña del editor: sin portal, sin «Volver» ni «Cerrar», y Esc no cierra. */
  embebido?: boolean;
};

function readFormTitle(workbook: XlsformEditorWorkbook): string {
  const idx = workbook.settings.columns.indexOf("form_title");
  if (idx < 0) return "";
  return (workbook.settings.rows[0]?.[idx] ?? "").trim();
}

type Cifra = { clave: string; rotulo: string; valor: string; detalle: string };

export function FormSummaryView({
  open,
  onClose,
  embebido = false,
  workbook,
  structure,
  diagnostics,
  onSelectRow,
  contexto,
}: FormSummaryViewProps) {
  useEffect(() => {
    if (!open || embebido) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, embebido, onClose]);

  const formTitle = useMemo(() => readFormTitle(workbook), [workbook]);
  const resumen = useMemo(
    () => resumirFormulario(structure, buildCatalogs(workbook.choices)),
    [structure, workbook],
  );

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
      detalle: masLarga && masLarga.preguntas ? `la más larga: ${masLarga.name || masLarga.rotulo} (${masLarga.preguntas})` : "sin secciones",
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
        ? `${porcentaje(resumen.conCondiciones, resumen.preguntas)} aparecen sólo si se cumple su condición`
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
      valor: resumen.preguntas ? `≈ ${minutos(resumen.segundos)} min` : "—",
      detalle: resumen.preguntas ? `unos ${Math.round(resumen.segundos / resumen.preguntas)} s por pregunta` : "sin preguntas",
    },
  ];

  if (!open) return null;

  const vista = (
    <div
      className={`pulso-graph-overlay pulso-xfsum-overlay${embebido ? " is-embebido" : " pulso-xf-overlay-enter"}`}
      role={embebido ? "region" : "dialog"}
      aria-modal={embebido ? undefined : true}
      aria-label="Resumen del formulario"
      data-audit-ready="xlsform-resumen"
    >
      <header className="pulso-graph-header">
        <div className="pulso-graph-header-left">
          {!embebido && (
            <button type="button" className="pulso-graph-back" onClick={onClose}>
              <ChevronLeft size={14} /> Volver al editor
            </button>
          )}
          <div className="pulso-graph-header-title">
            <strong>Resumen</strong>
            <span>{formTitle || "Formulario sin título"}</span>
          </div>
        </div>
        {!embebido && (
          <div className="pulso-graph-header-right">
            <button type="button" className="pulso-icon" onClick={onClose} aria-label="Cerrar resumen" title="Cerrar">
              <X size={14} />
            </button>
          </div>
        )}
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
          onAbrir={(fila) => { if (fila.name) contexto.onIrAPregunta(fila.name); }}
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
                  <BarraComposicion
                    titulo="Tipos de pregunta"
                    total={resumen.preguntas}
                    segmentos={resumen.tipos.map((t) => ({ clave: t.base, rotulo: t.rotulo, valor: t.preguntas }))}
                  />
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
            onAbrir={(fila) => { if (fila.name) contexto.onIrAPregunta(fila.name); }}
          />
        </div>
      </div>
    </div>
  );
  return embebido ? vista : createPortal(vista, document.body);
}
