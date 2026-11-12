import type { ReactNode } from "react";

/**
 * E3: la barra de lectura del prototipo. "Cruzar por" y "Filtros", cada uno con
 * su rótulo encima, y a la derecha los conmutadores de la distribución cuando
 * aplican. En pantallas angostas la barra envuelve en vez de recortar.
 */
export default function BarraLectura({
  cruce,
  filtro,
  conmutadores = null,
}: {
  cruce: ReactNode;
  filtro: ReactNode;
  conmutadores?: ReactNode;
}) {
  return (
    <section className="vx-tarjeta vx-barra" aria-label="Lectura de la pregunta" data-qa-geometry-group="validacion/explorar-lente" data-qa-geometry-contract="intrinsic">
      <div className="vx-barra-grupo">
        <span className="vx-eyebrow">Cruzar por</span>
        <div className="vx-barra-controles">{cruce}</div>
      </div>
      <div className="vx-barra-grupo is-filtro">
        <span className="vx-eyebrow">Filtros</span>
        <div className="vx-barra-controles">{filtro}</div>
      </div>
      {conmutadores && <div className="vx-barra-conmutadores">{conmutadores}</div>}
    </section>
  );
}
