// G18 (Gonzalo, 2026-10-13: «aquí podemos ayudarnos de procesamiento para que las etiquetas no se vean tan largas» y
// «céntrate en qué tipo de correcciones o errores ellos solían cometer»). Detecta en las etiquetas curadas de la revisión
// de datos los errores que el cliente corregía a mano en los informes de ACRD (docs/qa/propuesta-etiquetas-entregables-
// 2026-10-13.md). Sólo DETECTA y sugiere: la etiqueta la cambia el analista (D4: «es el analista el que debe quitarlo»).

export type TipoProblema =
  | "espacio-antes-de-signo"
  | "signo-duplicado"
  | "conjuncion-mayuscula"
  | "punto-final"
  | "nota-o-html"
  | "espacios-de-mas"
  | "larga"
  | "equivalente";

export type ProblemaEtiqueta = {
  tipo: TipoProblema;
  /** El fragmento tal como está en la etiqueta, para citarlo. */
  fragmento: string;
  mensaje: string;
  /** La etiqueta con este problema corregido; ausente cuando la corrección es del analista (qué quitar, cómo acortar). */
  sugerencia?: string;
};

/** Largo desde el que una etiqueta de pregunta ya no cabe como rótulo de gráfico (eje, tema de la matriz, radar). */
export const LARGO_PARA_GRAFICO = 80;

const primero = (re: RegExp, s: string): string | null => s.match(re)?.[0] ?? null;

/** Problemas de una etiqueta. `esOpcion` agrega los de las opciones (punto final). */
export function problemasDeEtiqueta(etiqueta: string, { esOpcion = false } = {}): ProblemaEtiqueta[] {
  const s = etiqueta ?? "";
  if (!s.trim()) return [];
  const out: ProblemaEtiqueta[] = [];

  const antes = primero(/\S\s+[:;,.?!)%](?=\s|$)/, s);
  if (antes) out.push({ tipo: "espacio-antes-de-signo", fragmento: antes, mensaje: "Hay un espacio antes del signo.",
    sugerencia: s.replace(/(\S)\s+([:;,.?!)%])(?=\s|$)/g, "$1$2") });

  const doble = primero(/%\s*%|%\)\s*%|\.\.(?!\.)|,,|::/, s);
  if (doble) out.push({ tipo: "signo-duplicado", fragmento: doble, mensaje: "Un signo aparece dos veces.",
    sugerencia: s.replace(/%\s*%/g, "%").replace(/\.\.(?!\.)/g, ".").replace(/,,/g, ",").replace(/::/g, ":") });

  // «docentes Y autoridades»: la conjunción en mayúscula entre palabras en minúscula (no una sigla).
  const conj = primero(/[a-záéíóúñ] (Y|O|E|U) [a-záéíóúñ]/, s);
  if (conj) out.push({ tipo: "conjuncion-mayuscula", fragmento: conj.trim(), mensaje: "Una conjunción va en mayúscula.",
    sugerencia: s.replace(/([a-záéíóúñ]) (Y|O|E|U) ([a-záéíóúñ])/g, (_m, a: string, c: string, b: string) => `${a} ${c.toLowerCase()} ${b}`) });

  if (/ {2,}/.test(s.trim())) out.push({ tipo: "espacios-de-mas", fragmento: primero(/\S {2,}\S/, s) ?? "  ", mensaje: "Hay espacios de más.",
    sugerencia: s.replace(/ {2,}/g, " ").trim() });

  if (esOpcion && /[^.]\.$/.test(s.trim())) out.push({ tipo: "punto-final", fragmento: s.trim().slice(-12), mensaje: "La opción termina en punto.",
    sugerencia: s.trim().replace(/\.$/, "") });

  const nota = s.match(/\[[^\]]{1,400}\]|<\/?[a-z][a-z0-9]*(\s[^<>]*)?\/?>/i)?.[0];
  if (nota) out.push({ tipo: "nota-o-html", fragmento: nota.length > 48 ? `${nota.slice(0, 47)}…` : nota,
    mensaje: "Trae una nota entre corchetes o una etiqueta HTML; si no debe salir en los informes, quítala." });

  if (!esOpcion && s.trim().length > LARGO_PARA_GRAFICO) out.push({ tipo: "larga", fragmento: `${s.trim().length} caracteres`,
    mensaje: "Es larga para un rótulo de gráfico; una versión corta se lee mejor en ejes, temas y radares." });

  return out;
}

const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Opciones de una misma pregunta que sólo difieren en tildes, mayúsculas o espacios («Sí» y «si»): equivalentes separadas. */
export function opcionesEquivalentes(opciones: readonly { code: string; label: string }[]): Map<string, ProblemaEtiqueta> {
  const porClave = new Map<string, { code: string; label: string }[]>();
  for (const o of opciones) {
    const k = plano(o.label);
    if (!k) continue;
    porClave.set(k, [...(porClave.get(k) ?? []), o]);
  }
  const out = new Map<string, ProblemaEtiqueta>();
  for (const grupo of porClave.values()) {
    if (grupo.length < 2) continue;
    for (const o of grupo) {
      const otras = grupo.filter((g) => g.code !== o.code).map((g) => `«${g.label}» (${g.code})`).join(", ");
      out.set(o.code, { tipo: "equivalente", fragmento: o.label, mensaje: `Se escribe casi igual que ${otras}: ¿son la misma respuesta?` });
    }
  }
  return out;
}
