import type { ReactNode } from "react";
import { X } from "../../../../vendor/lucide-react";
import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { nombreDistrito } from "../nombres";

/**
 * Ficha del distrito al que se bajó en la vista nacional: dónde está, su tamaño y la cifra de la sección
 * (entrevistas, población objetivo o UMP). Flota bajo la miga y no toca el inspector, que sigue diciendo
 * lo de la sección entera.
 */
export function FichaDistritoNacional({ territorio, ciudad, linea, marca, previa, onCerrar }: {
  territorio: Pick<HojasRutaTerritory, "ubigeo" | "distrito" | "provincia" | "poblacion" | "viviendas" | "manzanas">;
  ciudad: string;
  /** La cifra de la sección para este distrito, ya redactada; null si la sección aún no la tiene. */
  linea: string | null;
  /** Color que acompaña la línea (el del NSE en el mapa), para leerla junto con la leyenda. */
  marca?: string;
  /** Una línea antes de la de la sección (la densidad del distrito en el atlas). */
  previa?: ReactNode;
  onCerrar: () => void;
}) {
  const nombre = nombreDistrito(territorio.distrito);
  return (
    <section className="hr-ter-ficha hr-nac-ficha" aria-label={`Ficha de ${nombre}`}>
      <header className="hr-ter-ficha-cab">
        <div>
          <strong>{nombre}</strong>
          <small>{ciudad}, {territorio.ubigeo}</small>
        </div>
        <button type="button" className="hr-ter-cerrar" aria-label="Cerrar la ficha" onClick={onCerrar}><X size={14} /></button>
      </header>
      <dl className="hr-ter-ficha-cifras">
        <div><dt>Población</dt><dd>{formatoConteo(territorio.poblacion)}</dd></div>
        <div><dt>Viviendas</dt><dd>{formatoConteo(territorio.viviendas)}</dd></div>
        <div><dt>Manzanas</dt><dd>{formatoConteo(territorio.manzanas)}</dd></div>
      </dl>
      {previa ? <p className="hr-ter-ficha-nota hr-nac-ficha-previa">{previa}</p> : null}
      {linea ? <p className="hr-ter-ficha-nota">{marca ? <i className="hr-nac-ficha-marca" style={{ background: marca }} aria-hidden="true" /> : null}{linea}</p> : null}
    </section>
  );
}
