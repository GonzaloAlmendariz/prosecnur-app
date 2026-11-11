// "Cómo se unieron" de una base integrada (Carga › Bases, R2): los orígenes,
// la columna que los distingue, los archivos con que quedó y qué se decidió
// sobre fraseos y variables, a la vista. La bitácora completa abre su panel.

import { useLocation, useNavigate } from "react-router-dom";
import { NombreArchivo } from "../../../../components/entregables/NombreArchivo";
import { PulsoButton } from "../../../../components/PulsoButton";
import { conNivel } from "../../../../lib/navegacion/direccion";
import { formatoConteoDe } from "../../../../lib/formatoNumero";
import { ScrollText } from "../../../../vendor/lucide-react";
import { PANEL_BITACORA_INTEGRACION } from "../../panelesCarga";
import type { ResumenDeIntegracion } from "./integracionModel";

export function ResumenDeIntegracionVista({ resumen }: { resumen: ResumenDeIntegracion }) {
  const location = useLocation();
  const navigate = useNavigate();
  const nFraseosPropios = resumen.fraseosPorOrigen.reduce((suma, g) => suma + g.entries.length, 0);
  return (
    <div className="pulso-bases-integracion">
      <p className="pulso-bases-dato">Unidas por la columna <code>{resumen.llave}</code></p>
      {resumen.fecha ? <p className="pulso-bases-dato">Integradas el {resumen.fecha}</p> : null}
      <ul className="pulso-bases-fuentes" aria-label="Orígenes integrados">
        {resumen.origenes.map((o) => (
          <li key={o.clave}>
            <code>{o.llave}</code>
            <span className="pulso-bases-fuente-titulo">{o.etiqueta}</span>
            <span className="pulso-bases-canal">{o.fuente}</span>
          </li>
        ))}
      </ul>
      <dl className="pulso-bases-archivos">
        {resumen.archivos.map((a) => (
          <div key={a.rotulo}>
            <dt>{a.rotulo}</dt>
            <dd><NombreArchivo nombre={a.archivo} /></dd>
          </div>
        ))}
      </dl>
      <ul className="pulso-bases-decisiones" aria-label="Decisiones de la integración">
        <li>Fraseo final común: {formatoConteoDe(resumen.fraseoComun.length, "variable")}</li>
        <li>
          Fraseos propios por origen: {formatoConteoDe(nFraseosPropios, "variable")}
          {resumen.fraseosPorOrigen.length
            ? ` (${resumen.fraseosPorOrigen.map((g) => `${g.origin}: ${g.entries.length}`).join(", ")})`
            : ""}
        </li>
        <li>Variantes preservadas: {formatoConteoDe(resumen.nVariantes, "variante")} en {formatoConteoDe(resumen.variantes.length, "variable")}</li>
      </ul>
      <div className="pulso-bases-acciones">
        <PulsoButton
          variant="secondary"
          size="sm"
          aria-haspopup="dialog"
          onClick={() => navigate({ pathname: location.pathname, search: conNivel(location.search, "panel", PANEL_BITACORA_INTEGRACION.id) }, { replace: true })}
        >
          <ScrollText size={13} aria-hidden="true" />Bitácora de la integración
        </PulsoButton>
      </div>
    </div>
  );
}
