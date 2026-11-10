import { CIUDADES, ciudadDeUbigeo } from "./ciudades";
import "./gruposPorCiudad.css";

export type GrupoCiudad<T> = { codigo: string; nombre: string; items: T[] };

const OTROS = "otros";

/**
 * Los distritos de una lista agrupados por su ciudad (revisión del 10 nov 2026, diseño nacional de 25 distritos en
 * 6 ciudades: Muestra, Población y Manzanas los mezclaban en una sola lista —«Alto Selva Alegre, Ancón, Arequipa,
 * Ate…»— y no se sabía de qué ciudad era cada uno). Dentro de cada grupo se respeta el orden de la lista; los grupos
 * van en el orden en que se eligieron sus ciudades (`orden`, los ubigeos del estudio) y, sin él, como aparecen.
 */
export function gruposPorCiudad<T>(items: readonly T[], ubigeoDe: (t: T) => string, orden: readonly string[] = []): GrupoCiudad<T>[] {
  const grupos = new Map<string, GrupoCiudad<T>>();
  for (const t of items) {
    const codigo = ciudadDeUbigeo(ubigeoDe(t)) ?? OTROS;
    const g = grupos.get(codigo) ?? { codigo, nombre: CIUDADES.find((c) => c.codigo === codigo)?.nombre ?? "Otros distritos", items: [] };
    g.items.push(t);
    grupos.set(codigo, g);
  }
  const primero = (g: GrupoCiudad<T>) => {
    const i = orden.findIndex((u) => (ciudadDeUbigeo(u) ?? OTROS) === g.codigo);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...grupos.values()].sort((a, b) => primero(a) - primero(b));
}

/** Cabecera de un grupo dentro de una lista de distritos: la ciudad y su subtotal. En una `<ul>` va como `<li>`. */
export function CabeceraCiudad({ nombre, resumen, como = "li" }: { nombre: string; resumen: string; como?: "li" | "div" }) {
  const Etiqueta = como;
  return (
    <Etiqueta className="hr-grupo-ciudad">
      <span>{nombre}</span>
      <small>{resumen}</small>
    </Etiqueta>
  );
}
