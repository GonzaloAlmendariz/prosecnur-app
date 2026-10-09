import type { ReactNode } from "react";

import "./aulasCargaDeCampo.css";
import "./aulasMetas.css";

/**
 * Un mando segmentado de la pestaña «Metas».
 *
 * **Reusa `.aulas-carga-eje`**, el segmentado que este perfil ya tiene en Carga
 * de campo —pastilla flotante sobre riel tenue, tokens `--pulso-*`—, y por eso
 * importa su hoja: dos segmentados con la misma función y distinto aspecto son
 * la misma trampa de las dos expresiones, en CSS.
 *
 * Los dos mandos de la pestaña son alternativas excluyentes —una meta O la
 * otra, una tasa O la otra— y el control tiene que decirlo; por eso segmentado
 * y no dos botones sueltos.
 *
 * Sin estado propio: el valor y el cambio vienen de arriba, porque los dos
 * mandos deciden qué combinación se lee del payload y esa decisión es de la
 * pestaña entera, no de un control.
 */
export function AulasMetasMandos<T extends string>({
  rotulo, opciones, valor, onCambio,
}: {
  rotulo: string;
  /** `[valor, rótulo, ayuda]`. La ayuda va al `title`, como el resto del perfil. */
  opciones: ReadonlyArray<readonly [T, string, string]>;
  valor: T;
  onCambio: (valor: T) => void;
}): ReactNode {
  return (
    <div className="aulas-metas-mando">
      <span className="aulas-metas-mando-rotulo">{rotulo}</span>
      <div className="aulas-carga-eje" role="group" aria-label={rotulo}>
        {opciones.map(([v, texto, ayuda]) => (
          <button
            key={v}
            type="button"
            className={valor === v ? "es-activo" : ""}
            aria-pressed={valor === v}
            title={ayuda}
            onClick={() => onCambio(v)}
          >
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}
