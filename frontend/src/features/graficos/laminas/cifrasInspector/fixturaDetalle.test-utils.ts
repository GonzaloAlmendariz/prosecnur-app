// Detalles de cifras de prueba (la forma de normalizarDetalleCifras), para los tests del inspector.
import type { DetalleCifras, FilaDetalle, LadosDetalle } from "../../../../api/graficosCifras";

type Cat = { clave: string; valor: number; especial?: boolean; lado?: "neg" | "neu" | "pos" | "sin_inf" };

export function fila(clave: string, cats: readonly Cat[], extra: Partial<FilaDetalle> = {}, n = 412): FilaDetalle {
  return {
    clave, rotulo: clave, esTotal: false, base: { nPonderado: n, nCasos: n },
    valores: cats.map((c) => ({ categoria: c.clave, texto: `${c.valor}%`, valor: c.valor, proporcion: c.valor / 100 })),
    sumas: null, caja: null, lados: null, ...extra,
  };
}

export function detalle(cats: readonly Cat[], opciones: { n?: number; filas?: FilaDetalle[]; forma?: DetalleCifras["forma"]; decimales?: number } = {}): DetalleCifras {
  const n = opciones.n ?? 412;
  return {
    forma: opciones.forma ?? "categorica", version: "categorica/1",
    base: { nPonderado: n, nCasos: n, texto: `Base: ${n}` },
    redondeo: { metodo: "estandar", decimales: opciones.decimales ?? 0 },
    categorias: cats.map((c) => ({ clave: c.clave, rotulo: c.clave, especial: !!c.especial, lado: c.lado ?? null })),
    filas: opciones.filas ?? [fila("total", cats, {}, n)],
  };
}

export const cifra = (valor: number) => ({ valor, texto: `${valor}%` });

export function lados(neg: number, neu: number, pos: number, sinInf = 0): LadosDetalle {
  return { negativo: cifra(neg), neutro: cifra(neu), positivo: cifra(pos), sinInformacion: cifra(sinInf) };
}
