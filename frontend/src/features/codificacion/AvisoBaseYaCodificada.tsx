// Lo que Adaptar muestra en lugar de «Confirmar y adaptar» cuando la base viene
// ya codificada (ADR 0106, punto 3): una línea y el camino para cambiarlo.

import { Link, useInRouterContext } from "react-router-dom";
import { Info } from "../../vendor/lucide-react";
import { hrefVariablesBase } from "../carga/variablesBase/variablesBaseModel";

export function AvisoBaseYaCodificada({ base }: { base: string }) {
  const enRouter = useInRouterContext();
  return (
    <p className="pulso-codif-ya-codificada" role="status" data-testid="codificacion-base-ya-codificada">
      <Info size={14} aria-hidden="true" />
      <span>«{base}» ya viene codificada: aquí no se vuelve a codificar.</span>
      {enRouter && <Link to={hrefVariablesBase(base)}>Cambiar en Carga</Link>}
    </p>
  );
}
