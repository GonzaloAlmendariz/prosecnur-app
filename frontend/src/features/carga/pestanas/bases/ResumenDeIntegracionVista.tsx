// "Cómo se unieron" de una base integrada (Carga › Bases, prototipo
// "carga-bases"): una tabla de hechos con la columna que distingue los orígenes,
// la fecha, los archivos de la integración y qué se decidió sobre fraseos y
// variables. Los orígenes van en "Fuentes de respuestas" y el formulario
// integrado en "Formulario": aquí no se repiten. La bitácora completa abre su panel.
//
// Lo que el prototipo dibuja y el motor no guarda (preguntas emparejadas de N,
// escalas recodificadas, preguntas en una sola fuente) queda fuera.

import { useLocation, useNavigate } from "react-router-dom";
import { NombreArchivo } from "../../../../components/entregables/NombreArchivo";
import { PulsoButton } from "../../../../components/PulsoButton";
import { conNivel } from "../../../../lib/navegacion/direccion";
import { formatoConteoDe } from "../../../../lib/formatoNumero";
import { ScrollText } from "../../../../vendor/lucide-react";
import { PANEL_BITACORA_INTEGRACION } from "../../panelesCarga";
import type { ResumenDeIntegracion } from "./integracionModel";

/** Los archivos de la integración menos el formulario integrado, que va en el bloque "Formulario". */
const ARCHIVOS_DE_LA_UNION = new Set(["Formulario guía", "Respuestas integradas"]);

export function ResumenDeIntegracionVista({ base, resumen }: {
  /** La base integrada: la bitácora la nombra en su `foco`, también cuando el inspector la muestra sin foco. */
  base: string;
  resumen: ResumenDeIntegracion;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const nFraseosPropios = resumen.fraseosPorOrigen.reduce((suma, g) => suma + g.entries.length, 0);
  return (
    <div className="pulso-bases-integracion">
      <dl className="pulso-bases-hechos">
        <div>
          <dt>Unidas por la columna</dt>
          <dd><code>{resumen.llave}</code></dd>
        </div>
        {resumen.fecha ? (
          <div>
            <dt>Integradas el</dt>
            <dd>{resumen.fecha}</dd>
          </div>
        ) : null}
        {resumen.archivos.filter((a) => ARCHIVOS_DE_LA_UNION.has(a.rotulo)).map((a) => (
          <div key={a.rotulo}>
            <dt>{a.rotulo}</dt>
            <dd><NombreArchivo nombre={a.archivo} /></dd>
          </div>
        ))}
        <div>
          <dt>Fraseo final común</dt>
          <dd>{formatoConteoDe(resumen.fraseoComun.length, "variable")}</dd>
        </div>
        <div>
          <dt>Fraseos propios por origen</dt>
          <dd>
            {formatoConteoDe(nFraseosPropios, "variable")}
            {resumen.fraseosPorOrigen.length
              ? ` (${resumen.fraseosPorOrigen.map((g) => `${g.origin}: ${g.entries.length}`).join(", ")})`
              : ""}
          </dd>
        </div>
        <div>
          <dt>Variantes preservadas</dt>
          <dd>{formatoConteoDe(resumen.nVariantes, "variante")} en {formatoConteoDe(resumen.variantes.length, "variable")}</dd>
        </div>
      </dl>
      <div className="pulso-bases-acciones">
        <PulsoButton
          variant="secondary"
          size="sm"
          aria-haspopup="dialog"
          onClick={() => navigate({ pathname: location.pathname, search: conNivel(conNivel(location.search, "foco", base), "panel", PANEL_BITACORA_INTEGRACION.id) }, { replace: true })}
        >
          <ScrollText size={13} aria-hidden="true" />Bitácora de la integración
        </PulsoButton>
      </div>
    </div>
  );
}
