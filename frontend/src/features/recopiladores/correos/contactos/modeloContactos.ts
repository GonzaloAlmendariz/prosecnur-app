// Modelo puro de la pestaña Contactos (ADR 0112 §4): cifras, filtros, cruce,
// enlace y vacíos. Sin React: lo que aquí se decide se prueba sin montar nada.
//
// Dos reglas de la casa gobiernan las cifras:
// - El porcentaje va siempre con su frecuencia y su base (los efectivos del
//   corte). Se recalcula aquí con `n` y la base en vez de confiar en `pct`, que
//   puede llegar como fracción o como 0–100 según quién lo serialice.
// - Las cifras salen en es-PE: coma de millares y punto decimal (`formatoNumero`).

import type {
  CategoriaDelPerfil,
  ColumnaDeContactos,
  CruceDelPerfil,
  EnlacesGenerados,
  EstadoDeContacto,
  FiltrosDeContactos,
  PerfilDeContactos,
  ResumenDeContactos,
  VariableDelPerfil,
} from "../../../../api/mailContactos";
import { filtrosComoJson } from "../../../../api/mailContactos";
import { formatoConteo, formatoConteoDe } from "../../../../lib/formatoNumero";

// ---- Cifras -------------------------------------------------------------------

/** `n / base` como fracción; `null` sin base. */
export function proporcion(n: number, base: number): number | null {
  return base > 0 ? n / base : null;
}

// Un decimal SIEMPRE («33.0%», no «33%»): en una columna de porcentajes las
// cifras se alinean por la coma decimal y ninguna parece más redonda que otra.
const PORCENTAJE = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** «34.5%», «33.0%»; sin base, «—». */
export function formatoPorcentaje(fraccion: number | null): string {
  return fraccion === null || !Number.isFinite(fraccion) ? "—" : `${PORCENTAJE.format(fraccion * 100)}%`;
}

/** La tasa de respuesta de una categoría: quienes respondieron entre sus efectivos. */
export function tasaDe(categoria: Pick<CategoriaDelPerfil, "n" | "respondieron">): number | null {
  if (categoria.respondieron === null || categoria.n <= 0) return null;
  return categoria.respondieron / categoria.n;
}

/**
 * ¿La suma por categoría (con «Sin dato») es la base del corte? Es la promesa
 * del ADR 0112 §«Cumplimiento»; si el backend no la cumple, la vista lo dice en
 * vez de pintar porcentajes que no suman.
 */
export function sumaDeLaVariable(variable: VariableDelPerfil): number {
  return variable.categorias.reduce((total, c) => total + c.n, 0) + variable.sin_dato.n;
}

export function cuadraConLaBase(variable: VariableDelPerfil, base: number): boolean {
  return sumaDeLaVariable(variable) === base;
}

// ---- Distribución ---------------------------------------------------------------

/** Cuántas categorías se ven antes de «Ver las demás». */
export const CATEGORIAS_A_LA_VISTA = 12;

export type CategoriasDeLaTarjeta = {
  visibles: CategoriaDelPerfil[];
  ocultas: number;
  /** El mayor `n` visible: la escala de las barras. */
  maximo: number;
};

/**
 * Las categorías que pinta una tarjeta. El orden es el del backend (puede ser
 * ordinal); cuando hay más de las que caben a la vista, se muestran las más
 * frecuentes y el resto queda a un clic, dentro de la misma tarjeta.
 */
export function categoriasDeLaTarjeta(
  variable: VariableDelPerfil,
  expandida: boolean,
  limite = CATEGORIAS_A_LA_VISTA,
): CategoriasDeLaTarjeta {
  const todas = variable.categorias;
  let visibles = todas;
  if (!expandida && todas.length > limite) {
    const elegidas = new Set(
      [...todas].sort((a, b) => b.n - a.n).slice(0, limite).map((c) => c.valor),
    );
    visibles = todas.filter((c) => elegidas.has(c.valor));
  }
  const maximo = Math.max(0, variable.sin_dato.n, ...visibles.map((c) => c.n));
  return { visibles, ocultas: todas.length - visibles.length, maximo };
}

/**
 * Ancho de una barra, en % de la pista. Con `escala` = la base del corte, la
 * barra mide lo mismo que dice el porcentaje: tres sedes de un tercio no se
 * pintan llenas como si fueran el total.
 */
export function anchoDeBarra(n: number, maximo: number): number {
  if (maximo <= 0 || n <= 0) return 0;
  return Math.max(1, Math.round((n / maximo) * 1000) / 10);
}

// ---- Filtros ------------------------------------------------------------------

export type Filtros = Record<string, string[]>;

export function estaFiltrada(filtros: FiltrosDeContactos, columna: string, valor: string): boolean {
  return (filtros[columna] ?? []).includes(valor);
}

/** Clic en una barra: agrega la categoría al filtro de su columna o la quita. */
export function alternarFiltro(filtros: FiltrosDeContactos, columna: string, valor: string): Filtros {
  const actuales = filtros[columna] ?? [];
  const siguientes = actuales.includes(valor)
    ? actuales.filter((v) => v !== valor)
    : [...actuales, valor];
  return conColumna(filtros, columna, siguientes);
}

/**
 * Los filtros sin los de una columna: con ellos se pide la distribución de esa
 * misma variable, para que su tarjeta siga mostrando todas sus categorías
 * (OR dentro de la variable, AND entre variables) en vez de colapsar a la
 * elegida.
 */
export function filtrosSin(filtros: FiltrosDeContactos, columna: string): Filtros {
  return conColumna(filtros, columna, []);
}

/**
 * La faceta de una variable si es vigente: su columna filtra y se leyó con los
 * filtros de las demás tal como están ahora. Si no, `null` (la tarjeta se pinta
 * con el perfil del corte hasta que llegue).
 */
export function facetaVigente<T extends { clave: string }>(
  facetas: Readonly<Record<string, T>>,
  filtros: FiltrosDeContactos,
  columna: string,
): T | null {
  if (!(filtros[columna]?.length)) return null;
  const faceta = facetas[columna];
  if (!faceta) return null;
  return faceta.clave === (filtrosComoJson(filtrosSin(filtros, columna)) ?? "") ? faceta : null;
}

/** Las columnas que hoy filtran algo, en orden estable. */
export function columnasFiltradas(filtros: FiltrosDeContactos): string[] {
  return Object.keys(filtros).filter((c) => (filtros[c]?.length ?? 0) > 0).sort();
}

export function quitarFiltro(filtros: FiltrosDeContactos, columna: string, valor: string): Filtros {
  return conColumna(filtros, columna, (filtros[columna] ?? []).filter((v) => v !== valor));
}

function conColumna(filtros: FiltrosDeContactos, columna: string, valores: string[]): Filtros {
  const out: Filtros = {};
  for (const [clave, lista] of Object.entries(filtros)) if (clave !== columna && lista.length) out[clave] = [...lista];
  if (valores.length) out[columna] = valores;
  return out;
}

export function cuantosFiltros(filtros: FiltrosDeContactos): number {
  return Object.values(filtros).reduce((total, lista) => total + lista.length, 0);
}

/** En `filtros`, `""` es «sin dato» (ADR 0112, contrato del backend). */
export const VALOR_SIN_DATO = "";

export function rotuloDeValor(valor: string): string {
  return valor === VALOR_SIN_DATO ? "Sin dato" : valor;
}

export type ChipDeFiltro = { columna: string; valor: string; etiqueta: string; rotulo: string };

/** Un chip por categoría filtrada, con el nombre humano de su columna. */
export function chipsDeFiltros(
  filtros: FiltrosDeContactos,
  etiquetas: Readonly<Record<string, string>>,
): ChipDeFiltro[] {
  return Object.entries(filtros).flatMap(([columna, valores]) => valores.map((valor) => {
    const etiqueta = etiquetas[columna] ?? columna;
    return { columna, valor, etiqueta, rotulo: `${etiqueta}: ${rotuloDeValor(valor)}` };
  }));
}

/** Filtros que siguen siendo de una variable de control; el resto se suelta. */
export function filtrosDeControl(filtros: FiltrosDeContactos, control: readonly string[]): Filtros {
  const out: Filtros = {};
  for (const columna of control) if (filtros[columna]?.length) out[columna] = [...filtros[columna]];
  return out;
}

// ---- Cruce --------------------------------------------------------------------

/** El par a cruzar: el pedido si sigue siendo válido; si no, las dos primeras. */
export function cruceVigente(
  control: readonly string[],
  pedido: readonly [string, string] | null,
): [string, string] | null {
  if (control.length < 2) return null;
  if (pedido && pedido[0] !== pedido[1] && control.includes(pedido[0]) && control.includes(pedido[1])) {
    return [pedido[0], pedido[1]];
  }
  return [control[0], control[1]];
}

export type TotalesDelCruce = { porFila: number[]; porColumna: number[]; total: number };

export function totalesDelCruce(cruce: CruceDelPerfil): TotalesDelCruce {
  const porFila = cruce.celdas.map((fila) => fila.reduce((a, b) => a + b, 0));
  const porColumna = cruce.columnas.map((_, j) => cruce.celdas.reduce((a, fila) => a + (fila[j] ?? 0), 0));
  return { porFila, porColumna, total: porFila.reduce((a, b) => a + b, 0) };
}

/** Intensidad 0–1 de una celda (para el tinte), contra la mayor del cruce. */
export function intensidad(n: number, cruce: CruceDelPerfil): number {
  const maximo = Math.max(0, ...cruce.celdas.flat());
  return maximo > 0 ? n / maximo : 0;
}

/**
 * Las intensidades de todas las celdas según lo que se LEE (C5): en casos, el
 * conteo contra el mayor; en «% por fila», el porcentaje de la fila contra el
 * mayor porcentaje. El tinte sigue al número mostrado, nunca al que no se ve.
 */
export function intensidadesDelCruce(cruce: CruceDelPerfil, vista: "casos" | "fila"): number[][] {
  if (vista === "casos") return cruce.celdas.map((fila) => fila.map((n) => intensidad(n, cruce)));
  const porcentajes = cruce.celdas.map((fila) => {
    const total = fila.reduce((a, b) => a + b, 0);
    return fila.map((n) => (total > 0 ? n / total : 0));
  });
  const maximo = Math.max(0, ...porcentajes.flat());
  return porcentajes.map((fila) => fila.map((p) => (maximo > 0 ? p / maximo : 0)));
}

// ---- Resumen ------------------------------------------------------------------

export type TarjetaDeResumen = {
  id: "importados" | "efectivos" | "fuera" | "enlace" | "respondieron";
  titulo: string;
  valor: string;
  detalle: string;
  tono: "neutro" | "acento" | "aviso" | "exito";
};

export function tarjetasDeResumen(r: ResumenDeContactos, respuestasLeidas: boolean): TarjetaDeResumen[] {
  const fuera = r.sin_correo + r.correo_invalido + r.repetidos;
  const partesFuera = [
    r.sin_correo ? `${formatoConteo(r.sin_correo)} sin correo` : "",
    r.correo_invalido ? `${formatoConteo(r.correo_invalido)} con correo inválido` : "",
    r.repetidos ? `${formatoConteoDe(r.repetidos, "repetido")}` : "",
  ].filter(Boolean);
  const leidas = respuestasLeidas && r.respondieron !== null;
  return [
    {
      id: "importados",
      titulo: "Importados",
      valor: formatoConteo(r.importados),
      detalle: "Filas de la lista",
      tono: "neutro",
    },
    {
      id: "efectivos",
      titulo: "Efectivos",
      valor: formatoConteo(r.efectivos),
      detalle: r.importados ? `${formatoPorcentaje(proporcion(r.efectivos, r.importados))} de ${formatoConteo(r.importados)} importados` : "Sin lista",
      tono: "acento",
    },
    {
      id: "fuera",
      titulo: "Fuera del envío",
      valor: formatoConteo(fuera),
      detalle: partesFuera.length ? partesFuera.join(" · ") : "Ninguno",
      tono: fuera ? "aviso" : "neutro",
    },
    {
      id: "enlace",
      titulo: "Con enlace",
      valor: formatoConteo(r.con_enlace),
      detalle: r.con_enlace
        ? `${formatoPorcentaje(proporcion(r.con_enlace, r.efectivos))} de ${formatoConteo(r.efectivos)} efectivos`
        : "Todavía sin enlaces",
      tono: r.efectivos > 0 && r.con_enlace >= r.efectivos ? "exito" : "neutro",
    },
    {
      id: "respondieron",
      titulo: "Respondieron",
      valor: leidas ? formatoConteo(r.respondieron) : "—",
      detalle: leidas
        ? `${formatoPorcentaje(proporcion(r.respondieron ?? 0, r.efectivos))} de ${formatoConteo(r.efectivos)} efectivos${r.leido_en ? ` · ${fechaLegible(r.leido_en)}` : ""}`
        : "Aún no se lee quién respondió",
      tono: leidas ? "exito" : "neutro",
    },
  ];
}

/** «22/10/2026 14:30»; si no se puede leer, el texto tal cual. */
export function fechaLegible(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(fecha);
}

// ---- Lista ------------------------------------------------------------------------

export const ETIQUETA_DE_ESTADO: Record<EstadoDeContacto, string> = {
  efectivo: "Efectivo",
  sin_correo: "Sin correo",
  correo_invalido: "Correo inválido",
  repetido: "Repetido",
};

/** Columnas que ya tienen su propia celda (correo, nombre y enlace) no se repiten. */
const COLUMNAS_PROPIAS = new Set(["email", "correo", "nombre", "name", "enlace_encuesta"]);

/** La columna del enlace personal: su celda dice «Sí»; la URL cruda no se muestra. */
export function esColumnaDeEnlace(columna: ColumnaDeContactos): boolean {
  return columna.es_enlace === true || columna.key.toLowerCase() === "enlace_encuesta";
}

/**
 * Las columnas de la tabla: primero las de control (en el orden elegido) y,
 * si se pide, el resto de las importadas.
 */
export function columnasDeLaLista(
  columnas: readonly ColumnaDeContactos[],
  control: readonly string[],
  todas: boolean,
): ColumnaDeContactos[] {
  const porClave = new Map(columnas.map((c) => [c.key, c]));
  const deControl = control
    .map((key) => porClave.get(key) ?? null)
    .filter((c): c is ColumnaDeContactos => c !== null && !esColumnaDeEnlace(c));
  if (!todas) return deControl;
  const resto = columnas.filter((c) => (
    !control.includes(c.key) && !COLUMNAS_PROPIAS.has(c.key.toLowerCase()) && !esColumnaDeEnlace(c)
  ));
  return [...deControl, ...resto];
}

/** «51–100 de 312». */
export function rangoDePagina(page: number, perPage: number, total: number): string {
  if (total <= 0) return "0 de 0";
  const desde = (page - 1) * perPage + 1;
  const hasta = Math.min(total, page * perPage);
  return `${formatoConteo(desde)}–${formatoConteo(hasta)} de ${formatoConteo(total)}`;
}

export function paginas(perPage: number, total: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, perPage)));
}

// ---- Enlace a la encuesta ----------------------------------------------------------

export type ValidacionDeEnlace = { ok: true; url: string } | { ok: false; motivo: string };

/** El enlace del recopilador: `https://` y una dirección que se pueda leer. */
export function validarEnlace(crudo: string): ValidacionDeEnlace {
  const url = crudo.trim();
  if (!url) return { ok: false, motivo: "Pega el enlace del recopilador de SurveyMonkey." };
  if (!/^https:\/\//i.test(url)) return { ok: false, motivo: "El enlace tiene que empezar con https://. Cópialo tal como lo muestra SurveyMonkey." };
  try {
    const leido = new URL(url);
    if (!leido.hostname.includes(".")) return { ok: false, motivo: "Ese enlace no tiene una dirección completa. Cópialo de nuevo desde SurveyMonkey." };
  } catch {
    return { ok: false, motivo: "Ese enlace no se puede leer. Cópialo de nuevo desde SurveyMonkey." };
  }
  return { ok: true, url };
}

/** «Listo: 312 enlaces (5 nuevos, 307 conservados). Úsalos en el botón…». */
export function textoDelResultado(r: EnlacesGenerados): string {
  const nuevos = formatoConteoDe(r.generados, "nuevo");
  const conservados = formatoConteoDe(r.conservados, "conservado");
  const usalo = r.total === 1 ? "Úsalo" : "Úsalos";
  return `Listo: ${formatoConteoDe(r.total, "enlace")} (${nuevos}, ${conservados}). ${usalo} en el botón del correo con el campo «Enlace a la encuesta».`;
}

/**
 * Cuántos contactos hay en la lista y, si difiere, cuántos de ellos son
 * efectivos: el tablero cuenta solo efectivos y la lista todos los estados, y
 * las dos cifras tienen que leerse juntas sin parecer contradictorias.
 */
export function cifraDeLaLista(total: number, efectivos: number | null, conFiltros: boolean): string {
  const base = `${formatoConteoDe(total, "contacto")}${conFiltros ? " con los filtros" : ""}`;
  if (efectivos === null || efectivos === total) return base;
  return `${base} (${formatoConteoDe(efectivos, "efectivo")})`;
}

// ---- Vacíos -------------------------------------------------------------------------

/**
 * Por qué el tablero no tiene qué mostrar (C5: vacío legítimo, con su causa y
 * su arreglo). `null`: hay perfil que pintar.
 */
export type VacioDelPerfil = "sin-contactos" | "sin-efectivos" | "sin-candidatas" | "sin-variables" | "sin-base" | null;

export function vacioDelPerfil(
  resumen: ResumenDeContactos | null,
  perfil: PerfilDeContactos | null,
  conFiltros: boolean,
  cargados: boolean | null = null,
): VacioDelPerfil {
  if (cargados === false || perfil?.cargados === false || (resumen && resumen.importados === 0)) return "sin-contactos";
  if (resumen && resumen.efectivos === 0) return "sin-efectivos";
  if (!perfil) return null;
  if (perfil.control.length === 0) return perfil.candidatas.length === 0 ? "sin-candidatas" : "sin-variables";
  if (perfil.base === 0 && conFiltros) return "sin-base";
  return null;
}
