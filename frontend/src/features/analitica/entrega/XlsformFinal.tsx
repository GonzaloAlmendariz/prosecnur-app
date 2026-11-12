// El XLSForm final que sale en la misma corrida del libro en Excel: un botón
// neutro al pie de su archivo (el ZIP si hay varias bases).

import type { MultiBaseResult } from "../../../api/client";
import { descargarDelServidor } from "../../../components/entregables/entregaArchivo";
import { PulsoButton } from "../../../components/PulsoButton";
import { Download } from "../../../vendor/lucide-react";

export function XlsformFinal({ result }: { result?: MultiBaseResult }) {
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
