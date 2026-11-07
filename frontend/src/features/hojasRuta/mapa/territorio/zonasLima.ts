import type { ContornoDistrito } from "../lienzo/capas";

/**
 * Atajos de Territorio: las zonas de Lima en la agrupación usual de las
 * encuestadoras. Se arman por nombre sobre la cobertura (los ubigeos salen de
 * ahí); Callao es la provincia entera.
 */
const POR_NOMBRE: ReadonlyArray<readonly [string, string, readonly string[]]> = [
  ["norte", "Norte", ["ANCON", "CARABAYLLO", "COMAS", "INDEPENDENCIA", "LOS OLIVOS", "PUENTE PIEDRA", "SAN MARTIN DE PORRES", "SANTA ROSA"]],
  ["este", "Este", ["ATE", "CHACLACAYO", "CIENEGUILLA", "EL AGUSTINO", "LURIGANCHO", "SAN JUAN DE LURIGANCHO", "SANTA ANITA"]],
  ["sur", "Sur", ["CHORRILLOS", "LURIN", "PACHACAMAC", "PUCUSANA", "PUNTA HERMOSA", "PUNTA NEGRA", "SAN BARTOLO", "SAN JUAN DE MIRAFLORES", "SANTA MARIA DEL MAR", "VILLA EL SALVADOR", "VILLA MARIA DEL TRIUNFO"]],
  ["centro", "Centro", ["BREÑA", "LA VICTORIA", "LIMA", "RIMAC", "SAN LUIS"]],
  ["moderna", "Moderna", ["BARRANCO", "JESUS MARIA", "LA MOLINA", "LINCE", "MAGDALENA DEL MAR", "MIRAFLORES", "PUEBLO LIBRE", "SAN BORJA", "SAN ISIDRO", "SAN MIGUEL", "SANTIAGO DE SURCO", "SURQUILLO"]],
];

export type ZonaLima = { id: string; etiqueta: string; ubigeos: string[] };

export function zonasDeLima(contornos: readonly ContornoDistrito[]): ZonaLima[] {
  const porNombre = new Map(contornos.map((c) => [c.nombre, c.ubigeo]));
  const zonas = POR_NOMBRE.map(([id, etiqueta, nombres]) => ({ id, etiqueta, ubigeos: nombres.map((n) => porNombre.get(n)).filter((u): u is string => Boolean(u)) }));
  return [...zonas, { id: "callao", etiqueta: "Callao", ubigeos: contornos.filter((c) => c.provincia === "CALLAO").map((c) => c.ubigeo) }];
}
