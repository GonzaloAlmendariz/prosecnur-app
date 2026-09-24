import { Link, useLocation } from "react-router-dom";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida, CalcMuestraGeneralMarco } from "../../../api/calcMuestraGeneral";
import { hrefSeleccionDeActor } from "./ActoresAcreditacion";
import { BandaDiseno } from "./BandaDiseno";
import { cifrasDisenoAcreditacion, etiquetaFichaActor, FASE_ACTOR_ETIQUETA } from "./bandaDisenoModelo";

/**
 * Acreditación: totales del estudio y, debajo, una ficha por actor con su
 * fase. Cada ficha enlaza con la Selección de ese actor (`foco`), que es donde
 * se sigue trabajando con él.
 *
 * La cadena, la tarjeta «Sorteados» y las fichas cuentan el sorteo con la
 * misma definición (`vigenciaSorteo`): una corrida vieja no suma como
 * sorteada en un sitio y como pendiente en otro.
 *
 * En Actores las fichas no se pintan: repiten la tabla que está debajo.
 */
export function BandaDisenoAcreditacion({
  componentes,
  corridas,
  marcos,
  seccion,
}: {
  componentes: readonly CalcMuestraComponente[];
  corridas: Readonly<Record<string, CalcMuestraGeneralCorrida>>;
  marcos?: Readonly<Record<string, CalcMuestraGeneralMarco>>;
  seccion: string;
}) {
  const location = useLocation();
  const { totales, actores, cadena } = cifrasDisenoAcreditacion({ componentes, corridas, marcos });
  const conFichas = actores.length > 0 && seccion !== "actores";

  return (
    <BandaDiseno grupo="calc-muestra/acreditacion-diseno-vigente" cadena={cadena} cifras={totales}>
      {conFichas && (
        <ul
          className="cmg-banda-actores"
          aria-label="Actores del estudio"
          data-qa-geometry-group="calc-muestra/acreditacion-banda-actores"
          data-qa-geometry-contract="equal"
        >
          {actores.map((a) => (
            <li key={a.id} className="cmg-banda-actor" data-fase={a.fase}>
              <Link
                to={hrefSeleccionDeActor(location.pathname, location.search, a.id)}
                className="cmg-banda-actor-enlace"
                aria-label={etiquetaFichaActor(a)}
              >
                <span className="cmg-banda-actor-nombre" title={a.nombre}>{a.nombre}</span>
                <span className="cmg-banda-actor-fase">{FASE_ACTOR_ETIQUETA[a.fase]}</span>
                <span className="cmg-banda-actor-resumen" title={a.resumen}>{a.resumen}</span>
                <span className="cmg-banda-actor-tecnica" title={a.tecnica}>{a.tecnica}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BandaDiseno>
  );
}
