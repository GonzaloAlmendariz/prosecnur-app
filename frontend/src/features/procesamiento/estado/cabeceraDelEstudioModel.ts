// Estado y cifras de la cabecera de Estado del estudio (prototipo "estado":
// "En curso", bases, casos recibidos, bases listas para informe y bases
// desactualizadas). Todo sale de las filas de `basesDelEstudio` y, en bases
// independientes, de la aprobación para informe. Los grupos repetidos no
// cuentan como base ni suman respuestas: sus filas son instancias, no casos.

import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import type { EstadoDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { Aprobaciones } from "./aprobacionesModel";
import type { BasesDelEstudio, FilaDeBase } from "./basesDelEstudioModel";

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

function faseLograda(fila: FilaDeBase, fase: "carga" | "graficos"): boolean {
  return fila.fases?.find((f) => f.fase === fase)?.tono === "success";
}

function madres(bases: BasesDelEstudio): FilaDeBase[] {
  return bases.filas.filter((fila) => fila.madre === null);
}

/** El estado del estudio en palabra. `null` si alguna base no trae su estado: no se afirma nada. */
export function estadoDelEstudio(bases: BasesDelEstudio | null, aprobaciones: Aprobaciones | null): EstadoDePestana | null {
  if (!bases) return null;
  const lista = madres(bases);
  if (lista.length === 0) return { tono: "neutro", texto: "Sin bases" };
  if (lista.some((fila) => fila.fases === null)) return null;
  if (lista.some((fila) => !faseLograda(fila, "carga"))) return { tono: "atencion", texto: "Carga incompleta" };
  if (aprobaciones) {
    return aprobaciones.aprobadas === aprobaciones.total
      ? { tono: "listo", texto: "Aprobado para informe" }
      : { tono: "parcial", texto: "En curso" };
  }
  return lista.every((fila) => faseLograda(fila, "graficos"))
    ? { tono: "listo", texto: "Con informe" }
    : { tono: "parcial", texto: "En curso" };
}

export function cifrasDelEstudio(bases: BasesDelEstudio | null, aprobaciones: Aprobaciones | null): CifraDePestana[] {
  if (!bases || bases.filas.length === 0) return [];
  const lista = madres(bases);
  const cifras: CifraDePestana[] = [
    { clave: "bases", valor: formatoConteo(bases.nBases), rotulo: plural(bases.nBases, "base", "bases"), rango: 1 },
  ];
  if (bases.nGruposRepetidos > 0) {
    cifras.push({
      clave: "grupos-repetidos",
      valor: formatoConteo(bases.nGruposRepetidos),
      rotulo: plural(bases.nGruposRepetidos, "grupo repetido", "grupos repetidos"),
      rango: 3,
    });
  }
  // La suma solo vale si se conoce el tamaño de todas las bases; con una que falta no se publica.
  const tamanos = lista.map((fila) => fila.filas);
  if (tamanos.length > 0 && tamanos.every((n): n is number => n !== null)) {
    const total = tamanos.reduce((a, b) => a + b, 0);
    cifras.push({ clave: "respuestas", valor: formatoConteo(total), rotulo: plural(total, "respuesta", "respuestas"), rango: 1 });
  }
  if (aprobaciones) {
    cifras.push({
      clave: "aprobadas",
      valor: formatoConteo(aprobaciones.aprobadas),
      base: formatoConteo(aprobaciones.total),
      rotulo: plural(aprobaciones.aprobadas, "aprobada para informe", "aprobadas para informe"),
      tono: aprobaciones.aprobadas > 0 ? "ok" : "neutral",
      rango: 2,
    });
    if (aprobaciones.desactualizadas > 0) {
      cifras.push({
        clave: "desactualizadas",
        valor: formatoConteo(aprobaciones.desactualizadas),
        base: formatoConteo(aprobaciones.total),
        rotulo: plural(aprobaciones.desactualizadas, "aprobación desactualizada", "aprobaciones desactualizadas"),
        tono: "alerta",
        titulo: "Algún insumo cambió después de aprobar la base.",
        rango: 2,
      });
    }
    return cifras;
  }
  if (lista.length > 0 && lista.every((fila) => fila.fases !== null)) {
    const conInforme = lista.filter((fila) => faseLograda(fila, "graficos")).length;
    cifras.push({
      clave: "con-informe",
      valor: formatoConteo(conInforme),
      base: formatoConteo(lista.length),
      rotulo: "con informe",
      tono: conInforme > 0 ? "ok" : "neutral",
      titulo: "Bases con un informe generado en PowerPoint o en Word.",
      rango: 2,
    });
  }
  return cifras;
}

/** El hueco declarado de las cifras del prototipo que el motor no publica en este estudio. */
export function cifrasPendientesDelEstudio(aprobaciones: Aprobaciones | null): string | undefined {
  if (aprobaciones) return undefined;
  return "Bases aprobadas para informe y bases desactualizadas: el motor solo publica la aprobación en estudios de bases independientes y no publica si una fase quedó desactualizada (M8)";
}
