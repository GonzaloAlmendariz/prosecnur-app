import { formatoConteo } from "../../../../lib/formatoNumero";

/** El alcance del estudio para la barra: dos ciudades con coma (una ya lleva «y»: «Lima y Callao, Arequipa»); más, la primera y cuántas siguen. */
export function alcanceEstudio(ciudades: readonly string[], distritos: number): string {
  if (!ciudades.length) return distritos ? `${formatoConteo(distritos)} distritos` : "Por elegir";
  if (ciudades.length > 2) return `${ciudades[0]} y ${ciudades.length - 1} ciudades más`;
  return ciudades.length === 2 ? `${ciudades[0]}, ${ciudades[1]}` : ciudades[0];
}

/** Si una sección quedó lista (✓ en la barra): lo que la sección entrega existe y está vigente. */
export function seccionLista(id: string, e: { distritos: number; matriz: boolean; tamano: boolean; sorteo: boolean; enviado: boolean }): boolean {
  switch (id) {
    case "territorio": return e.distritos > 0;
    case "poblacion": return e.matriz;
    case "muestra": return e.tamano;
    case "manzanas": return e.sorteo;
    case "seleccion": return e.enviado;
    default: return false;
  }
}
