import type { OpcionDeEslabon } from "./eslabonDeLaAgenda";

import "./aulasEslabon.css";

/**
 * El desplegable «Eslabón» de la tabla de la Agenda (B27).
 *
 * Vive en la cabecera del PANEL «Aulas agendadas», no en la del workbench:
 * manda sobre esta tabla, mientras el selector de facultad manda sobre la
 * sección entera. Ponerlo junto a aquél le daría un alcance que no tiene.
 *
 * El estado tampoco viaja en la dirección, y es una decisión: el eslabón no es
 * un panel (no hay overlay que enlazar con `usePanelDireccionable`) ni un
 * `foco` (no identifica una entidad), y abrirle un parámetro nuevo a la
 * gramática por una lente de tabla no tiene precedente barato. Vive como
 * estado local de la sección, que es quien pinta la tabla.
 *
 * Cada opción lleva su cuenta para elegir sin adivinar cuáles eslabones tienen
 * filas. Sin reservas en el plan no hay nada que conmutar y no se pinta —el
 * mismo criterio que `AulasSelectorDeFacultad` sin facultades—.
 *
 * El nombre accesible es el rótulo visible: `<label>` envolvente, sin un
 * aria-label que diga otra cosa que lo que se ve.
 */
export function AulasSelectorDeEslabon({ opciones, valor, onCambio }: {
  opciones: ReadonlyArray<OpcionDeEslabon>;
  /** El eslabón en vista: `0` titulares, `k >= 1` reemplazo k. */
  valor: number;
  onCambio: (eslabon: number) => void;
}) {
  if (opciones.length <= 1) return null;
  return (
    <label className="aulas-eslabon-mando">
      Eslabón
      <select
        value={String(valor)}
        onChange={(e) => onCambio(Number(e.currentTarget.value))}
      >
        {opciones.map((o) => (
          <option key={o.eslabon} value={String(o.eslabon)}>
            {o.etiqueta} · {o.cursos.toLocaleString("es-PE")}
          </option>
        ))}
      </select>
    </label>
  );
}
