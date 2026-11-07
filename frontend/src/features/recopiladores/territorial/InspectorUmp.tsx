// Territorial › Unidades: el inspector de la UMP enfocada (revamp v5). Lo que el
// analista necesita para resolverla sin salir de la lista: sus datos, su reemplazo
// y la acción que corresponde. `foco=<id_manzana>` lo abre; la ficha completa sigue
// siendo el diálogo de `panel=hoja`.
//
// Contrato de Superficie: C1 `material-campo/territorial/inspector` (intrinsic);
// C3: el cuerpo es dueño de su alto y de su scroll.

import { Link } from "react-router-dom";

import type { UnidadTerritorial } from "../../../api/materialTerritorial";
import { X } from "../../../vendor/lucide-react";
import type { EstadoUnidad } from "./revisionUnidades";
import { HREF_REENVIO } from "./rutasTerritoriales";
import "./unidades.css";

type Props = {
  unidad: UnidadTerritorial;
  reemplazos: readonly UnidadTerritorial[];
  estado: EstadoUnidad | undefined;
  encuestador: string | null;
  hrefCerrar: string;
  hrefFicha: string;
  hrefReemplazo: string;
};

const cifra = (n: number | null) => (n === null ? "sin dato" : n.toLocaleString("es-PE"));

export function InspectorUmp({ unidad, reemplazos, estado, encuestador, hrefCerrar, hrefFicha, hrefReemplazo }: Props) {
  const conAviso = estado && estado.tono !== "ok";
  const encuestas = unidad.rango_inicio !== null && unidad.rango_fin !== null
    ? `${unidad.rango_fin - unidad.rango_inicio + 1} (de la ${unidad.rango_inicio} a la ${unidad.rango_fin})`
    : "sin dato";
  return (
    <aside
      className="rec-terr-inspector"
      aria-label={`Detalle de ${unidad.label}`}
      data-qa-geometry-group="material-campo/territorial/inspector"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="rec-terr-inspector-cabeza">
        <span>
          <small>{unidad.distrito}</small>
          <h3>
            {unidad.label}
            {conAviso && estado?.motivo ? <span className="rec-terr-estado" data-estado={estado.tono}>{estado.motivo}</span> : null}
          </h3>
        </span>
        <Link className="rec-terr-inspector-cerrar" to={hrefCerrar} aria-label="Cerrar el detalle">
          <X size={16} aria-hidden />
        </Link>
      </header>
      <div className="rec-terr-inspector-cuerpo" data-qa-geometry-capacity="owned">
        <dl className="rec-terr-inspector-datos">
          <dt>Zona y manzana</dt><dd>{[unidad.zona, unidad.manzana].filter(Boolean).join(", ") || "sin dato"}</dd>
          <dt>Encuestas</dt><dd>{encuestas}</dd>
          <dt>Viviendas</dt><dd>{cifra(unidad.viviendas)}</dd>
          {unidad.role === "titular" ? <><dt>Encuestador</dt><dd>{encuestador ?? "Sin asignar"}</dd></> : null}
        </dl>
        {reemplazos.length ? (
          <section className="rec-terr-inspector-reemplazo" aria-label="Su reemplazo">
            <small>{reemplazos.length === 1 ? "Su reemplazo" : "Sus reemplazos"}</small>
            {reemplazos.map((r) => (
              <p key={r.unit_id}>
                <b>{r.label}: zona {r.zona || "sin dato"}, manzana {r.manzana || "sin dato"}</b>
                <span>{cifra(r.viviendas)} viviendas, sorteado con la muestra</span>
              </p>
            ))}
          </section>
        ) : null}
      </div>
      <footer className="rec-terr-inspector-pie">
        {unidad.role === "titular" ? (
          <Link className="pulso-button pulso-button--primary pulso-button--md rec-terr-inspector-principal" to={hrefReemplazo}>Pedir un reemplazo puntual</Link>
        ) : null}
        <span className="rec-terr-inspector-secundarias">
          <Link className="pulso-button pulso-button--secondary pulso-button--sm" to={hrefFicha}>Abrir la ficha</Link>
          <Link className="pulso-button pulso-button--ghost pulso-button--sm" to={HREF_REENVIO}>Ver en Hojas de ruta</Link>
        </span>
      </footer>
    </aside>
  );
}
