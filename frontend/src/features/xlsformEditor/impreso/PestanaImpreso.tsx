// =============================================================================
// impreso/PestanaImpreso.tsx — pestaña «Impreso» del editor de formularios
// =============================================================================
// Reemplaza al diálogo «Configurar PDF» (2026-10-15), con la anatomía de la
// pestaña Word de Gráficos: partes a la izquierda (`ListaPartes`), tarjetas de
// detalle al centro y «Así queda» a la derecha con la previa real. La cabecera
// dice el formato y, si hay previa, sus cifras (páginas contadas en el PDF y
// preguntas del resumen del motor); exporta Word y PDF por `onExportForm`.
//
// La parte elegida es el `foco` de la dirección (`?pestana=impreso&foco=matrices`).
// =============================================================================

import { useEffect, useMemo } from "react";
import { ListaPartes, type GrupoDePartes } from "../../../components/ListaPartes";
import { PulsoButton } from "../../../components/PulsoButton";
import { FileText } from "../../../vendor/lucide-react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { XlsformPaperExportOptions } from "../../../api/xlsformEditor";
import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";
import type { ConsentQuestion } from "../parsing/detectConsentQuestions";
import type { BuilderStructure } from "../types";
import { buildPaperExportOptions } from "../shell/pdfExportPreference";
import { DetalleContenido, DetalleFormato, DetalleLogica } from "./DetallesDocumento";
import { DetalleMatrices } from "./DetalleMatrices";
import { DetallePapel } from "./DetallePapel";
import {
  PARTES_IMPRESO,
  esParteImpreso,
  filasConPapel,
  resumenCabecera,
  resumenDeParte,
  separarCandidatas,
  type ParteImpreso,
} from "./modeloImpreso";
import { generarPrevia, previaVieja, usePreviaImpreso } from "./storePrevia";
import { PreviaImpreso } from "./PreviaImpreso";
import { useEstadoImpreso } from "./useEstadoImpreso";
import "./impreso.css";

const ID_DETALLE = "xf-impreso-detalle";
const PREFIJO = "xf-impreso-parte";

export type PestanaImpresoProps = {
  formId: string | null;
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure | null;
  storageKey: string | null;
  candidatas: readonly MatrixCandidate[];
  consentimiento: readonly ConsentQuestion[];
  /** Nombre del archivo de la previa (el mismo que tendría el PDF exportado). */
  nombrePdf: string;
  /** Parte pedida por la dirección (`foco`). */
  parte: string | null;
  onParte: (parte: ParteImpreso) => void;
  /** Exportar de verdad: guarda en el proyecto y avisa (el `onExportForm` del editor). */
  onExportar: (formato: "pdf" | "word", opciones: XlsformPaperExportOptions) => void;
  onIrAPregunta: (name: string) => void;
  /** Texto del trabajo en curso del editor (exportando…), o vacío. */
  ocupado: string;
};

export function PestanaImpreso({
  formId,
  workbook,
  structure,
  storageKey,
  candidatas,
  consentimiento,
  nombrePdf,
  parte: partePedida,
  onParte,
  onExportar,
  onIrAPregunta,
  ocupado,
}: PestanaImpresoProps) {
  const { estado, actualizar, actualizarMatriz } = useEstadoImpreso(storageKey, candidatas);
  const parte: ParteImpreso = esParteImpreso(partePedida) ? partePedida : "formato";
  const filas = useMemo(() => filasConPapel(structure), [structure]);
  const nombresConsent = useMemo(() => consentimiento.map((q) => q.name), [consentimiento]);
  const opciones = useMemo(
    () => buildPaperExportOptions(estado, candidatas, nombresConsent),
    [estado, candidatas, nombresConsent],
  );

  const previa = usePreviaImpreso();
  // Otra previa de otro formulario no se muestra: se descarta al llegar.
  useEffect(() => {
    if (previa.formId !== null && previa.formId !== formId) previa.descartar();
  }, [formId, previa]);
  const vieja = previaVieja(previa, opciones, workbook);
  const generando = previa.fase === "generando" || previa.fase === "descargando";
  const motivo = ocupado ? "Hay una exportación en curso." : generando ? "La previa se está generando." : null;
  const generar = () => {
    if (motivo) return;
    void generarPrevia({ formId, workbook, filename: nombrePdf, opciones });
  };

  const { matrices: reales } = separarCandidatas(candidatas);
  const grupos: GrupoDePartes<ParteImpreso>[] = [{
    id: "impreso",
    partes: PARTES_IMPRESO.map((p) => {
      const ctx = { candidatas, consentimiento, filasPapel: filas.length };
      const detalle = resumenDeParte(p.clave, estado, ctx);
      if (p.clave === "matrices") {
        return { ...p, detalle, estado: { tono: "conteo" as const, texto: String(reales.length) } };
      }
      if (p.clave === "papel") {
        return { ...p, detalle, estado: { tono: "conteo" as const, texto: String(filas.length) } };
      }
      // Formato, Lógica y Contenido no llevan estado: su detalle ya dice lo elegido. Las cuentas sí.
      return { ...p, detalle };
    }),
  }];

  const cifras = previa.fase === "lista" && previa.formId === formId ? previa.cifras : null;

  return (
    <div className="pulso-xf-imp" data-audit-ready="xlsform-impreso" data-qa-surface="xlsform/impreso">
      <header className="pulso-xf-imp-barra">
        <span className="pulso-xf-imp-barra-icono" aria-hidden="true"><FileText size={16} /></span>
        <h2 className="pulso-xf-imp-titulo">Impreso</h2>
        <p className="pulso-xf-imp-resumen" role="note" title={resumenCabecera(cifras)}>{resumenCabecera(cifras)}</p>
        <span className="pulso-xf-imp-acciones">
          <PulsoButton variant="secondary" size="sm" onClick={generar} disabled={Boolean(motivo)} title={motivo ?? "Genera el PDF con estas opciones y lo muestra en «Así queda»"}>
            Previsualizar
          </PulsoButton>
          <PulsoButton variant="secondary" size="sm" onClick={() => onExportar("word", opciones)} disabled={Boolean(ocupado)}>
            Exportar Word
          </PulsoButton>
          <PulsoButton variant="primary" size="sm" onClick={() => onExportar("pdf", opciones)} disabled={Boolean(ocupado)}>
            {ocupado || "Exportar PDF"}
          </PulsoButton>
        </span>
      </header>
      <div className="pulso-xf-imp-cuerpo">
        <div className="pulso-xf-imp-partes">
          <ListaPartes etiqueta="Partes del impreso" grupos={grupos} actual={parte} onElegir={onParte} idPanel={ID_DETALLE} prefijoId={PREFIJO} />
        </div>
        <div className="pulso-xf-imp-contenido" data-qa-scroll-owner="impreso">
          <div
            id={ID_DETALLE}
            className="pulso-xf-imp-detalle"
            role="region"
            aria-labelledby={`${PREFIJO}-${parte}`}
            data-qa-geometry-group="xlsform/impreso-detalle"
            data-qa-geometry-contract="intrinsic"
          >
            {parte === "formato" && <DetalleFormato estado={estado} actualizar={actualizar} />}
            {parte === "logica" && <DetalleLogica estado={estado} actualizar={actualizar} consentimiento={consentimiento} />}
            {parte === "contenido" && <DetalleContenido estado={estado} actualizar={actualizar} />}
            {parte === "matrices" && <DetalleMatrices candidatas={candidatas} matrices={estado.matrices} onCambiar={actualizarMatriz} />}
            {parte === "papel" && <DetallePapel filas={filas} onIrAPregunta={onIrAPregunta} />}
          </div>
          <PreviaImpreso previa={previa} vieja={vieja} motivo={motivo} onGenerar={generar} />
        </div>
      </div>
    </div>
  );
}
