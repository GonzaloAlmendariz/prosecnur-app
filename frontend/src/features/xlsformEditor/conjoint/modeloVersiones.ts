// Experimento de versiones al azar (split-sample) como bloque del editor (checklist elección por pares C12,
// 2026-11-07). A cada encuestado le toca una de varias redacciones de una misma pregunta; las respuestas quedan en una
// sola variable y la versión que le tocó, en otra:
//   - `<p>_r` = once(random()): el sorteo, una vez por entrevista;
//   - `<p>_version`: el código de la versión (equiprobable o con pesos);
//   - `<p>_texto`: la redacción de esa versión;
//   - la pregunta, con `${<p>_texto}` como enunciado.

import { fila, formulaNivel, formulaTexto, ref, type FilaSurveyConjoint, type NivelConjoint } from "./modeloConjoint";

export type TipoRespuestaVersiones = "select_one" | "integer" | "text";

export type DisenoVersiones = {
  prefijo: string;
  /** Código de la pregunta en la base: la respuesta queda en una sola variable, sea cual sea la versión. */
  pregunta: string;
  tipo: TipoRespuestaVersiones;
  /** Lista de opciones si la respuesta es una selección. */
  lista: string;
  obligatoria: boolean;
  /** Redacciones; el código de cada versión es su posición (1, 2, 3…). */
  versiones: { texto: string; peso?: number }[];
};

export type NombresVersiones = { azar: string; version: string; texto: string };

const NOMBRE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const nombresVersiones = (prefijo: string): NombresVersiones => ({
  azar: `${prefijo}_r`,
  version: `${prefijo}_version`,
  texto: `${prefijo}_texto`,
});

export const nivelesDeVersiones = (d: DisenoVersiones): NivelConjoint[] =>
  d.versiones.map((v, i) => ({ codigo: String(i + 1), texto: v.texto.trim(), ...(v.peso != null ? { peso: v.peso } : {}) }));

export function validarVersiones(d: DisenoVersiones, listas: readonly string[] = []): string[] {
  const out: string[] = [];
  if (!NOMBRE.test(d.prefijo)) out.push(`El prefijo «${d.prefijo}» no sirve como nombre de variable: usa letras, números y _.`);
  if (!NOMBRE.test(d.pregunta)) out.push("El código de la pregunta no sirve como nombre de variable: usa letras, números y _.");
  if (d.tipo === "select_one" && !d.lista.trim()) out.push("Elige la lista de opciones de la pregunta.");
  if (d.tipo === "select_one" && d.lista.trim() && listas.length && !listas.includes(d.lista.trim())) out.push(`La lista «${d.lista}» no existe en el formulario.`);
  if (d.versiones.length < 2) out.push("Hacen falta al menos dos versiones.");
  if (d.versiones.length > 10) out.push("Van a lo más diez versiones.");
  d.versiones.forEach((v, i) => { if (!v.texto.trim()) out.push(`La versión ${i + 1} no tiene texto.`); });
  const textos = d.versiones.map((v) => v.texto.trim()).filter(Boolean);
  if (new Set(textos).size !== textos.length) out.push("Dos versiones dicen lo mismo.");
  const pesos = d.versiones.map((v) => v.peso);
  const con = pesos.filter((p) => p != null);
  if (con.length && con.length !== pesos.length) out.push("O todas las versiones llevan peso o ninguna.");
  if (con.length === pesos.length && con.length) {
    const suma = con.reduce((s, p) => s + (p ?? 0), 0);
    if (Math.abs(suma - 1) > 0.001 || con.some((p) => (p ?? 0) <= 0)) out.push(`Los pesos deben ser positivos y sumar 1 (suman ${Math.round(suma * 1000) / 1000}).`);
  }
  return out;
}

export function generarVersiones(d: DisenoVersiones): FilaSurveyConjoint[] {
  const problemas = validarVersiones(d);
  if (problemas.length) throw new Error(problemas.join(" "));
  const n = nombresVersiones(d.prefijo);
  const niveles = nivelesDeVersiones(d);
  const tipo = d.tipo === "select_one" ? `select_one ${d.lista.trim()}` : d.tipo;
  return [
    fila({ type: "calculate", name: n.azar, calculation: "once(random())" }),
    fila({ type: "calculate", name: n.version, calculation: formulaNivel(n.azar, niveles) }),
    fila({ type: "calculate", name: n.texto, calculation: formulaTexto(n.version, niveles) }),
    fila({ type: tipo, name: d.pregunta, label: ref(n.texto), required: d.obligatoria ? "yes" : "" }),
  ];
}

export function versionesIniciales(prefijo: string, lista = ""): DisenoVersiones {
  return {
    prefijo,
    pregunta: `${prefijo}_respuesta`,
    tipo: lista ? "select_one" : "integer",
    lista,
    obligatoria: true,
    versiones: [
      { texto: "¿Está de acuerdo con que el Estado aumente el gasto en seguridad?" },
      { texto: "¿Está de acuerdo con que el Estado aumente el gasto en seguridad, aunque eso signifique subir impuestos?" },
    ],
  };
}

