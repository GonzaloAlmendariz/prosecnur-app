// Variables de la base (ADR 0106): lógica pura del panel «Variables de la base».
//
// - El panel direccionable y sus direcciones (`?panel=variables-base&foco=<base>`).
// - El borrador de las columnas que la base trae y el instrumento no declara:
//   cuáles se incorporan y con qué etiquetas.
// - El borrador de una variable calculada (`alguna` / `recodificar`), su
//   validación y el cuerpo que se envía.
// - Los rótulos en llano: la regla, el resumen por código, el tipo.
//
// Los componentes sólo pintan; todo lo que decide vive aquí y tiene Vitest.

import type {
  BaseVariables,
  CalculadaADeclarar,
  ColumnaADeclarar,
  ColumnaPropia,
  OpcionBase,
  ReglaCalculada,
  ResumenCalculada,
  TipoColumna,
  VariableCalculada,
} from "../../../api/baseVariables";
import type { VariableDeBase } from "../../../api/equivalencias";
import type { CodigosObservados } from "../../../api/codigosObservados";
import { codigosConObservados } from "../codigosObservadosModel";
import { conNivel } from "../../../lib/navegacion/direccion";
import type { PanelDeclarado } from "../../../lib/navegacion/paneles";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import { parsearCodigos, textoDeCodigos, type AccionCompuesto } from "../indicadorCompuestoModel";

// ---------------------------------------------------------------------------
// Panel y direcciones
// ---------------------------------------------------------------------------

/** `?panel=variables-base&foco=<base>`: columnas propias, calculadas y la marca «ya codificada». */
export const PANEL_VARIABLES_BASE: PanelDeclarado = {
  id: "variables-base",
  label: "Variables de la base",
  clase: "sideover",
};

export function searchConVariablesBase(search: string, base: string): string {
  return conNivel(conNivel(search, "panel", PANEL_VARIABLES_BASE.id), "foco", base || null);
}

/** Dónde se abre el panel desde fuera de Carga (Codificación). */
export function hrefVariablesBase(base: string): string {
  return `/carga${searchConVariablesBase("?pestana=fuentes", base)}`;
}

/**
 * Dónde se declara el motivo de las preguntas retiradas: el bloque de origen
 * externo de Carga › Revisión, con esa base como «Base revisada».
 */
export function hrefDeclararRetiradas(base: string): string {
  return `/carga${conNivel("?pestana=revision", "foco", base || null)}`;
}

export type CargaVariablesBase =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; datos: BaseVariables };

/** Readiness del panel: `false` sólo mientras lee (AD6). */
export function readinessVariablesBase(carga: CargaVariablesBase, foco: string | null): string {
  if (!foco) return "vacio:sin-base";
  if (carga.tipo === "cargando") return "false";
  if (carga.tipo === "error") return "vacio:error";
  return "true";
}

// ---------------------------------------------------------------------------
// Aviso a las vistas que listan variables
// ---------------------------------------------------------------------------

/** Lo escucha quien muestra el catálogo de una base (Equivalencias). */
export const EVENTO_VARIABLES_BASE = "pulso:base-variables-changed";

export type DetalleVariablesBase = { base: string };

/**
 * Tras declarar o calcular: Analítica relee su fuente, Gráficos suelta su
 * caché de variables (lo hace con `pulso:active-base-changed`) y quien muestre
 * el catálogo de la base lo vuelve a pedir.
 */
export function avisarCambioDeVariables(base: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DetalleVariablesBase>(EVENTO_VARIABLES_BASE, { detail: { base } }));
  window.dispatchEvent(new Event("pulso:analitica-source-changed"));
  // Ningún oyente lee el detalle: la base activa no cambió, cambió lo que trae.
  window.dispatchEvent(new CustomEvent("pulso:active-base-changed", { detail: { base, motivo: "variables-base" } }));
}

// ---------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------

export const ROTULO_TIPO: Record<TipoColumna, string> = {
  select_one: "Categórica",
  integer: "Entero",
  decimal: "Decimal",
  text: "Texto",
  date: "Fecha",
  datetime: "Fecha y hora",
};

/** «1 Sí · 2 No · +3»: las primeras opciones y cuántas faltan. */
export function resumenOpciones(opciones: readonly OpcionBase[], max = 3): string {
  if (opciones.length === 0) return "";
  const vistas = opciones.slice(0, max).map((o) => (o.etiqueta && o.etiqueta !== o.codigo ? `${o.codigo} ${o.etiqueta}` : o.codigo));
  const resto = opciones.length - vistas.length;
  return resto > 0 ? `${vistas.join(" · ")} · +${resto}` : vistas.join(" · ");
}

/** Opciones que sólo traen el código (lo usual al venir de un Excel). */
export function opcionesSinEtiqueta(opciones: readonly OpcionBase[]): boolean {
  return opciones.length > 0 && opciones.every((o) => !o.etiqueta.trim() || o.etiqueta.trim() === o.codigo);
}

export function textoIncorporar(n: number): string {
  if (n === 0) return "Incorporar columnas";
  return n === 1 ? "Incorporar 1 columna" : `Incorporar ${formatoConteo(n)} columnas`;
}

export function textoIncorporadas(n: number): string {
  return n === 1 ? "Se incorporó 1 columna." : `Se incorporaron ${formatoConteo(n)} columnas.`;
}

/** «Alguna de 9 preguntas · sí = 1» / «Recodifica P8 en 4 categorías» / «= 2026 - P8». */
export function reglaLegible(c: Pick<VariableCalculada, "regla" | "variables" | "codigos" | "escala" | "expresion">): string {
  if (c.regla === "formula") return `= ${c.expresion ?? ""}`;
  if (c.regla === "recodificar") {
    const origen = c.variables[0] ?? "una pregunta";
    return `Recodifica ${origen} en ${formatoConteoDe(c.escala.length, "categoría", "categorías")}`;
  }
  const cuantas = c.variables.length === 1 ? c.variables[0] : `Alguna de ${formatoConteo(c.variables.length)} preguntas`;
  return c.codigos.length ? `${cuantas} · sí = ${textoDeCodigos(c.codigos)}` : cuantas;
}

/** «Sí 120 · No 300 · Sin dato 5»; una fórmula: «Con valor 2.400 · de 0 a 19 · Sin dato 5». */
export function textoResumen(r: ResumenCalculada): string {
  if (r.numerico) {
    const { n_validos, minimo, maximo } = r.numerico;
    const rango = minimo === null || maximo === null
      ? ""
      : minimo === maximo ? ` · ${formatoNumeroCorto(minimo)}` : ` · de ${formatoNumeroCorto(minimo)} a ${formatoNumeroCorto(maximo)}`;
    return `Con valor ${formatoConteo(n_validos)}${rango} · Sin dato ${formatoConteo(r.n_sin_dato)}`;
  }
  const partes = r.por_codigo.map((f) => `${f.etiqueta || f.codigo} ${formatoConteo(f.n)}`);
  partes.push(`Sin dato ${formatoConteo(r.n_sin_dato)}`);
  return partes.join(" · ");
}

// ---------------------------------------------------------------------------
// Columnas propias
// ---------------------------------------------------------------------------

export type BorradorColumnas = {
  marcadas: readonly string[];
  /** Etiqueta editada por columna; ausente es la propuesta. */
  etiquetas: Readonly<Record<string, string>>;
  /** Etiquetas de opción editadas: `columna -> código -> etiqueta`. */
  opciones: Readonly<Record<string, Readonly<Record<string, string>>>>;
};

export const BORRADOR_COLUMNAS_VACIO: BorradorColumnas = { marcadas: [], etiquetas: {}, opciones: {} };

export type AccionColumnas =
  | { tipo: "marcar"; name: string; marcada: boolean }
  | { tipo: "todas"; names: readonly string[]; marcada: boolean }
  | { tipo: "etiqueta"; name: string; valor: string }
  | { tipo: "opcion"; name: string; codigo: string; valor: string }
  | { tipo: "reiniciar" };

export function reducirColumnas(b: BorradorColumnas, a: AccionColumnas): BorradorColumnas {
  switch (a.tipo) {
    case "marcar": {
      const sin = b.marcadas.filter((n) => n !== a.name);
      return { ...b, marcadas: a.marcada ? [...sin, a.name] : sin };
    }
    case "todas": {
      const sin = b.marcadas.filter((n) => !a.names.includes(n));
      return { ...b, marcadas: a.marcada ? [...sin, ...a.names] : sin };
    }
    case "etiqueta":
      return { ...b, etiquetas: { ...b.etiquetas, [a.name]: a.valor } };
    case "opcion":
      return { ...b, opciones: { ...b.opciones, [a.name]: { ...(b.opciones[a.name] ?? {}), [a.codigo]: a.valor } } };
    case "reiniciar":
      return BORRADOR_COLUMNAS_VACIO;
  }
}

/** Columnas por incorporar (primero) e incorporadas, en el orden de la base. */
export function separarColumnas(extras: readonly ColumnaPropia[]): { pendientes: ColumnaPropia[]; incorporadas: ColumnaPropia[] } {
  return {
    pendientes: extras.filter((c) => !c.declarada),
    incorporadas: extras.filter((c) => c.declarada),
  };
}

export function etiquetaEditada(b: BorradorColumnas, c: ColumnaPropia): string {
  return b.etiquetas[c.name] ?? c.label;
}

/** Opciones con las etiquetas editadas; una vacía cae al código. */
export function opcionesEditadas(b: BorradorColumnas, c: ColumnaPropia): OpcionBase[] {
  const editadas = b.opciones[c.name] ?? {};
  return c.opciones.map((o) => {
    const e = (editadas[o.codigo] ?? o.etiqueta).trim();
    return { codigo: o.codigo, etiqueta: e || o.codigo };
  });
}

/** Lo que se envía: sólo las marcadas que todavía no están incorporadas. */
export function columnasADeclarar(extras: readonly ColumnaPropia[], b: BorradorColumnas): ColumnaADeclarar[] {
  return extras
    .filter((c) => !c.declarada && b.marcadas.includes(c.name))
    .map((c) => {
      const label = etiquetaEditada(b, c).trim() || c.name;
      return c.tipo === "select_one"
        ? { name: c.name, label, tipo: c.tipo, opciones: opcionesEditadas(b, c) }
        : { name: c.name, label, tipo: c.tipo };
    });
}

// ---------------------------------------------------------------------------
// Variable calculada
// ---------------------------------------------------------------------------

export type CategoriaBorrador = { clave: string; codigo: string; etiqueta: string };

function formatoNumeroCorto(n: number): string {
  return Number.isInteger(n) ? formatoConteo(n) : String(Math.round(n * 100) / 100);
}

/**
 * Las variables que nombra una fórmula, en orden y sin repetir: nombres sueltos
 * («P8», «P10.88») o entre comillas invertidas («`x-1`»). La sintaxis completa
 * la valida el backend (`base_variables_formula.R`); aquí sólo se avisa de una
 * variable que la base no tiene antes de enviar.
 */
export function variablesDeFormula(expresion: string): string[] {
  const out: string[] = [];
  for (const m of expresion.matchAll(/`([^`]+)`|([A-Za-z_][A-Za-z0-9_.]*)/g)) {
    const v = (m[1] ?? m[2] ?? "").trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** La expresión con una variable añadida al final (entre comillas invertidas si lleva guion). */
export function insertarEnFormula(expresion: string, variable: string): string {
  const nombre = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(variable) ? variable : `\`${variable}\``;
  const actual = expresion.trimEnd();
  return actual ? `${actual} ${nombre}` : nombre;
}

export type BorradorCalculada = {
  /** Editando una guardada: el nombre es su clave y no cambia. */
  editando: boolean;
  nombre: string;
  etiqueta: string;
  regla: ReglaCalculada;
  alguna: { variables: string[]; codigosTexto: string };
  recodificar: {
    variable: string;
    escala: CategoriaBorrador[];
    /** `código de origen -> código de la escala`. */
    mapa: Record<string, string>;
    marcados: string[];
  };
  formula: { expresion: string };
};

function claveNueva(escala: readonly CategoriaBorrador[]): string {
  const max = escala.reduce((m, c) => Math.max(m, Number(c.clave.slice(1)) || 0), 0);
  return `c${max + 1}`;
}

function escalaBorrador(opciones: readonly OpcionBase[]): CategoriaBorrador[] {
  return opciones.map((o, i) => ({ clave: `c${i + 1}`, codigo: o.codigo, etiqueta: o.etiqueta }));
}

export function borradorCalculadaDesde(c: VariableCalculada | null): BorradorCalculada {
  const recod = c?.regla === "recodificar";
  const formula = c?.regla === "formula";
  return {
    editando: Boolean(c),
    nombre: c?.nombre ?? "",
    etiqueta: c?.etiqueta ?? "",
    regla: c?.regla ?? "alguna",
    alguna: {
      variables: c && !recod && !formula ? [...c.variables] : [],
      codigosTexto: c && !recod && !formula && c.codigos.length ? textoDeCodigos(c.codigos) : "1",
    },
    recodificar: {
      variable: recod ? c?.variables[0] ?? "" : "",
      escala: recod && c ? escalaBorrador(c.escala) : [],
      mapa: recod && c ? { ...c.mapa } : {},
      marcados: [],
    },
    formula: { expresion: c?.regla === "formula" ? c.expresion ?? "" : "" },
  };
}

export type AccionCalculada =
  | { tipo: "nombre"; valor: string }
  | { tipo: "etiqueta"; valor: string }
  | { tipo: "regla"; valor: ReglaCalculada }
  /** Las acciones del bloque «alguna» (`BaseCompuesta`); su `base` no importa aquí. */
  | { tipo: "alguna"; accion: AccionCompuesto }
  | { tipo: "origen"; variable: string }
  | { tipo: "expresion"; valor: string }
  | { tipo: "categoria-agregar" }
  | { tipo: "categoria-codigo"; clave: string; valor: string }
  | { tipo: "categoria-etiqueta"; clave: string; valor: string }
  | { tipo: "categoria-quitar"; clave: string }
  | { tipo: "copiar-opciones"; opciones: readonly OpcionBase[] }
  | { tipo: "destino"; codigos: readonly string[]; destino: string | null }
  | { tipo: "marcar"; codigo: string; marcado: boolean }
  | { tipo: "marcar-varios"; codigos: readonly string[] }
  | { tipo: "limpiar-marcas" };

function reducirAlguna(a: BorradorCalculada["alguna"], accion: AccionCompuesto): BorradorCalculada["alguna"] {
  switch (accion.tipo) {
    case "agregar":
      return !accion.variable || a.variables.includes(accion.variable)
        ? a
        : { ...a, variables: [...a.variables, accion.variable] };
    case "quitar":
      return { ...a, variables: a.variables.filter((v) => v !== accion.variable) };
    case "codigos":
      return { ...a, codigosTexto: accion.valor };
    case "alternar-codigo": {
      const actuales = parsearCodigos(a.codigosTexto);
      const siguiente = actuales.includes(accion.codigo)
        ? actuales.filter((c) => c !== accion.codigo)
        : [...actuales, accion.codigo];
      return { ...a, codigosTexto: textoDeCodigos(siguiente) };
    }
    default:
      return a;
  }
}

export function reducirCalculada(b: BorradorCalculada, a: AccionCalculada): BorradorCalculada {
  const r = b.recodificar;
  switch (a.tipo) {
    case "nombre":
      return b.editando ? b : { ...b, nombre: a.valor };
    case "etiqueta": {
      // Mientras el nombre siga siendo el propuesto (o esté vacío), acompaña a la
      // etiqueta: la persona escribe cómo se lee y el nombre técnico sale solo.
      const auto = !b.editando && (b.nombre === "" || b.nombre === nombreDesdeEtiqueta(b.etiqueta));
      return { ...b, etiqueta: a.valor, nombre: auto ? nombreDesdeEtiqueta(a.valor) : b.nombre };
    }
    case "regla":
      return { ...b, regla: a.valor };
    case "alguna":
      return { ...b, alguna: reducirAlguna(b.alguna, a.accion) };
    case "expresion":
      return { ...b, formula: { expresion: a.valor } };
    case "origen":
      return a.variable === r.variable
        ? b
        : { ...b, recodificar: { ...r, variable: a.variable, mapa: {}, marcados: [] } };
    case "categoria-agregar":
      return { ...b, recodificar: { ...r, escala: [...r.escala, { clave: claveNueva(r.escala), codigo: String(r.escala.length + 1), etiqueta: "" }] } };
    case "categoria-codigo": {
      const previa = r.escala.find((c) => c.clave === a.clave);
      if (!previa) return b;
      const nuevo = a.valor.trim();
      // Lo que caía en el código viejo sigue cayendo en la misma categoría.
      const mapa: Record<string, string> = {};
      for (const [origen, destino] of Object.entries(r.mapa)) {
        if (destino !== previa.codigo) mapa[origen] = destino;
        else if (nuevo) mapa[origen] = nuevo;
      }
      return {
        ...b,
        recodificar: { ...r, mapa, escala: r.escala.map((c) => (c.clave === a.clave ? { ...c, codigo: nuevo } : c)) },
      };
    }
    case "categoria-etiqueta":
      return { ...b, recodificar: { ...r, escala: r.escala.map((c) => (c.clave === a.clave ? { ...c, etiqueta: a.valor } : c)) } };
    case "categoria-quitar": {
      const quitada = r.escala.find((c) => c.clave === a.clave);
      if (!quitada) return b;
      const mapa = Object.fromEntries(Object.entries(r.mapa).filter(([, d]) => d !== quitada.codigo));
      return { ...b, recodificar: { ...r, mapa, escala: r.escala.filter((c) => c.clave !== a.clave) } };
    }
    case "copiar-opciones":
      return {
        ...b,
        recodificar: {
          ...r,
          escala: escalaBorrador(a.opciones),
          // Copiar la lista de origen es el punto de partida «cada código a sí mismo».
          mapa: Object.fromEntries(a.opciones.map((o) => [o.codigo, o.codigo])),
          marcados: [],
        },
      };
    case "destino": {
      const mapa = { ...r.mapa };
      for (const c of a.codigos) {
        if (a.destino) mapa[c] = a.destino;
        else delete mapa[c];
      }
      return { ...b, recodificar: { ...r, mapa, marcados: r.marcados.filter((c) => !a.codigos.includes(c)) } };
    }
    case "marcar": {
      const sin = r.marcados.filter((c) => c !== a.codigo);
      return { ...b, recodificar: { ...r, marcados: a.marcado ? [...sin, a.codigo] : sin } };
    }
    case "marcar-varios":
      return { ...b, recodificar: { ...r, marcados: Array.from(new Set([...r.marcados, ...a.codigos])) } };
    case "limpiar-marcas":
      return { ...b, recodificar: { ...r, marcados: [] } };
  }
}

export type FilaRecodificacion = {
  codigo: string;
  etiqueta: string;
  destino: string | null;
  etiquetaDestino: string | null;
  sinMapa: boolean;
  /** Casos en la base, si se leyeron de la data. */
  n: number | null;
};

/** Un código de la pregunta de origen; `n` si se leyó de la data. */
export type OpcionDeOrigen = OpcionBase & { n?: number | null };

/** Cada código de la pregunta de origen y la categoría en que cae. */
export function filasRecodificacion(
  origen: readonly OpcionDeOrigen[],
  r: BorradorCalculada["recodificar"],
): FilaRecodificacion[] {
  return origen.map((o) => {
    const d = r.mapa[o.codigo] ?? null;
    const categoria = d ? r.escala.find((c) => c.codigo === d) : undefined;
    return {
      codigo: o.codigo,
      etiqueta: o.etiqueta,
      destino: categoria ? d : null,
      etiquetaDestino: categoria ? categoria.etiqueta || categoria.codigo : null,
      sinMapa: !categoria,
      n: o.n ?? null,
    };
  });
}

/** Sin mayúsculas ni separadores: la comparación que hace el backend. */
function plano(nombre: string): string {
  return nombre.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const NOMBRE_VALIDO = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/**
 * Lo que impide guardar, en el orden en que se lee el formulario. `ocupados`
 * son los nombres que ya existen en la base (preguntas, columnas y las otras
 * calculadas); el backend vuelve a comprobarlo.
 */
export function validarCalculada(
  b: BorradorCalculada,
  ocupados: readonly string[],
  opcionesOrigen: readonly OpcionBase[] = [],
): string[] {
  const errores: string[] = [];
  const nombre = b.nombre.trim();
  if (!nombre) errores.push("Falta el nombre de la variable.");
  else if (!NOMBRE_VALIDO.test(nombre)) errores.push("El nombre empieza con una letra y usa sólo letras, dígitos, «_», «.» o «-».");
  else if (!b.editando && ocupados.some((o) => plano(o) === plano(nombre))) errores.push(`«${nombre}» ya existe en la base.`);
  if (!b.etiqueta.trim()) errores.push("Falta la etiqueta.");
  if (b.regla === "formula") {
    const variables = variablesDeFormula(b.formula.expresion);
    if (!b.formula.expresion.trim()) errores.push("Escribe la fórmula.");
    else if (variables.length === 0) errores.push("La fórmula tiene que usar al menos una variable de la base.");
    if (variables.some((v) => plano(v) === plano(nombre))) errores.push("La variable no puede calcularse a partir de sí misma.");
    const conocidas = new Set(ocupados.map(plano));
    const faltan = variables.filter((v) => !conocidas.has(plano(v)));
    if (faltan.length) errores.push(`La base no tiene ${faltan.map((v) => `«${v}»`).join(", ")}.`);
    return errores;
  }
  if (b.regla === "alguna") {
    if (b.alguna.variables.length === 0) errores.push("Elige al menos una pregunta.");
    else if (parsearCodigos(b.alguna.codigosTexto).length === 0) errores.push("Indica qué códigos cuentan como «sí».");
    if (b.alguna.variables.some((v) => plano(v) === plano(nombre))) errores.push("La variable no puede calcularse a partir de sí misma.");
    return errores;
  }
  const r = b.recodificar;
  if (!r.variable) errores.push("Elige la pregunta que se recodifica.");
  if (r.escala.length === 0) errores.push("Define al menos una categoría de la escala nueva.");
  const codigos = r.escala.map((c) => c.codigo.trim());
  if (codigos.some((c) => !c)) errores.push("Cada categoría necesita su código.");
  else if (new Set(codigos).size !== codigos.length) errores.push("Hay códigos repetidos en la escala nueva.");
  if (r.escala.some((c) => !c.etiqueta.trim())) errores.push("Cada categoría necesita su etiqueta.");
  if (r.variable && filasRecodificacion(opcionesOrigen, r).every((f) => f.sinMapa)) {
    errores.push("Asigna al menos un código de origen a una categoría.");
  }
  return errores;
}

/** El cuerpo del POST. En `recodificar`, el mapa sólo lleva códigos con destino. */
export function calculadaParaGuardar(b: BorradorCalculada): CalculadaADeclarar {
  const base = { nombre: b.nombre.trim(), etiqueta: b.etiqueta.trim() };
  if (b.regla === "formula") {
    const expresion = b.formula.expresion.trim();
    return { ...base, regla: "formula", expresion, variables: variablesDeFormula(expresion) };
  }
  if (b.regla === "alguna") {
    return { ...base, regla: "alguna", variables: [...b.alguna.variables], codigos: parsearCodigos(b.alguna.codigosTexto) };
  }
  const r = b.recodificar;
  const escala = r.escala.map((c) => ({ codigo: c.codigo.trim(), etiqueta: c.etiqueta.trim() }));
  const validos = new Set(escala.map((c) => c.codigo));
  const mapa = Object.fromEntries(Object.entries(r.mapa).filter(([, d]) => validos.has(d)));
  return { ...base, regla: "recodificar", variables: r.variable ? [r.variable] : [], mapa, escala };
}

/**
 * Preguntas de la base que una calculada puede usar: las del catálogo, incluidas
 * las calculadas declaradas antes (una fórmula y luego su recodificación en
 * rangos), salvo la que se está editando y las declaradas después de ella: se
 * calculan en orden y el backend sólo ve las anteriores.
 */
export function preguntasUsables(
  catalogo: readonly VariableDeBase[],
  calculadas: readonly Pick<VariableCalculada, "nombre">[],
  editando: string | null = null,
): VariableDeBase[] {
  const posicion = editando ? calculadas.findIndex((c) => c.nombre === editando) : -1;
  const fuera = new Set(posicion >= 0 ? calculadas.slice(posicion).map((c) => c.nombre) : []);
  return catalogo.filter((v) => !fuera.has(v.name));
}

/** Nombres que una calculada nueva no puede tomar. */
export function nombresOcupados(
  datos: Pick<BaseVariables, "extras" | "calculadas">,
  catalogo: readonly VariableDeBase[],
): string[] {
  return Array.from(new Set([
    ...catalogo.map((v) => v.name),
    ...datos.extras.map((c) => c.name),
    ...datos.calculadas.map((c) => c.nombre),
  ]));
}

/**
 * Los códigos de la pregunta de origen: los que la data trae, con sus casos
 * (`GET /api/carga/codigos-observados`), más las opciones que nadie eligió.
 * Sin observados, la lista del catálogo y, sin ella, los códigos del mapa guardado.
 */
export function opcionesDeOrigen(
  catalogo: readonly VariableDeBase[],
  variable: string,
  mapa: Readonly<Record<string, string>>,
  observados: CodigosObservados | null = null,
): OpcionDeOrigen[] {
  const delCatalogo = catalogo.find((o) => o.name === variable)?.opciones ?? [];
  const reales = codigosConObservados(delCatalogo, observados);
  if (reales) return reales;
  if (delCatalogo.length) return delCatalogo.map((o) => ({ codigo: o.codigo, etiqueta: o.etiqueta }));
  return Object.keys(mapa).map((codigo) => ({ codigo, etiqueta: "" }));
}

/**
 * Nombre técnico propuesto desde la etiqueta: minúsculas, sin tildes, palabras
 * unidas por «_», sin conectores, a lo sumo `max` caracteres (32) y empezando por
 * letra. Los segmentos de cruce (ADR 0107) lo usan con menos, para su prefijo.
 * «VBG: recurrió a alguna instancia de la PUCP» → «vbg_recurrio_alguna_instancia».
 */
const CONECTORES = new Set(["a", "al", "de", "del", "la", "las", "el", "los", "en", "y", "o", "u", "e", "con", "por", "para", "que", "se", "su", "sus"]);

export function nombreDesdeEtiqueta(etiqueta: string, max = 32): string {
  const palabras = etiqueta
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !CONECTORES.has(w));
  let out = "";
  for (const w of palabras) {
    const siguiente = out ? `${out}_${w}` : w;
    if (siguiente.length > max) break;
    out = siguiente;
  }
  if (!out) return "";
  return /^[a-z]/.test(out) ? out : `v_${out}`.slice(0, max);
}
