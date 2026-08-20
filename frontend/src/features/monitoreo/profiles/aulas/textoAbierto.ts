/**
 * Calidad de las respuestas de texto abierto.
 *
 * Normaliza el bloque `texto_abierto` del payload. Como el de tiempos, llega
 * SIEMPRE: cuando el estudio no trae instrumento —el caso de aulas— viene con
 * `disponible: false` y su motivo.
 *
 * Lo que se muestra por pregunta es su **perfil** junto a las respuestas. El
 * perfil no es adorno: una señal sólo significa algo contra su propia pregunta.
 * Medido en `acnur_pdm`: en el nombre del encuestador el 99.3 % de las
 * respuestas se repiten, y ahí repetir es lo correcto.
 */

const num = (v: unknown): number | null => {
  const c = Array.isArray(v) ? v[0] : v;
  if (c === null || c === undefined || c === "") return null;
  const n = typeof c === "number" ? c : Number(c);
  return Number.isFinite(n) ? n : null;
};

const texto = (v: unknown): string => {
  const c = Array.isArray(v) ? v[0] : v;
  return typeof c === "string" ? c : "";
};

const bool = (v: unknown): boolean => {
  const c = Array.isArray(v) ? v[0] : v;
  return c === true || c === "TRUE" || c === 1;
};

export type RespuestaAbierta = {
  fila: number;
  texto: string;
  largo: number;
  relleno: boolean;
  negativa: boolean;
  repeticiones: number;
};

export type PreguntaAbierta = {
  variable: string;
  etiqueta: string;
  contestadas: number;
  sinContestar: number;
  distintas: number;
  pctRelleno: number | null;
  pctNegativa: number | null;
  pctRepetida: number | null;
  pctUnaPalabra: number | null;
  mostradas: number;
  respuestas: RespuestaAbierta[];
};

export type TextoAbierto = {
  disponible: boolean;
  motivo: string;
  preguntas: PreguntaAbierta[];
  excluidas: Array<{ variable: string; etiqueta: string; motivo: string }>;
};

export function textoAbierto(crudo: unknown): TextoAbierto {
  const raiz = (crudo ?? {}) as Record<string, unknown>;
  const disponible = bool(raiz.disponible);

  const excluidas = (Array.isArray(raiz.excluidas) ? raiz.excluidas : []).flatMap((e) => {
    const x = (e ?? {}) as Record<string, unknown>;
    const variable = texto(x.variable);
    if (!variable) return [];
    return [{ variable, etiqueta: texto(x.etiqueta), motivo: texto(x.motivo) }];
  });

  const preguntas = (Array.isArray(raiz.preguntas) ? raiz.preguntas : []).flatMap((p) => {
    const q = (p ?? {}) as Record<string, unknown>;
    const perfil = (q.perfil ?? {}) as Record<string, unknown>;
    const variable = texto(q.variable);
    if (!variable) return [];
    const respuestas = (Array.isArray(q.respuestas) ? q.respuestas : []).flatMap((r) => {
      const x = (r ?? {}) as Record<string, unknown>;
      const cuerpo = texto(x.texto);
      if (!cuerpo) return [];
      return [{
        fila: num(x.fila) ?? 0,
        texto: cuerpo,
        largo: num(x.largo) ?? cuerpo.length,
        relleno: bool(x.relleno),
        negativa: bool(x.negativa),
        repeticiones: num(x.repeticiones) ?? 1,
      }];
    });
    return [{
      variable,
      etiqueta: texto(q.etiqueta) || variable,
      contestadas: num(perfil.contestadas) ?? 0,
      sinContestar: num(perfil.sin_contestar) ?? 0,
      distintas: num(perfil.distintas) ?? 0,
      pctRelleno: num(perfil.pct_relleno),
      pctNegativa: num(perfil.pct_negativa),
      pctRepetida: num(perfil.pct_repetida),
      pctUnaPalabra: num(perfil.pct_una_palabra),
      mostradas: num(q.mostradas) ?? respuestas.length,
      respuestas,
    }];
  });

  return {
    disponible,
    motivo: texto(raiz.motivo),
    preguntas: disponible ? preguntas : [],
    excluidas,
  };
}
