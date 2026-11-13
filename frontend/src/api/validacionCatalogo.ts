// Catálogo de reglas de Validación (contrato M3, `GET /api/validacion/v2/reglas/catalogo`).
//
// Esta primera entrega lee solo lo que usa el panel de regla (rebanada V2):
//   - cuántas reglas del formulario quedaron sin evaluar ("2 reglas del
//     formulario sin evaluar"), por familia y origen;
//   - las preguntas que nombran las frases del catálogo (código, etiqueta y
//     tipo), para armar una regla cuando la base todavía no tiene respuestas y
//     el inventario de Explorar no responde.
// El normalizador es defensivo: una cifra ausente queda en `null`, no en 0.
//
// La mesa de Reglas (rebanada V1) lee el catálogo entero con
// `pedirCatalogoCompleto`, que no descarta ninguna regla.

import { apiFetch, handle, headers } from "./core";
import { booleano, enteroONulo, lista, numeroONulo, registro, texto } from "./normalizarR";

export type TipoDeFichaDelCatalogo = "unica" | "multiple" | "numerica" | "texto";

export type FamiliaDelCatalogo = {
  origen: string;
  familia: string;
  nombre: string;
  n: number | null;
  n_sin_evaluar: number | null;
};

export type PreguntaDelCatalogo = { codigo: string; etiqueta: string | null; tipo: TipoDeFichaDelCatalogo };

export type CatalogoDeReglas = {
  plan_construido: boolean;
  n_total: number | null;
  n_sin_evaluar: number | null;
  familias: FamiliaDelCatalogo[];
  /** Las preguntas de las frases, sin repetir, en el orden en que aparecen. */
  preguntas: PreguntaDelCatalogo[];
};

const TIPOS: readonly TipoDeFichaDelCatalogo[] = ["unica", "multiple", "numerica", "texto"];

export function normalizarCatalogoDeReglas(value: unknown): CatalogoDeReglas {
  const r = registro(value);
  const preguntas = new Map<string, PreguntaDelCatalogo>();
  for (const regla of lista(r.reglas)) {
    for (const ficha of lista(regla.frase)) {
      const codigo = texto(ficha.pregunta);
      if (!codigo || preguntas.has(codigo)) continue;
      const etiqueta = texto(ficha.etiqueta);
      const tipo = texto(ficha.tipo);
      preguntas.set(codigo, {
        codigo,
        etiqueta: etiqueta && etiqueta !== codigo ? etiqueta : null,
        tipo: (TIPOS as readonly string[]).includes(tipo) ? (tipo as TipoDeFichaDelCatalogo) : "texto",
      });
    }
  }
  return {
    plan_construido: booleano(r.plan_construido),
    n_total: enteroONulo(r.n_total),
    n_sin_evaluar: enteroONulo(r.n_sin_evaluar),
    familias: lista(r.familias).map((f) => ({
      origen: texto(f.origen),
      familia: texto(f.familia),
      nombre: texto(f.nombre),
      n: enteroONulo(f.n),
      n_sin_evaluar: enteroONulo(f.n_sin_evaluar),
    })),
    preguntas: [...preguntas.values()],
  };
}

/** Las reglas del formulario sin evaluar; `null` si el catálogo no trae la cifra de ninguna familia del formulario. */
export function sinEvaluarDelFormulario(catalogo: CatalogoDeReglas): number | null {
  const delFormulario = catalogo.familias.filter((f) => f.origen === "formulario" && f.n_sin_evaluar !== null);
  if (!delFormulario.length) return null;
  return delFormulario.reduce((suma, f) => suma + (f.n_sin_evaluar ?? 0), 0);
}

export async function apiCatalogoDeReglas(baseNombre?: string | null): Promise<CatalogoDeReglas> {
  const h = headers();
  if (baseNombre) h["X-Base-Nombre"] = baseNombre;
  const crudo = await handle<unknown>(await apiFetch("/api/validacion/v2/reglas/catalogo", { headers: h }));
  return normalizarCatalogoDeReglas(crudo);
}

// --- Catálogo entero (la mesa de Reglas, rebanada V1) -------------------------------------------------------------------

export type OrigenDeRegla = "formulario" | "operativo" | "propia";

export type PiezaDelCatalogo =
  | { tipo: "texto"; texto: string }
  | { tipo: "pregunta"; codigo: string; etiqueta: string | null; tipoPregunta: TipoDeFichaDelCatalogo }
  | { tipo: "valor"; valor: string; codigo: string | null };

export type UltimaAuditoriaDeRegla = {
  n_casos: number | null;
  n_base: number | null;
  /** En llano, para escribir después de la cifra de la base: "a quienes les correspondía responder". */
  base_definicion: string | null;
  /** De 0 a 1, `n_casos / n_base`; `null` si la base es 0 o no se pudo contar. */
  porcentaje: number | null;
  nivel: "caso" | "registro";
  n_decididos: number | null;
};

export type ReglaDelCatalogo = {
  id: string;
  /** El id de la auditoría, de la cola y del PATCH de activación; `null` en lo que no llegó a ser regla. */
  id_motor: string | null;
  origen: OrigenDeRegla;
  familia: string;
  familia_nombre: string;
  nombre: string;
  frase: PiezaDelCatalogo[];
  frase_completa: boolean;
  clase: "inconsistencia" | "caso_a_revisar";
  tratamiento: { accion: string | null; alcance: string | null };
  activa: boolean;
  motivo_desactivada: string | null;
  se_puede_desactivar: boolean;
  variable_revisada: string | null;
  variables: string[];
  tabla: string | null;
  expresion_formulario: string | null;
  direccion: "debe" | "nodebe" | null;
  pareja: string | null;
  estado_evaluacion: "evaluada" | "sin_evaluar";
  causa_codigo: string | null;
  causa: string | null;
  ultima_auditoria: UltimaAuditoriaDeRegla | null;
  /**
   * De dónde salió una regla propia que propuso un sembrador
   * ("detector_consistencia", "dominio"...); `null` si la escribió el equipo o
   * es del formulario. Opcional: un motor anterior no lo publica.
   */
  semilla_origen?: string | null;
};

export type FamiliaDelCatalogoCompleto = {
  origen: OrigenDeRegla;
  familia: string;
  nombre: string;
  n: number;
  n_activas: number | null;
  n_sin_evaluar: number | null;
};

export type AvisoDelCatalogo = {
  codigo: string;
  texto: string;
  /** La regla (id del motor) de un aviso que es de una sola regla. */
  id_regla: string | null;
  /** Las reglas de un aviso que nombra varias. */
  ids: string[];
};

export type CatalogoCompleto = {
  plan_construido: boolean;
  auditada_en: string | null;
  n_total: number | null;
  n_activas: number | null;
  n_sin_evaluar: number | null;
  por_origen: Record<OrigenDeRegla, number | null>;
  familias: FamiliaDelCatalogoCompleto[];
  reglas: ReglaDelCatalogo[];
  avisos: AvisoDelCatalogo[];
};

// --- Normalización -----------------------------------------------------------

const ORIGENES: readonly OrigenDeRegla[] = ["formulario", "operativo", "propia"];


/** El origen leído, o `null` si el motor manda uno que la pantalla no conoce. */
function origenLeido(valor: unknown): OrigenDeRegla | null {
  const crudo = texto(valor);
  return (ORIGENES as readonly string[]).includes(crudo) ? (crudo as OrigenDeRegla) : null;
}

function textoONulo(valor: unknown): string | null {
  const t = texto(valor);
  return t ? t : null;
}

/** El texto de una pieza de la frase, con sus espacios: las piezas se concatenan tal cual. */
function textoCrudo(valor: unknown): string {
  const v = Array.isArray(valor) && valor.length === 1 ? valor[0] : valor;
  return typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

function textos(valor: unknown): string[] {
  const crudo = Array.isArray(valor) ? valor : valor === null || valor === undefined ? [] : [valor];
  return crudo.map((v) => texto(v)).filter(Boolean);
}

function normalizarPieza(valor: Record<string, unknown>): PiezaDelCatalogo | null {
  const pregunta = texto(valor.pregunta);
  if (pregunta) {
    const etiqueta = texto(valor.etiqueta);
    const tipo = texto(valor.tipo);
    return {
      tipo: "pregunta",
      codigo: pregunta,
      etiqueta: etiqueta && etiqueta !== pregunta ? etiqueta : null,
      tipoPregunta: (TIPOS as readonly string[]).includes(tipo) ? (tipo as TipoDeFichaDelCatalogo) : "texto",
    };
  }
  if (valor.valor !== undefined && valor.valor !== null) {
    return { tipo: "valor", valor: textoCrudo(valor.valor), codigo: textoONulo(valor.codigo) };
  }
  const t = textoCrudo(valor.texto);
  return t ? { tipo: "texto", texto: t } : null;
}

function normalizarUltimaAuditoria(valor: unknown): UltimaAuditoriaDeRegla | null {
  const r = registro(valor);
  if (!Object.keys(r).length) return null;
  const porcentaje = numeroONulo(r.porcentaje);
  return {
    n_casos: enteroONulo(r.n_casos),
    n_base: enteroONulo(r.n_base),
    base_definicion: textoONulo(r.base_definicion),
    porcentaje: porcentaje === null ? null : Math.min(Math.max(porcentaje, 0), 1),
    nivel: texto(r.nivel) === "registro" ? "registro" : "caso",
    n_decididos: enteroONulo(r.n_decididos),
  };
}

/**
 * Una regla, sin descartarla nunca: sin id lleva uno de posición (solo para
 * la lista y la dirección; no se puede activar ni desactivar) y con un origen
 * desconocido va con las del formulario. Las dos cosas se avisan en el
 * catálogo (`avisos`), no se callan.
 */
function normalizarRegla(valor: Record<string, unknown>, posicion: number): ReglaDelCatalogo & { anomalia: "sin_id" | "origen" | null } {
  const idLeido = texto(valor.id);
  const id = idLeido || `sin-id-${posicion + 1}`;
  const origen = origenLeido(valor.origen);
  const tratamiento = registro(valor.tratamiento_previsto);
  const direccion = texto(valor.direccion);
  const variables = textos(valor.variables);
  const revisada = textoONulo(valor.variable_revisada);
  return {
    id,
    id_motor: idLeido ? textoONulo(valor.id_motor) : null,
    origen: origen ?? "formulario",
    familia: texto(valor.familia),
    familia_nombre: texto(valor.familia_nombre),
    nombre: texto(valor.nombre) || id,
    frase: lista(valor.frase).map(normalizarPieza).filter((p): p is PiezaDelCatalogo => p !== null),
    // Sin el campo, la frase se da por completa: el motor solo lo publica en falso cuando falta una parte.
    frase_completa: valor.frase_completa === undefined ? true : booleano(valor.frase_completa),
    clase: texto(valor.clase) === "caso_a_revisar" ? "caso_a_revisar" : "inconsistencia",
    tratamiento: { accion: textoONulo(tratamiento.accion), alcance: textoONulo(tratamiento.alcance) },
    activa: booleano(valor.activa),
    motivo_desactivada: textoONulo(valor.motivo_desactivada),
    se_puede_desactivar: !idLeido ? false : valor.se_puede_desactivar === undefined ? true : booleano(valor.se_puede_desactivar),
    variable_revisada: revisada ?? variables[0] ?? null,
    variables,
    tabla: textoONulo(valor.tabla),
    expresion_formulario: textoONulo(valor.expresion_formulario),
    direccion: direccion === "debe" || direccion === "nodebe" ? direccion : null,
    pareja: textoONulo(valor.pareja),
    estado_evaluacion: texto(valor.estado_evaluacion) === "sin_evaluar" ? "sin_evaluar" : "evaluada",
    causa_codigo: textoONulo(valor.causa_codigo),
    causa: textoONulo(valor.causa),
    ultima_auditoria: normalizarUltimaAuditoria(valor.ultima_auditoria),
    semilla_origen: textoONulo(valor.semilla_origen),
    anomalia: !idLeido ? "sin_id" : origen === null ? "origen" : null,
  };
}

function avisosDeLectura(reglas: ReadonlyArray<{ anomalia: "sin_id" | "origen" | null }>): AvisoDelCatalogo[] {
  const sinId = reglas.filter((r) => r.anomalia === "sin_id").length;
  const origen = reglas.filter((r) => r.anomalia === "origen").length;
  const avisos: AvisoDelCatalogo[] = [];
  if (sinId) {
    avisos.push({
      codigo: "lectura_sin_id",
      texto: sinId === 1
        ? "1 regla llegó sin identificador: se muestra, pero no se puede activar ni desactivar."
        : `${sinId} reglas llegaron sin identificador: se muestran, pero no se pueden activar ni desactivar.`,
      id_regla: null,
      ids: [],
    });
  }
  if (origen) {
    avisos.push({
      codigo: "lectura_origen_desconocido",
      texto: origen === 1
        ? "1 regla llegó con un origen que la app no conoce: se muestra entre las del formulario."
        : `${origen} reglas llegaron con un origen que la app no conoce: se muestran entre las del formulario.`,
      id_regla: null,
      ids: [],
    });
  }
  return avisos;
}

export function normalizarCatalogoCompleto(valor: unknown): CatalogoCompleto {
  const r = registro(valor);
  const porOrigen = registro(r.por_origen);
  const leidas = lista(r.reglas).map(normalizarRegla);
  return {
    plan_construido: booleano(r.plan_construido),
    auditada_en: textoONulo(r.auditada_en),
    n_total: enteroONulo(r.n_total),
    n_activas: enteroONulo(r.n_activas),
    n_sin_evaluar: enteroONulo(r.n_sin_evaluar),
    por_origen: {
      formulario: enteroONulo(porOrigen.formulario),
      operativo: enteroONulo(porOrigen.operativo),
      propia: enteroONulo(porOrigen.propia),
    },
    // Una familia de origen desconocido va con las del formulario, como sus reglas.
    familias: lista(r.familias).map((f) => ({
      origen: origenLeido(f.origen) ?? "formulario",
      familia: texto(f.familia),
      nombre: texto(f.nombre) || texto(f.familia),
      n: enteroONulo(f.n) ?? 0,
      n_activas: enteroONulo(f.n_activas),
      n_sin_evaluar: enteroONulo(f.n_sin_evaluar),
    })),
    reglas: leidas.map(({ anomalia: _anomalia, ...regla }) => regla),
    avisos: [
      ...lista(r.avisos).map((a) => ({
        codigo: texto(a.codigo),
        texto: texto(a.texto),
        id_regla: textoONulo(a.id_regla),
        ids: textos(a.ids),
      })).filter((a) => a.texto),
      ...avisosDeLectura(leidas),
    ],
  };
}

export type LecturaDelCatalogo = {
  completo: CatalogoCompleto;
  /** La lectura del panel de regla (las preguntas de las frases), del mismo pedido. */
  ligero: CatalogoDeReglas;
};

/** El catálogo entero para la mesa de Reglas y, del mismo pedido, la lectura del panel de regla. */
export async function pedirCatalogoCompleto(baseNombre?: string | null): Promise<LecturaDelCatalogo> {
  const h = headers();
  if (baseNombre) h["X-Base-Nombre"] = baseNombre;
  const crudo = await handle<unknown>(await apiFetch("/api/validacion/v2/reglas/catalogo", { headers: h }));
  return { completo: normalizarCatalogoCompleto(crudo), ligero: normalizarCatalogoDeReglas(crudo) };
}
