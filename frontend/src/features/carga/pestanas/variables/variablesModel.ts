// Carga › Variables con la forma del prototipo "carga-variables" (ADR 0142):
// la tabla de lo que la base trae o calcula fuera del formulario, agrupada, y
// el inspector de la elegida. Todo lo que decide la pestaña vive aquí y tiene
// Vitest; los componentes solo pintan.
//
// Lo que publica `GET /api/carga/base-variables` y lo que no:
//  - Publica las columnas fuera del formulario (`extras`, con `n_validos` y si
//    están incorporadas) y las calculadas con su regla.
//  - No publica el archivo ni la clave de una columna anexada, el total de
//    casos de la base, el total de columnas, las preguntas del formulario, los
//    roles de la base ni el resumen de una calculada guardada en otra sesión.
//    Esos huecos van declarados en `HUECOS_DEL_MOTOR_VARIABLES` y no se
//    recalculan con otra fuente.

import type {
  BaseVariables,
  ColumnaPropia,
  ResumenCalculada,
  VariableCalculada,
} from "../../../../api/baseVariables";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { reglaLegible } from "../../variablesBase/variablesBaseModel";

export type GrupoDeVariables = "pendientes" | "incorporadas" | "calculadas";

export type FilaDeVariable = {
  /** `columna:<name>` o `calculada:<nombre>`: identifica la fila sin cruzar por rótulo. */
  clave: string;
  grupo: GrupoDeVariables;
  codigo: string;
  etiqueta: string;
  origen: "columna" | "calculada";
  deDonde: string;
  /** Casos con dato; `null` cuando el motor no lo publica (calculada sin resumen en esta sesión). */
  conDato: number | null;
};

export type GrupoConFilas = { grupo: GrupoDeVariables; rotulo: string; filas: FilaDeVariable[] };

export const ROTULO_GRUPO: Record<GrupoDeVariables, string> = {
  pendientes: "Por incorporar",
  incorporadas: "Incorporadas",
  calculadas: "Calculadas",
};

/** Orden de los grupos: lo que pide una decisión va primero. */
const ORDEN_GRUPOS: readonly GrupoDeVariables[] = ["pendientes", "incorporadas", "calculadas"];

export const HUECOS_DEL_MOTOR_VARIABLES =
  'Del prototipo, el motor no publica en GET /api/carga/base-variables: el grupo "Anexadas desde otro archivo" con su archivo y su clave (extras[].anexada), '
  + 'la barra de "Con dato" sobre el total de casos (n_casos), las cifras "variables en la base" y "del formulario" (n_columnas, n_del_formulario), '
  + 'los "Roles de la base" (roles.identidad, roles.recopilador, roles.fecha) y la distribución de una calculada guardada antes (calculadas[].resumen).';

export function claveDeColumna(name: string): string {
  return `columna:${name}`;
}

export function claveDeCalculada(nombre: string): string {
  return `calculada:${nombre}`;
}

export function conDatoDeCalculada(resumen: ResumenCalculada | undefined): number | null {
  if (!resumen) return null;
  if (resumen.numerico) return resumen.numerico.n_validos;
  return Math.max(0, resumen.n_total - resumen.n_sin_dato);
}

function filaDeColumna(c: ColumnaPropia): FilaDeVariable {
  return {
    clave: claveDeColumna(c.name),
    grupo: c.declarada ? "incorporadas" : "pendientes",
    codigo: c.name,
    etiqueta: c.label || c.name,
    origen: "columna",
    deDonde: "Venía en las respuestas",
    conDato: c.n_validos,
  };
}

function filaDeCalculada(c: VariableCalculada, resumenes: Readonly<Record<string, ResumenCalculada>>): FilaDeVariable {
  return {
    clave: claveDeCalculada(c.nombre),
    grupo: "calculadas",
    codigo: c.nombre,
    etiqueta: c.etiqueta || c.nombre,
    origen: "calculada",
    deDonde: reglaLegible(c),
    conDato: conDatoDeCalculada(resumenes[c.nombre]),
  };
}

/** Los grupos con filas, en orden; un grupo sin filas no se pinta. */
export function gruposDeVariables(
  datos: Pick<BaseVariables, "extras" | "calculadas">,
  resumenes: Readonly<Record<string, ResumenCalculada>>,
): GrupoConFilas[] {
  const filas = [
    ...datos.extras.map(filaDeColumna),
    ...datos.calculadas.map((c) => filaDeCalculada(c, resumenes)),
  ];
  return ORDEN_GRUPOS
    .map((grupo) => ({ grupo, rotulo: ROTULO_GRUPO[grupo], filas: filas.filter((f) => f.grupo === grupo) }))
    .filter((g) => g.filas.length > 0);
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Los grupos con las filas cuyo código o etiqueta contienen todas las palabras buscadas; un grupo sin filas sale. */
export function filtrarGrupos(grupos: readonly GrupoConFilas[], busqueda: string): GrupoConFilas[] {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [...grupos];
  return grupos
    .map((g) => ({ ...g, filas: g.filas.filter((f) => {
      const t = normalizar(`${f.codigo} ${f.etiqueta}`);
      return palabras.every((w) => t.includes(w));
    }) }))
    .filter((g) => g.filas.length > 0);
}

/** Las columnas por incorporar que se ven; con `marcadas`, solo las elegidas a mano entre ellas. Cruza por código. */
export function pendientesVisibles(grupos: readonly GrupoConFilas[], marcadas?: readonly string[]): string[] {
  const visibles = grupos.find((g) => g.grupo === "pendientes")?.filas.map((f) => f.codigo) ?? [];
  return marcadas ? visibles.filter((c) => marcadas.includes(c)) : visibles;
}

/** La fila elegida: la pedida si sigue en la tabla; si no, la primera. */
export function filaElegida(grupos: readonly GrupoConFilas[], pedida: string | null): FilaDeVariable | null {
  const todas = grupos.flatMap((g) => g.filas);
  return todas.find((f) => f.clave === pedida) ?? todas[0] ?? null;
}

export type CifrasDeVariables = {
  /** Columnas incorporadas más calculadas: lo que la base suma al formulario. */
  anadidas: number;
  porIncorporar: number;
  calculadas: number;
};

export function cifrasDeVariables(datos: Pick<BaseVariables, "extras" | "calculadas">): CifrasDeVariables {
  const incorporadas = datos.extras.filter((c) => c.declarada).length;
  return {
    anadidas: incorporadas + datos.calculadas.length,
    porIncorporar: datos.extras.length - incorporadas,
    calculadas: datos.calculadas.length,
  };
}

/** "1 caso", "212 casos": el rótulo de una cuenta de casos. */
export function textoCasos(n: number): string {
  return n === 1 ? "1 caso" : `${formatoConteo(n)} casos`;
}

/** Un mínimo o máximo de fórmula: entero con separador de miles, decimal a dos cifras. */
export function numeroCorto(n: number): string {
  return Number.isInteger(n) ? formatoConteo(n) : String(Math.round(n * 100) / 100);
}

/** El título del inspector: "grupo_edad, Grupo de edad"; sin etiqueta propia, solo el código. */
export function tituloDeVariable(fila: Pick<FilaDeVariable, "codigo" | "etiqueta">): string {
  return fila.etiqueta && fila.etiqueta !== fila.codigo ? `${fila.codigo}, ${fila.etiqueta}` : fila.codigo;
}

/** Lo que el inspector muestra a la derecha: la elegida, o un editor. */
export type ModoDelInspector =
  | { tipo: "ver" }
  | { tipo: "nueva" }
  | { tipo: "editar"; nombre: string }
  | { tipo: "anexar" };

export type VistaDeVariables = { elegida: string | null; modo: ModoDelInspector; confirmandoQuitar: string | null };

export const VISTA_INICIAL: VistaDeVariables = { elegida: null, modo: { tipo: "ver" }, confirmandoQuitar: null };

export type AccionDeVista =
  | { tipo: "elegir"; clave: string }
  | { tipo: "modo"; modo: ModoDelInspector }
  | { tipo: "confirmar-quitar"; clave: string | null }
  | { tipo: "guardada"; nombre: string };

export function reducirVista(v: VistaDeVariables, a: AccionDeVista): VistaDeVariables {
  switch (a.tipo) {
    case "elegir":
      return { elegida: a.clave, modo: { tipo: "ver" }, confirmandoQuitar: null };
    case "modo":
      return { ...v, modo: a.modo, confirmandoQuitar: null };
    case "confirmar-quitar":
      return { ...v, confirmandoQuitar: a.clave };
    case "guardada":
      // La calculada recién guardada pasa a ser la elegida, con su resumen a la vista.
      return { elegida: claveDeCalculada(a.nombre), modo: { tipo: "ver" }, confirmandoQuitar: null };
  }
}

/** La escala de una calculada con su cuenta por código, cruzada por código y nunca por posición. */
export function escalaConCuentas(
  c: Pick<VariableCalculada, "escala">,
  resumen: ResumenCalculada | undefined,
): { codigo: string; etiqueta: string; n: number | null }[] {
  const porCodigo = new Map((resumen?.por_codigo ?? []).map((f) => [f.codigo, f.n]));
  return c.escala.map((o) => ({
    codigo: o.codigo,
    etiqueta: o.etiqueta || o.codigo,
    n: resumen ? porCodigo.get(o.codigo) ?? 0 : null,
  }));
}
