// Gramática de la entrada rápida (ADR 0047).
//
// La métrica de éxito de la bitácora es que escribir cueste menos que no
// escribir. Cuatro selectores antes de poder teclear garantizan que nadie la
// use, así que el tono, el módulo y las etiquetas se declaran EN LÍNEA mientras
// se escribe y todos tienen default:
//
//   Se cayó el enlace de Kobo !bloqueo @monitoreo #campo
//
// Nada es obligatorio. Sin tokens, la entrada se guarda igual como nota del
// proyecto: el tipo se sugiere, nunca bloquea el guardado.
//
// Puro y sin React para poder probarlo en Node, que es lo único que vitest
// permite en este repo.

import type { DisenoEstudioBitacoraTone } from "../../../api/disenoEstudio";

export const TONOS: ReadonlyArray<{ id: DisenoEstudioBitacoraTone; label: string }> = [
  { id: "nota", label: "Nota" },
  { id: "decision", label: "Decisión" },
  { id: "avance", label: "Avance" },
  { id: "riesgo", label: "Riesgo" },
  { id: "bloqueo", label: "Bloqueo" },
];

/** Alias que la gente escribe de verdad, mapeados al vocabulario cerrado. */
const ALIAS_TONO: Readonly<Record<string, DisenoEstudioBitacoraTone>> = {
  nota: "nota",
  decision: "decision",
  decisión: "decision",
  avance: "avance",
  riesgo: "riesgo",
  bloqueo: "bloqueo",
  bloqueado: "bloqueo",
  incidencia: "riesgo",
  problema: "riesgo",
  acuerdo: "decision",
};

export const MODULOS_BITACORA: ReadonlyArray<{ id: string; label: string }> = [
  { id: "diseno-estudio", label: "Bitácora" },
  { id: "calc-muestra", label: "Muestra" },
  { id: "editor-xlsform", label: "Formulario" },
  { id: "hojas-ruta", label: "Rutas" },
  { id: "recopiladores", label: "Fichas QR" },
  { id: "monitoreo", label: "Monitoreo" },
  { id: "carga", label: "Carga" },
  { id: "validacion", label: "Validación" },
  { id: "codificacion", label: "Codificación" },
  { id: "analitica", label: "Analítica" },
  { id: "graficos", label: "Gráficos" },
  { id: "dashboard", label: "Dashboard" },
  { id: "proyecto", label: "Proyecto" },
];

const ALIAS_MODULO: Readonly<Record<string, string>> = {
  muestra: "calc-muestra",
  "calc-muestra": "calc-muestra",
  formulario: "editor-xlsform",
  formularios: "editor-xlsform",
  xlsform: "editor-xlsform",
  rutas: "hojas-ruta",
  "hojas-ruta": "hojas-ruta",
  qr: "recopiladores",
  recopiladores: "recopiladores",
  monitoreo: "monitoreo",
  campo: "monitoreo",
  carga: "carga",
  validacion: "validacion",
  codificacion: "codificacion",
  analitica: "analitica",
  graficos: "graficos",
  dashboard: "dashboard",
  tablero: "dashboard",
  proyecto: "proyecto",
  bitacora: "diseno-estudio",
};

export type EntradaInterpretada = {
  /** El texto sin los tokens: lo que queda como contenido. */
  texto: string;
  titulo: string;
  cuerpo: string;
  tono: DisenoEstudioBitacoraTone;
  moduloId: string;
  etiquetas: string[];
  /** Tokens reconocidos, para pintarlos como chips mientras se escribe. */
  reconocidos: Array<{ tipo: "tono" | "modulo" | "etiqueta"; crudo: string; valor: string }>;
};

function normalizar(token: string): string {
  return token
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Interpreta el texto crudo del campo.
 *
 * Un token solo cuenta si su valor se reconoce: `!urgentísimo` no es un tono
 * válido, así que se deja en el texto en vez de desaparecer. Tragarse en
 * silencio lo que el usuario escribió es peor que ignorar el atajo.
 */
export function interpretarEntrada(crudo: string): EntradaInterpretada {
  const reconocidos: EntradaInterpretada["reconocidos"] = [];
  let tono: DisenoEstudioBitacoraTone = "nota";
  let moduloId = "diseno-estudio";
  const etiquetas: string[] = [];

  const restante = crudo.replace(/(^|\s)([!@#])([\p{L}\p{N}_-]+)/gu, (match, espacio, marca, valor) => {
    const clave = normalizar(valor);

    if (marca === "!") {
      const encontrado = ALIAS_TONO[clave];
      if (!encontrado) return match;
      tono = encontrado;
      reconocidos.push({ tipo: "tono", crudo: `!${valor}`, valor: encontrado });
      return espacio;
    }

    if (marca === "@") {
      const encontrado = ALIAS_MODULO[clave];
      if (!encontrado) return match;
      moduloId = encontrado;
      reconocidos.push({ tipo: "modulo", crudo: `@${valor}`, valor: encontrado });
      return espacio;
    }

    // Las etiquetas son libres por definición: cualquier `#loquesea` vale.
    if (!etiquetas.includes(clave)) etiquetas.push(clave);
    reconocidos.push({ tipo: "etiqueta", crudo: `#${valor}`, valor: clave });
    return espacio;
  });

  const texto = restante.replace(/[ \t]{2,}/g, " ").trim();
  const lineas = texto.split("\n");
  const primera = (lineas[0] ?? "").trim();
  const resto = lineas.slice(1).join("\n").trim();

  // Con una sola línea, ésta es el título y el cuerpo queda vacío: obligar a
  // llenar ambos convertiría la entrada rápida en un formulario.
  return {
    texto,
    titulo: primera || "Nota de bitácora",
    cuerpo: resto,
    tono,
    moduloId,
    etiquetas: etiquetas.slice(0, 8),
    reconocidos,
  };
}

/** Hay algo que guardar. Un texto de solo tokens no es una entrada. */
export function tieneContenido(crudo: string): boolean {
  return interpretarEntrada(crudo).texto.length > 0;
}

export function etiquetaTono(tono: string): string {
  return TONOS.find((t) => t.id === tono)?.label ?? tono;
}

export function etiquetaModulo(id: string): string {
  return MODULOS_BITACORA.find((m) => m.id === id)?.label ?? id;
}
