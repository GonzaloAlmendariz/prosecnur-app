import { Check } from "../../../../vendor/lucide-react";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { ClaveDeComprobacion, Comprobacion } from "./comprobacionesModel";

/**
 * Las comprobaciones de la base revisada (prototipo "carga-revision", columna
 * izquierda): cada una con su punto de estado, su nombre, lo que encontró y,
 * si pide una decisión, cuántas cosas faltan. Elegir una abre su detalle en el
 * centro. Las declaraciones opcionales (universo, base preparada fuera) van en
 * un segundo grupo y no se juzgan.
 */
export function ListaDeComprobaciones({
  comprobaciones,
  elegida,
  onElegir,
  idDetalle,
}: {
  comprobaciones: readonly Comprobacion[];
  elegida: ClaveDeComprobacion | null;
  onElegir: (clave: ClaveDeComprobacion) => void;
  /** El contenedor del detalle que controla cada botón. */
  idDetalle: string;
}) {
  const grupos: { clave: "comprobacion" | "declaracion"; titulo: string | null }[] = [
    { clave: "comprobacion", titulo: null },
    { clave: "declaracion", titulo: "Declaraciones de la base" },
  ];
  return (
    <div className="pulso-revision-lista-marco">
      {grupos.map((grupo) => {
        const items = comprobaciones.filter((c) => c.grupo === grupo.clave);
        if (items.length === 0) return null;
        return (
          <div key={grupo.clave} className="pulso-revision-grupo">
            {grupo.titulo ? <h3 className="pulso-revision-grupo-titulo">{grupo.titulo}</h3> : null}
            <ul
              className="pulso-revision-lista"
              aria-label={grupo.titulo ?? "Comprobaciones de la base"}
              // C1: cada fila mide lo que piden su nombre y su detalle.
              data-qa-geometry-group={`carga/revision-${grupo.clave}`}
              data-qa-geometry-contract="intrinsic"
            >
              {items.map((c) => (
                <li key={c.clave}>
                  <button
                    type="button"
                    className="pulso-revision-item"
                    data-tono={c.tono}
                    aria-pressed={elegida === c.clave}
                    aria-controls={idDetalle}
                    onClick={() => onElegir(c.clave)}
                  >
                    <span className="pulso-revision-item-punto" aria-hidden="true">
                      {c.tono === "ok" ? <Check size={12} /> : null}
                    </span>
                    <span className="pulso-revision-item-texto">
                      <b>{c.titulo}</b>
                      <span>{c.detalle}</span>
                    </span>
                    {c.pendientes !== undefined ? (
                      <span className="pulso-revision-item-pendientes" aria-label={`${formatoConteo(c.pendientes)} por decidir`}>
                        {formatoConteo(c.pendientes)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
