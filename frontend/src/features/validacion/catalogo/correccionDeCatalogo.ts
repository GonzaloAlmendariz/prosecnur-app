/**
 * Arma la corrección de una combinación fuera de catálogo: un valor por
 * columna de papel (departamento, provincia, distrito, ubigeo) a partir del
 * candidato del motor o del lugar elegido en el selector. Solo calcula; la
 * persona confirma y la decisión por columna la guarda quien lo monta.
 */
import { PAPELES_DE_CATALOGO, type PapelDeCatalogo } from "../../../api/catalogoUbigeo";

/** Columna de la base que cumple cada papel en la regla; `null` si la regla no lo usa. */
export type ColumnasPorPapel = Readonly<Record<PapelDeCatalogo, string | null>>;

/** Un lugar, completo hasta su nivel; los niveles de abajo vienen `null`. */
export type LugarACorregir = Readonly<Record<PapelDeCatalogo, string | null>>;

export type ValorACorregir = { columna: string; valor: string };

export function correccionDeLugar(lugar: LugarACorregir, columnas: ColumnasPorPapel): ValorACorregir[] {
  const salida: ValorACorregir[] = [];
  for (const papel of PAPELES_DE_CATALOGO) {
    const columna = columnas[papel];
    const valor = lugar[papel];
    if (columna && valor && valor.trim()) salida.push({ columna, valor: valor.trim() });
  }
  return salida;
}
