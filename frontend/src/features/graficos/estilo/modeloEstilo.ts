// Modelo puro de la pestaña «Estilo del cliente» (A6 R3; ADR 0094 §4 y decisión 5a). Sin React ni store: el componente
// lee el estilo del store, deriva aquí la procedencia y escribe con las funciones de cambio, que devuelven un estilo nuevo
// (nunca mutan el de entrada).
//
// Procedencia derivada, no guardada: un bloque es «Propio» cuando difiere del default (recetario + perfil del catálogo,
// que declara el GET en `defaults.estilo_cliente`); si no, «Del recetario». «Volver al recetario» borra la clave.
// Espejo de `.graficos_estilo_cliente_solo_decisiones` (api/R/graficos_estilo_cliente.R).

import {
  ESTILO_LUGARES_LOGO,
  ESTILO_ROLES,
  estiloClienteRecetario,
  type EstiloAmbito,
  type EstiloCliente,
  type EstiloLogoRef,
  type EstiloLugarLogo,
  type EstiloOpcionPaso,
  type EstiloOpcionRol,
  type EstiloPaso,
  type EstiloRol,
} from "../../../api/graficosEstilo";

export type Procedencia = "recetario" | "propio";

export type DecisionesEstilo = {
  logos: Partial<Record<EstiloLugarLogo, EstiloLogoRef>>;
  paso?: EstiloPaso;
  roles: Partial<Record<EstiloRol, EstiloPaso>>;
};

/** El default contra el que se compara: el del GET si llegó, si no el espejo del recetario. */
export function referenciaEstilo(defaults: EstiloCliente | null | undefined): EstiloCliente {
  return defaults ?? estiloClienteRecetario();
}

function pasoDefault(ref: EstiloCliente): EstiloPaso {
  return ref.letra?.paso ?? "estandar";
}

/** Paso efectivo de la letra global: el elegido o, si no hay, el del default. */
export function pasoEfectivo(estilo: EstiloCliente, ref: EstiloCliente): EstiloPaso {
  return estilo.letra?.paso ?? pasoDefault(ref);
}

/** Paso efectivo de un rol: el propio, el del default para ese rol o el global efectivo. */
export function pasoEfectivoRol(estilo: EstiloCliente, ref: EstiloCliente, rol: EstiloRol): EstiloPaso {
  return estilo.letra?.roles?.[rol] ?? ref.letra?.roles?.[rol] ?? pasoEfectivo(estilo, ref);
}

/** Sólo lo que difiere del default (decisión 5a). Un bloque ausente del resultado es «Del recetario». */
export function decisionesEstilo(estilo: EstiloCliente, defaults: EstiloCliente | null | undefined): DecisionesEstilo {
  const ref = referenciaEstilo(defaults);
  const out: DecisionesEstilo = { logos: {}, roles: {} };
  for (const lugar of ESTILO_LUGARES_LOGO) {
    const actual = estilo.logos?.[lugar];
    if (actual?.file_id && actual.file_id !== ref.logos?.[lugar]?.file_id) out.logos[lugar] = actual;
  }
  const paso = estilo.letra?.paso;
  if (paso && paso !== pasoDefault(ref)) out.paso = paso;
  const global = pasoEfectivo(estilo, ref);
  for (const rol of ESTILO_ROLES) {
    const p = estilo.letra?.roles?.[rol];
    const heredado = ref.letra?.roles?.[rol] ?? global;
    if (p && p !== heredado) out.roles[rol] = p;
  }
  return out;
}

export function procedenciaLogo(d: DecisionesEstilo, lugar: EstiloLugarLogo): Procedencia {
  return d.logos[lugar] ? "propio" : "recetario";
}

export function procedenciaPaso(d: DecisionesEstilo): Procedencia {
  return d.paso ? "propio" : "recetario";
}

export function procedenciaRol(d: DecisionesEstilo, rol: EstiloRol): Procedencia {
  return d.roles[rol] ? "propio" : "recetario";
}

/** «Modificado» de cada sección: algún bloque propio. */
export function logosModificados(d: DecisionesEstilo): boolean {
  return Object.keys(d.logos).length > 0;
}

export function letraModificada(d: DecisionesEstilo): boolean {
  return !!d.paso || Object.keys(d.roles).length > 0;
}

// --- Cambios (puros) -----------------------------------------------------------------------------------------------------

/**
 * Cambia el ámbito llevando el estilo que el usuario estaba viendo: el backend lo copia al portador nuevo sin perder el
 * anterior (graficos_estilo_cliente.R, cabecera «ÁMBITO»).
 */
export function conAmbito(estilo: EstiloCliente, ambito: EstiloAmbito): EstiloCliente {
  return { ...estilo, ambito };
}

export function conLogo(estilo: EstiloCliente, lugar: EstiloLugarLogo, logo: EstiloLogoRef): EstiloCliente {
  return { ...estilo, logos: { ...(estilo.logos ?? {}), [lugar]: logo } };
}

/** «Volver al recetario» del logo de un lugar: borra la clave. */
export function sinLogo(estilo: EstiloCliente, lugar: EstiloLugarLogo): EstiloCliente {
  const logos = { ...(estilo.logos ?? {}) };
  delete logos[lugar];
  return { ...estilo, logos };
}

export function conNombreLogo(estilo: EstiloCliente, lugar: EstiloLugarLogo, nombre: string): EstiloCliente {
  const actual = estilo.logos?.[lugar];
  if (!actual) return estilo;
  const limpio = nombre.trim();
  const siguiente: EstiloLogoRef = limpio ? { file_id: actual.file_id, nombre: limpio } : { file_id: actual.file_id };
  return conLogo(estilo, lugar, siguiente);
}

export function conPaso(estilo: EstiloCliente, paso: EstiloPaso): EstiloCliente {
  return { ...estilo, letra: { ...(estilo.letra ?? {}), paso } };
}

/** «Volver al recetario» del tamaño general: borra `letra.paso` (los ajustes por elemento siguen). */
export function sinPaso(estilo: EstiloCliente): EstiloCliente {
  const letra = { ...(estilo.letra ?? {}) };
  delete letra.paso;
  return { ...estilo, letra };
}

export function conRol(estilo: EstiloCliente, rol: EstiloRol, paso: EstiloPaso): EstiloCliente {
  const letra = estilo.letra ?? {};
  return { ...estilo, letra: { ...letra, roles: { ...(letra.roles ?? {}), [rol]: paso } } };
}

/** «Volver al recetario» de un elemento: borra `letra.roles.<rol>` y el elemento vuelve a seguir el tamaño general. */
export function sinRol(estilo: EstiloCliente, rol: EstiloRol): EstiloCliente {
  const letra = estilo.letra ?? {};
  const roles = { ...(letra.roles ?? {}) };
  delete roles[rol];
  return { ...estilo, letra: { ...letra, roles } };
}

/** «Volver al recetario» de toda la letra: borra la clave `letra`. */
export function sinLetra(estilo: EstiloCliente): EstiloCliente {
  const out = { ...estilo };
  delete out.letra;
  return out;
}

/** «Volver al recetario» de todos los logos: borra la clave `logos`. */
export function sinLogos(estilo: EstiloCliente): EstiloCliente {
  const out = { ...estilo };
  delete out.logos;
  return out;
}

// --- Rótulos -------------------------------------------------------------------------------------------------------------

export const ETIQUETA_AMBITO: Record<EstiloAmbito, { titulo: string; explicacion: string }> = {
  proyecto: {
    titulo: "Todo el proyecto",
    explicacion: "Un solo estilo para todas las bases: cada informe del estudio sale con los mismos logos y la misma letra.",
  },
  base: {
    titulo: "Cada base",
    explicacion: "Cada base guarda el suyo, como sus paletas. Sirve cuando cada base es un estudio con su propio cliente.",
  },
};

export const ETIQUETA_PASO: Record<EstiloPaso, string> = {
  estandar: "Estándar",
  grande: "Grande",
  muy_grande: "Muy grande",
};

export const ETIQUETA_ROL: Record<EstiloRol, string> = {
  titulos: "Títulos",
  preguntas: "Preguntas y premisas",
  cifras: "Cifras",
  rotulos: "Rótulos y leyenda",
  base: "Base y notas",
};

export const ETIQUETA_LUGAR: Record<EstiloLugarLogo, string> = {
  portada_izquierda: "Portada, izquierda",
  portada_derecha: "Portada, derecha",
  contraportada: "Contraportada",
};

const ETIQUETA_TOKEN_WORD: Record<string, string> = {
  titulo_1: "Título de capítulo",
  titulo_2: "Subtítulo",
  numero_capitulo: "Número de capítulo",
  lectura: "Lectura",
  cuerpo: "Cuerpo",
  toc_1: "Índice",
  toc_2: "Índice, segundo nivel",
  grafico_cifra: "Cifra del gráfico",
  rotulo: "Rótulo de figura",
  grafico_rotulo: "Rótulo del gráfico",
  grafico_leyenda: "Leyenda del gráfico",
  base: "Base",
};

export function etiquetaToken(token: string): string {
  return ETIQUETA_TOKEN_WORD[token] ?? token.replace(/_/g, " ");
}

function pt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

export type TamanoRol = { token: string; etiqueta: string; recetario: number; final: number; texto: string };

/**
 * Tamaños del Word de un rol con el paso aplicado, para leer «16 pt = 14 + 2». Sale del catálogo de `/opciones`; sin él
 * la lista queda vacía y la UI lo dice en vez de inventar medidas.
 */
export function tamanosRol(rol: EstiloOpcionRol | undefined, paso: EstiloPaso, pasos: readonly EstiloOpcionPaso[]): TamanoRol[] {
  if (!rol) return [];
  const d = pasos.find((p) => p.id === paso)?.desplazamientoPt ?? 0;
  return Object.entries(rol.word).map(([token, recetario]) => {
    const final = recetario + d;
    return {
      token,
      etiqueta: etiquetaToken(token),
      recetario,
      final,
      texto: d === 0 ? `${pt(final)} pt` : `${pt(final)} pt = ${pt(recetario)} + ${pt(d)}`,
    };
  });
}
