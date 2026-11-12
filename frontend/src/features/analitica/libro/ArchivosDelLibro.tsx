// "Archivos" del libro (prototipo, Analítica › Entrega): el Excel y el PDF. Antes
// de generar, su nombre y "Por generar"; al generar, el contenedor de
// entregables del kit con el avance, el archivo listo y sus acciones, o el
// fallo. El XLSForm final sale en la misma corrida del Excel, al pie de su
// archivo. La app no guarda cuándo se generó cada uno, así que no lo dice.

import type { MultiBaseResult } from "../../../api/client";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { descargarDelServidor } from "../../../components/entregables/entregaArchivo";
import { TileFormato } from "../../../components/entregables/TileFormato";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { Download, FolderOpen } from "../../../vendor/lucide-react";
import { ArchivosPorBase } from "../PaneKit";
import type { ReporteRunState } from "../useReporteRun";

type Run = Pick<ReporteRunState, "generacion" | "perBase" | "lastResult">;

/** El XLSForm final de la misma corrida: un botón neutro al pie del libro en Excel (el ZIP si hay varias bases). */
function XlsformFinal({ result }: { result?: MultiBaseResult }) {
  const fileId = result?.zip?.file_id ?? result?.file_id;
  if (!fileId) return null;
  const filename = result?.zip?.filename ?? result?.filename ?? "xlsform_final.xlsx";
  return (
    <div className="analitica-per-base-list" role="group" aria-label="XLSForm final">
      <PulsoButton variant="secondary" size="sm" className="pulso-entregable-texto" title={filename} onClick={() => descargarDelServidor(fileId, filename)}>
        <Download size={12} aria-hidden="true" /> XLSForm final
      </PulsoButton>
    </div>
  );
}

function Archivo({ formato, nombre, run, conXlsform }: { formato: "xlsx" | "pdf"; nombre: string; run: Run; conXlsform?: boolean }) {
  const { estado, cerrar } = run.generacion;
  if (estado.fase === "inactiva") {
    return (
      <li className="libro-archivo">
        <TileFormato formato={formato} />
        <div>
          <b>{nombre}</b>
          <span>Por generar</span>
        </div>
      </li>
    );
  }
  const porBase = run.perBase.length > 1 ? run.perBase : [];
  const pie = estado.fase === "lista" && (porBase.length > 0 || conXlsform)
    ? <>{porBase.length > 0 ? <ArchivosPorBase bases={porBase} /> : null}{conXlsform ? <XlsformFinal result={run.lastResult?.xlsform} /> : null}</>
    : undefined;
  return (
    <li className="libro-archivo libro-archivo--activo">
      <ContenedorEntregable estado={estado} forma="bloque" onCerrar={cerrar} pie={pie} />
    </li>
  );
}

export function ArchivosDelLibro({ excel, pdf }: { excel: Run; pdf: Run }) {
  return (
    <PanelDeMesa zona="archivos" titulo="Archivos" icono={<FolderOpen size={16} aria-hidden="true" />}>
      <ul className="libro-archivos" data-qa-geometry-group="analitica/libro-archivos" data-qa-geometry-contract="intrinsic">
        <Archivo formato="xlsx" nombre="Libro de códigos en Excel" run={excel} conXlsform />
        <Archivo formato="pdf" nombre="Libro de códigos en PDF" run={pdf} />
      </ul>
    </PanelDeMesa>
  );
}
