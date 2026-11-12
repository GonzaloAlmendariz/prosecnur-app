// "Se construye con" (prototipo, Analítica › Entrega): de qué depende el libro y
// dónde se cambia cada cosa. Solo lo que la app sabe hoy: la versión de la base,
// los casos que cuentan, las variables incluidas en Datos y las listas con
// orden propio. La versión de la base y los casos llevan su control al lado.

import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { conNivel } from "../../../lib/navegacion/direccion";
import { Workflow } from "../../../vendor/lucide-react";

export type Dependencia = {
  clave: string;
  titulo: string;
  detalle: ReactNode;
  /** La pestaña de Analítica donde se cambia. */
  pestana?: string;
};

/** La misma dirección con otra pestaña de Analítica, sin el foco ni el panel de esta. */
function aPestana(search: string, pestana: string): string {
  return conNivel(conNivel(conNivel(search, "pestana", pestana), "foco", null), "panel", null);
}

export function SeConstruyeCon({ dependencias }: { dependencias: readonly Dependencia[] }) {
  const location = useLocation();
  return (
    <PanelDeMesa zona="dependencias" titulo="Se construye con" icono={<Workflow size={16} aria-hidden="true" />}>
      <ul className="libro-deps">
        {dependencias.map((d) => (
          <li key={d.clave}>
            <span className="libro-deps-punto" aria-hidden="true" />
            <div>
              <b>{d.titulo}</b>
              {typeof d.detalle === "string" ? <span>{d.detalle}</span> : <div className="libro-deps-control">{d.detalle}</div>}
            </div>
            {d.pestana ? (
              <Link className="libro-deps-ir" to={{ pathname: location.pathname, search: aPestana(location.search, d.pestana) }} aria-label={`Abrir ${d.titulo}`}>
                Abrir
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </PanelDeMesa>
  );
}
