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

/** Un parámetro del diseño muestral: rótulo corto, valor y, si el término lo
 * pide, la aclaración que va al tooltip (nunca tras «;» en el texto). */
export type ComoSeArma = { clave: string; rotulo: string; valor: string; ayuda?: string };

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

const METODOS: Record<string, { valor: string; ayuda: string }> = {
  pps: { valor: "PPS por territorio", ayuda: "Probabilidad proporcional al tamaño, dentro de cada territorio muestral" },
  srs: { valor: "Aleatoria simple por territorio", ayuda: "Muestreo aleatorio simple dentro de cada territorio muestral" },
  sistematico: { valor: "Sistemática por territorio", ayuda: "Muestreo sistemático dentro de cada territorio muestral" },
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

  const seleccion = metodo ? METODOS[metodo] ?? { valor: metodo, ayuda: "" } : null;
  const comoSeArma: ComoSeArma[] = [
    { clave: "unidad", rotulo: "UMP", valor: "Manzana titular", ayuda: "Si la titular no rinde, se pasa a su reemplazo" },
    seleccion ? { clave: "metodo", rotulo: "Selección", valor: seleccion.valor, ...(seleccion.ayuda ? { ayuda: seleccion.ayuda } : {}) } : null,
    entrevistas != null ? { clave: "entrevistas", rotulo: "Entrevistas por UMP", valor: fmt(entrevistas) } : null,
    inicio != null && fin != null ? { clave: "rango", rotulo: "Rango de viviendas", valor: `${fmt(inicio)} a ${fmt(fin)}`, ayuda: "Viviendas de la manzana entre las que arranca el recorrido" } : null,
    reemplazosPorUmp != null ? { clave: "reemplazos", rotulo: "Reemplazos por UMP", valor: fmt(reemplazosPorUmp) } : null,
    { clave: "eje", rotulo: "Reparto de la meta", valor: "Por distrito" },
  ].filter((item): item is ComoSeArma => item != null);

  return { disponible: bloques.length > 0, distritos, total, comoSeArma, bloques };
}
