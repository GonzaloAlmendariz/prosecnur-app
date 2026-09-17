import type { FocoDeCuota } from "./AulasCuotasResumen";

/**
 * El selector de facultad de la sección, para la cabecera.
 *
 * **Vivía dentro de un panel** —el de la serie de rendimiento— y eso le daba
 * dos defectos que Gonzalo nombró: se movía con el scroll, y sólo existía en la
 * pestaña que lo montaba, teniendo el perfil nueve listas de las mismas veinte
 * facultades. «El selector debería tener una vista privilegiada y permanente
 * arriba y que no se mueva, como el título y el icono».
 *
 * Al subirlo, los nombres de facultad de las tablas dejan de necesitar ser
 * botones: «no es necesario que sean botones cuando ya tenemos un selector
 * arriba que toma en cuenta o todas las facultades o una por una».
 *
 * El foco es una dimensión de la gramática de navegación y viaja en la URL, así
 * que este componente no guarda estado: lee `valor` y avisa por `onFoco`.
 */
export function AulasSelectorDeFacultad({ facultades, valor, onFoco, ejeClave = "facultad" }: {
  /** Las facultades del estudio, ya ordenadas por quien las conoce. */
  facultades: ReadonlyArray<string>;
  /** La que está en foco, o cadena vacía para «todas». */
  valor: string;
  onFoco: (foco: FocoDeCuota) => void;
  /**
   * La clave del eje de cuotas del estudio (`avance_cuota.eje.clave`).
   *
   * El foco se ESCRIBE con ella, no con un literal: así HSVG sigue poniendo
   * `facultad:` en sus enlaces byte a byte y un estudio por nivel pone `nivel:`.
   * Por defecto `facultad`, que es lo que era.
   */
  ejeClave?: string;
}) {
  if (!facultades.length) return null;
  const poner = (v: string) => onFoco(v ? { tipo: ejeClave as NonNullable<FocoDeCuota>["tipo"], valor: v } : null);
  // El paso circular: desde la última, «siguiente» vuelve a la primera. Sin eso
  // el recorrido se acaba y hay que volver al desplegable para seguir.
  const mover = (paso: number) => {
    const i = facultades.indexOf(valor);
    if (i < 0) return poner(facultades[paso > 0 ? 0 : facultades.length - 1]);
    const siguiente = (i + paso + facultades.length) % facultades.length;
    poner(facultades[siguiente]);
  };
  return (
    <div className="aulas-serie-mando" role="group" aria-label="Facultad en foco">
      <button type="button" className={valor ? "" : "is-activa"} onClick={() => poner("")}>
        Todas
      </button>
      <button type="button" aria-label="Facultad anterior" onClick={() => mover(-1)}>‹</button>
      <select value={valor} onChange={(e) => poner(e.currentTarget.value)} aria-label="Facultad">
        <option value="">Todas las facultades</option>
        {facultades.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <button type="button" aria-label="Facultad siguiente" onClick={() => mover(1)}>›</button>
    </div>
  );
}
