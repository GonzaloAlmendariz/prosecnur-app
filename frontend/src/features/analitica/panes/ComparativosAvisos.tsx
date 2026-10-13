// Avisos del resultado de un comparativo, agrupados por tipo (P-A4). Cada grupo
// es un plegable con su conteo («Sin variable · 66 preguntas»); el tono separa
// lo que cambia la lectura (advertencia) de lo esperado (informativo). Las
// omitidas tienen su propio bloque destacado antes que estos grupos.

import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, Info } from "../../../vendor/lucide-react";
import type { ComparativoAviso } from "../../../api/analitica";
import { accionParaAviso } from "./comparativosModel";
import { gruposDeAvisos, type GrupoDeAvisos } from "./comparativosAvisosModel";

export function ComparativosAvisos({ avisos }: { avisos: readonly ComparativoAviso[] }) {
  const grupos = gruposDeAvisos(avisos);
  if (!grupos.length) {
    return <p className="pulso-comparativos-sin-avisos">El motor no reportó otros avisos para este comparativo.</p>;
  }
  return (
    <section
      className="pulso-comparativos-avisos"
      aria-label="Avisos del comparativo"
      // Intrínseco: cada grupo mide lo que su encabezado o su lista abierta piden.
      data-qa-geometry-group="comparativos-avisos"
      data-qa-geometry-contract="intrinsic"
    >
      {grupos.map((grupo) => <GrupoAvisos key={grupo.clave} grupo={grupo} />)}
    </section>
  );
}

function GrupoAvisos({ grupo }: { grupo: GrupoDeAvisos }) {
  const advertencia = grupo.severidad === "advertencia";
  return (
    <details className={`pulso-comparativos-aviso-grupo is-${grupo.severidad}`} data-qa-geometry-member>
      <summary>
        <span className="pulso-comparativos-aviso-icono" aria-hidden="true">
          {advertencia ? <AlertTriangle size={14} /> : <Info size={14} />}
        </span>
        <span className="pulso-sr-only">{advertencia ? "Advertencia:" : "Informativo:"}</span>
        <span className="pulso-comparativos-aviso-tipo">{grupo.etiqueta}</span>
        <span className="pulso-comparativos-aviso-alcance">{grupo.alcance}</span>
        <ChevronDown size={14} className="pulso-comparativos-aviso-chevron" aria-hidden="true" />
      </summary>
      <ul className="pulso-comparativos-aviso-lista">
        {grupo.avisos.map((aviso, i) => {
          // Si el grupo comparte destino, el enlace va una sola vez al pie.
          const accion = grupo.accion ? null : accionParaAviso(aviso);
          return (
            <li key={`${grupo.clave}-${i}`}>
              <span className="pulso-comparativos-aviso-texto">{aviso.mensaje}</span>
              {accion ? (
                <Link className="pulso-comparativos-aviso-accion" to={accion.href}>{accion.etiqueta}</Link>
              ) : null}
            </li>
          );
        })}
      </ul>
      {grupo.accion ? (
        <Link className="pulso-comparativos-aviso-accion pulso-comparativos-aviso-accion--grupo" to={grupo.accion.href}>
          {grupo.accion.etiqueta}
        </Link>
      ) : null}
    </details>
  );
}
