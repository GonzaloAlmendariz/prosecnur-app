/**
 * Geometría del diagrama de Control › Cruce (ficha Ctl6): de la respuesta al
 * avance, en cuatro columnas —Origen, Canal, Plataforma y Resultado—, sobre
 * `internal_queries.flow.links`.
 *
 * El motor rotula «Incluido en avance» también a parciales y rechazos del
 * padrón, que no cuentan como efectivas (H4). Aquí el resultado se re-rotula
 * según de dónde viene: una completa incluida es «Efectiva»; una parcial o un
 * rechazo incluidos están «En el universo, no cuentan». Puro y con test: la
 * vista solo dibuja.
 */

export type EnlaceDeFlujo = { source: string; target: string; value: number };

export type Columna = "origen" | "canal" | "plataforma" | "resultado";

export const COLUMNAS: ReadonlyArray<{ id: Columna; rotulo: string }> = [
  { id: "origen", rotulo: "Origen" },
  { id: "canal", rotulo: "Canal" },
  { id: "plataforma", rotulo: "Plataforma" },
  { id: "resultado", rotulo: "Resultado" },
];

const ORIGENES = ["En base", "Fuera de base"];
const PLATAFORMA = ["Completa", "Parcial", "Rechazo", "Sin respuesta"];

export type TonoDeNodo = "neutro" | "efectiva" | "parcial" | "rechazo" | "sin-respuesta" | "excluida" | "no-cuenta";

const TONO: Record<string, TonoDeNodo> = {
  Completa: "efectiva",
  Parcial: "parcial",
  Rechazo: "rechazo",
  "Sin respuesta": "sin-respuesta",
  Efectiva: "efectiva",
  "En el universo, no cuenta": "no-cuenta",
  "Excluida del avance": "excluida",
  "Pendiente de respuesta": "sin-respuesta",
};

function normal(valor: string) {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** El resultado con su rótulo corregido (H4). */
export function rotuloDeResultado(origen: string, destino: string): string {
  const clave = normal(destino);
  if (clave.startsWith("incluido")) return normal(origen) === "completa" ? "Efectiva" : "En el universo, no cuenta";
  if (clave.startsWith("excluido")) return "Excluida del avance";
  if (clave.startsWith("pendiente")) return "Pendiente de respuesta";
  return destino;
}

function columnaDe(nombre: string, destinos: Set<string>, origenes: Set<string>): Columna {
  if (ORIGENES.includes(nombre)) return "origen";
  if (PLATAFORMA.includes(nombre)) return "plataforma";
  if (!origenes.has(nombre) && destinos.has(nombre)) return "resultado";
  return "canal";
}

/** Los enlaces con el resultado re-rotulado y los nodos ubicados en su columna. */
export function normalizarFlujo(enlaces: readonly EnlaceDeFlujo[]) {
  const limpios = enlaces
    .filter((enlace) => enlace.value > 0 && enlace.source && enlace.target)
    .map((enlace) => {
      const destino = PLATAFORMA.includes(enlace.source) ? rotuloDeResultado(enlace.source, enlace.target) : enlace.target;
      return { source: enlace.source, target: destino, value: enlace.value };
    });
  // Juntar enlaces que tras re-rotular van al mismo par.
  const porPar = new Map<string, EnlaceDeFlujo>();
  limpios.forEach((enlace) => {
    const clave = `${enlace.source}→${enlace.target}`;
    const previo = porPar.get(clave);
    if (previo) previo.value += enlace.value;
    else porPar.set(clave, { ...enlace });
  });
  const unicos = [...porPar.values()];
  const destinos = new Set(unicos.map((enlace) => enlace.target));
  const origenes = new Set(unicos.map((enlace) => enlace.source));
  const nombres = [...new Set([...origenes, ...destinos])];
  return { enlaces: unicos, columna: new Map(nombres.map((nombre) => [nombre, columnaDe(nombre, destinos, origenes)])) };
}

export type NodoDibujado = { nombre: string; columna: Columna; valor: number; x: number; y: number; alto: number; tono: TonoDeNodo };
export type CintaDibujada = { clave: string; origen: string; destino: string; valor: number; d: string; tono: TonoDeNodo };

const ORDEN_DE_RESULTADO = ["Efectiva", "En el universo, no cuenta", "Excluida del avance", "Pendiente de respuesta"];

/** Ubica nodos y cintas en un lienzo de `ancho` por `alto`. */
export function dibujarFlujo(enlacesCrudos: readonly EnlaceDeFlujo[], ancho: number, alto: number, anchoNodo = 12, separacion = 14) {
  const { enlaces, columna } = normalizarFlujo(enlacesCrudos);
  const entra = new Map<string, number>();
  const sale = new Map<string, number>();
  enlaces.forEach((enlace) => {
    sale.set(enlace.source, (sale.get(enlace.source) ?? 0) + enlace.value);
    entra.set(enlace.target, (entra.get(enlace.target) ?? 0) + enlace.value);
  });
  const valorDe = (nombre: string) => Math.max(entra.get(nombre) ?? 0, sale.get(nombre) ?? 0);
  const porColumna = new Map<Columna, string[]>(COLUMNAS.map((item) => [item.id, []]));
  columna.forEach((col, nombre) => porColumna.get(col)?.push(nombre));
  const ordenar = (col: Columna, lista: string[]) => {
    if (col === "origen") return lista.sort((a, b) => ORIGENES.indexOf(a) - ORIGENES.indexOf(b));
    if (col === "plataforma") return lista.sort((a, b) => PLATAFORMA.indexOf(a) - PLATAFORMA.indexOf(b));
    const lugar = (nombre: string) => {
      const indice = ORDEN_DE_RESULTADO.indexOf(nombre);
      return indice < 0 ? ORDEN_DE_RESULTADO.length : indice;
    };
    if (col === "resultado") return lista.sort((a, b) => lugar(a) - lugar(b) || valorDe(b) - valorDe(a));
    return lista.sort((a, b) => valorDe(b) - valorDe(a));
  };
  const totales = COLUMNAS.map((item) => {
    const lista = porColumna.get(item.id) ?? [];
    return lista.reduce((suma, nombre) => suma + valorDe(nombre), 0);
  });
  const maximo = Math.max(1, ...totales);
  const cuenta = Math.max(1, ...COLUMNAS.map((item) => (porColumna.get(item.id) ?? []).length));
  const escala = Math.max(0, alto - separacion * (cuenta - 1)) / maximo;
  const paso = COLUMNAS.length > 1 ? (ancho - anchoNodo) / (COLUMNAS.length - 1) : 0;

  const nodos = new Map<string, NodoDibujado>();
  COLUMNAS.forEach((item, indice) => {
    let y = 0;
    ordenar(item.id, porColumna.get(item.id) ?? []).forEach((nombre) => {
      const alturaNodo = Math.max(2, valorDe(nombre) * escala);
      nodos.set(nombre, { nombre, columna: item.id, valor: valorDe(nombre), x: indice * paso, y, alto: alturaNodo, tono: TONO[nombre] ?? "neutro" });
      y += alturaNodo + separacion;
    });
  });

  const salidaUsada = new Map<string, number>();
  const entradaUsada = new Map<string, number>();
  const ordenadas = [...enlaces].sort((a, b) => (nodos.get(a.target)?.y ?? 0) - (nodos.get(b.target)?.y ?? 0));
  const yDeSalida = new Map<EnlaceDeFlujo, number>();
  ordenadas.forEach((enlace) => {
    const usado = salidaUsada.get(enlace.source) ?? 0;
    yDeSalida.set(enlace, (nodos.get(enlace.source)?.y ?? 0) + usado);
    salidaUsada.set(enlace.source, usado + enlace.value * escala);
  });
  const cintas: CintaDibujada[] = [...enlaces]
    .sort((a, b) => (nodos.get(a.source)?.y ?? 0) - (nodos.get(b.source)?.y ?? 0))
    .map((enlace) => {
      const origen = nodos.get(enlace.source);
      const destino = nodos.get(enlace.target);
      const grosor = enlace.value * escala;
      const usado = entradaUsada.get(enlace.target) ?? 0;
      entradaUsada.set(enlace.target, usado + grosor);
      if (!origen || !destino) return null;
      const x0 = origen.x + anchoNodo;
      const x1 = destino.x;
      const y0 = yDeSalida.get(enlace) ?? origen.y;
      const y1 = destino.y + usado;
      const medio = (x0 + x1) / 2;
      const d = `M${x0},${y0} C${medio},${y0} ${medio},${y1} ${x1},${y1} L${x1},${y1 + grosor} C${medio},${y1 + grosor} ${medio},${y0 + grosor} ${x0},${y0 + grosor} Z`;
      const tono: TonoDeNodo = destino.tono === "excluida" || destino.tono === "rechazo" ? destino.tono : destino.columna === "resultado" ? destino.tono : "neutro";
      return { clave: `${enlace.source}→${enlace.target}`, origen: enlace.source, destino: enlace.target, valor: enlace.value, d, tono };
    })
    .filter((cinta): cinta is CintaDibujada => Boolean(cinta));

  const registros = (porColumna.get("origen") ?? []).reduce((suma, nombre) => suma + valorDe(nombre), 0);
  return { nodos: [...nodos.values()], cintas, registros, valorDe };
}

/** Conteo por rótulo, de mayor a menor, para los paneles de la derecha. */
export function conteoPor<T>(filas: readonly T[], clave: (fila: T) => string): Array<{ rotulo: string; casos: number }> {
  const cuenta = new Map<string, number>();
  filas.forEach((fila) => {
    const rotulo = clave(fila).trim();
    if (!rotulo) return;
    cuenta.set(rotulo, (cuenta.get(rotulo) ?? 0) + 1);
  });
  return [...cuenta].map(([rotulo, casos]) => ({ rotulo, casos })).sort((a, b) => b.casos - a.casos || a.rotulo.localeCompare(b.rotulo, "es"));
}
