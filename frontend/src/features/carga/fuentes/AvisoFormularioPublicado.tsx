// «¿Ya publicaste el formulario? Úsalo» (ADR 0102): la vía que pide subir el
// XLSForm como Excel no se elimina, pero si hay formularios publicados se ofrece
// arriba el camino que no lo pide.

import { PulsoButton } from "../../../components/PulsoButton";
import { FileCheck2 } from "../../../vendor/lucide-react";
import { formatoConteoDe } from "../../../lib/formatoNumero";

export function AvisoFormularioPublicado({ cuantos, onUsar }: { cuantos: number; onUsar: () => void }) {
  if (cuantos < 1) return null;
  return (
    <aside className="pulso-bfp-aviso" aria-label="Formularios publicados disponibles">
      <FileCheck2 size={16} aria-hidden="true" />
      <span>
        <strong>¿Ya publicaste el formulario? Úsalo.</strong>
        <small>Tienes {formatoConteoDe(cuantos, "formulario publicado", "formularios publicados")} en Formularios; no hace falta subir el XLSForm.</small>
      </span>
      <PulsoButton variant="secondary" size="sm" onClick={onUsar}>Usar un formulario publicado</PulsoButton>
    </aside>
  );
}
