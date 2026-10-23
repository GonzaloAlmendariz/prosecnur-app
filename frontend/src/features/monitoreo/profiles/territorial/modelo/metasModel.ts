import type { MonitoreoTerritorialDashboard, TerritorialBlockProgress } from "../../../../../api/client";
import { fmt, nombreDeDistrito } from "../rotulos";

/**
 * Modelo › Metas y muestra (territorial.md §3.5): qué hay que lograr. La meta
 * por distrito, con las UMP, los reemplazos y el tamaño de las manzanas
 * titulares, y cómo se arma la muestra. Se LEE aquí; se edita en Hojas de ruta.
 */

export type FilaDeMeta = {
  distrito: string;
  meta: number;
  umps: number;
  reemplazos: number;
  porUmp: string;
  viviendas: number | null;
  poblacion: number | null;
};

export type ComoSeArma = { clave: string; texto: string };

export type ModeloMetas = {
  disponible: boolean;
  distritos: FilaDeMeta[];
  total: FilaDeMeta;
  comoSeArma: ComoSeArma[];
  bloques: TerritorialBlockProgress[];
};

function n(valor: unknown): number | null {
  const numero = Number(valor);
  return valor != null && valor !== "" && Number.isFinite(numero) ? numero : null;
}

function esReemplazo(bloque: TerritorialBlockProgress): boolean {
  return String(bloque.tipo_manzana ?? "").trim().toLowerCase() === "reemplazo";
}

function moda(valores: number[]): number | null {
  if (!valores.length) return null;
  const conteo = new Map<number, number>();
  for (const valor of valores) conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
  return [...conteo.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

function modaDeTexto(valores: string[]): string {
  const conteo = new Map<string, number>();
  for (const valor of valores) if (valor) conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
  return [...conteo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
}

function suma(valores: Array<number | null>): number | null {
  const conDato = valores.filter((valor): valor is number => valor != null);
  return conDato.length ? conDato.reduce((total, valor) => total + valor, 0) : null;
}

const METODOS: Record<string, string> = {
  pps: "PPS (probabilidad proporcional al tamaño) por territorio muestral",
  srs: "Muestreo aleatorio simple por territorio muestral",
  sistematico: "Muestreo sistemático por territorio muestral",
};

export function construirMetas(reports: MonitoreoTerritorialDashboard | null | undefined): ModeloMetas {
  const bloques = reports?.route_blocks ?? [];
  const metaPorDistrito = new Map((reports?.advance?.district_progress ?? []).map((fila) => [nombreDeDistrito(fila.distrito), n(fila.meta)]));
  const porDistrito = new Map<string, TerritorialBlockProgress[]>();
  for (const bloque of bloques) {
    const distrito = nombreDeDistrito(bloque.distrito);
    porDistrito.set(distrito, [...(porDistrito.get(distrito) ?? []), bloque]);
  }

  const distritos: FilaDeMeta[] = [...porDistrito.entries()].map(([distrito, delDistrito]) => {
    const titulares = delDistrito.filter((bloque) => !esReemplazo(bloque));
    const reemplazos = delDistrito.length - titulares.length;
    const meta = metaPorDistrito.get(distrito) ?? suma(titulares.map((bloque) => n(bloque.entrevistas) ?? n(bloque.meta))) ?? 0;
    return {
      distrito,
      meta: Math.round(meta),
      umps: titulares.length,
      reemplazos,
      porUmp: titulares.length ? fmt(Math.round(meta / titulares.length)) : "—",
      viviendas: suma(titulares.map((bloque) => n(bloque.viviendas))),
      poblacion: suma(titulares.map((bloque) => n(bloque.poblacion))),
    };
  }).sort((a, b) => a.distrito.localeCompare(b.distrito, "es"));

  const total: FilaDeMeta = {
    distrito: "Total",
    meta: distritos.reduce((acumulado, fila) => acumulado + fila.meta, 0),
    umps: distritos.reduce((acumulado, fila) => acumulado + fila.umps, 0),
    reemplazos: distritos.reduce((acumulado, fila) => acumulado + fila.reemplazos, 0),
    porUmp: "",
    viviendas: suma(distritos.map((fila) => fila.viviendas)),
    poblacion: suma(distritos.map((fila) => fila.poblacion)),
  };
  total.porUmp = total.umps ? fmt(Math.round(total.meta / total.umps)) : "—";

  const titulares = bloques.filter((bloque) => !esReemplazo(bloque));
  const metodo = modaDeTexto(titulares.map((bloque) => String(bloque.metodo ?? "").trim().toLowerCase()));
  const entrevistas = moda(titulares.map((bloque) => n(bloque.entrevistas)).filter((valor): valor is number => valor != null));
  const inicio = moda(titulares.map((bloque) => n(bloque.rango_inicio)).filter((valor): valor is number => valor != null));
  const fin = moda(titulares.map((bloque) => n(bloque.rango_fin)).filter((valor): valor is number => valor != null));
  const reemplazosPorUmp = n(reports?.route_overview?.replacement_per_route);

  const comoSeArma: ComoSeArma[] = [
    { clave: "unidad", texto: "La UMP es la manzana titular; si no rinde, se pasa a su reemplazo" },
    metodo ? { clave: "metodo", texto: METODOS[metodo] ?? `Selección: ${metodo}` } : null,
    entrevistas != null ? { clave: "entrevistas", texto: `${fmt(entrevistas)} entrevistas por UMP${inicio != null && fin != null ? `, rango de viviendas ${fmt(inicio)} a ${fmt(fin)}` : ""}` } : null,
    reemplazosPorUmp != null ? { clave: "reemplazos", texto: `${fmt(reemplazosPorUmp)} ${reemplazosPorUmp === 1 ? "reemplazo" : "reemplazos"} por UMP` } : null,
    { clave: "eje", texto: "La meta se reparte por distrito" },
  ].filter((item): item is ComoSeArma => item != null);

  return { disponible: bloques.length > 0, distritos, total, comoSeArma, bloques };
}
