import { MapPinned } from "../../../../vendor/lucide-react";
import type { NivelMapa } from "./vistaNacional";

type Opcion = { codigo: string; nombre: string };

/**
 * Miga de la vista nacional: Perú › ciudad › distrito, cada nivel clicable para subir. En la ciudad, el
 * distrito se elige con un desplegable (en Manzanas y Selección el clic del mapa ya es de las manzanas,
 * así que el distrito tiene que poder alcanzarse por aquí, C4).
 */
export function MigaNacional({ nivel, ciudades, distritos, ump, onPeru, onCiudad, onDistrito }: {
  nivel: NivelMapa;
  ciudades: readonly Opcion[];
  /** Distritos del estudio en la ciudad a la que se bajó. */
  distritos: readonly Opcion[];
  /** La UMP enfocada en Selección, si hay. */
  ump?: string | null;
  onPeru: () => void;
  onCiudad: (codigo: string) => void;
  onDistrito: (ubigeo: string | null) => void;
}) {
  const icono = <MapPinned size={14} aria-hidden="true" />;
  if (nivel.nivel === "nacional") {
    return (
      <span className="hr-miga-nacional">
        {icono} <b>Perú</b>
        {ump ? <span>, {ump}</span> : <span className="hr-lienzo-miga-ayuda">({ciudades.length} ciudades del estudio; clic en una para verla)</span>}
      </span>
    );
  }
  const ciudad = ciudades.find((c) => c.codigo === nivel.ciudad);
  const distrito = nivel.nivel === "distrito" ? distritos.find((d) => d.codigo === nivel.distrito) : undefined;
  return (
    <span className="hr-miga-nacional">
      {icono}
      <button type="button" className="hr-miga-nivel" onClick={onPeru}>Perú</button>
      <span aria-hidden="true">›</span>
      {distrito ? <button type="button" className="hr-miga-nivel" onClick={() => onCiudad(nivel.ciudad)}>{ciudad?.nombre ?? nivel.ciudad}</button> : <b>{ciudad?.nombre ?? nivel.ciudad}</b>}
      <span aria-hidden="true">›</span>
      <select
        className="hr-miga-distrito"
        aria-label={`Distrito de ${ciudad?.nombre ?? "la ciudad"}`}
        value={distrito?.codigo ?? ""}
        onChange={(e) => onDistrito(e.target.value || null)}
      >
        <option value="">{distritos.length === 1 ? "1 distrito" : `${distritos.length} distritos`}</option>
        {distritos.map((d) => <option key={d.codigo} value={d.codigo}>{d.nombre}</option>)}
      </select>
      {ump ? <span>, {ump}</span> : null}
    </span>
  );
}
