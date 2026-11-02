import type { ReactNode } from "react";

/**
 * E3 — una sola barra de lectura: Momento | Filtro | Cruzar por. Cada grupo
 * se rotula con su eyebrow; en pantallas angostas la barra envuelve (y los
 * separadores se esconden) en vez de recortar.
 */
export default function BarraLectura({
  momento,
  filtro,
  cruce,
}: {
  momento: ReactNode;
  filtro: ReactNode;
  cruce: ReactNode;
}) {
  return (
    <section className="vx-tarjeta vx-barra" aria-label="Lente de lectura">
      <div className="vx-barra-grupo">
        <span className="vx-eyebrow">Momento</span>
        {momento}
      </div>
      <span className="vx-barra-sep" aria-hidden />
      <div className="vx-barra-grupo is-filtro">
        <span className="vx-eyebrow">Filtro</span>
        {filtro}
      </div>
      <span className="vx-barra-sep" aria-hidden />
      <div className="vx-barra-grupo">
        <span className="vx-eyebrow">Cruzar por</span>
        {cruce}
      </div>
    </section>
  );
}
