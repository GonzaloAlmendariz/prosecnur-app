// «Gráficos con regla propia» bajo una regla del informe (R5 del rediseño, 2026-10-15): cada gráfico que se aparta, con
// su lámina, su título, cómo se aparta y «Ver lámina», que abre esa lámina en Láminas donde se cambia (su tarjeta).

import { useLocation, useNavigate } from "react-router-dom";
import { conNivel } from "../../../lib/navegacion/direccion";
import { searchConNivel } from "../../../lib/navegacion/useDireccion";
import type { Excepcion } from "./excepcionesPlan";

export function ExcepcionesRegla({ excepciones, ayuda }: { excepciones: readonly Excepcion[]; ayuda: string }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const ver = (id: string) => navigate({ pathname: loc.pathname, search: conNivel(searchConNivel(loc.search, "pestana", "laminas"), "foco", id) });
  return (
    <details className="pulso-f6-regla-tipos">
      <summary>
        Gráficos con regla propia
        <span className={`pulso-f6-regla-pill${excepciones.length ? " is-propia" : ""}`}>{excepciones.length || "ninguno"}</span>
      </summary>
      {excepciones.length ? (
        <ul className="pulso-f6-excepciones">
          {excepciones.map((e) => (
            <li key={`${e.slideId}-${e.slot}`}>
              <span className="pulso-f6-excepcion-pos">L{e.posicion}</span>
              <span className="pulso-f6-excepcion-titulo">{e.titulo}</span>
              <span className="pulso-f6-excepcion-valor">{e.valor}</span>
              <button type="button" className="pulso-f6-excepcion-ver" onClick={() => ver(e.slideId)}>Ver lámina</button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="pulso-f6-informe-ayuda">{ayuda}</p>
    </details>
  );
}
