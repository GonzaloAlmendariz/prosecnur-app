// Estado por base y por fase de Procesamiento (M8). Lo publica `GET /api/estudio`
// en `bases[<nombre>].fases`, calculado por una sola función del motor
// (`procesamiento_estado_fases`, api/R/procesamiento_estado_fases.R), y la
// carpeta de entregables del estudio en `entregables`.
//
// El normalizador es defensivo: un estado fuera de la lista cerrada no se
// traga ni se convierte en otro; la fase queda `null` y `fuera_de_lista`
// conserva el valor recibido para decirlo.

export type EstadoDeFaseMotor = "sin_iniciar" | "en_curso" | "hecha" | "desactualizada";

export const ESTADOS_DE_FASE: readonly EstadoDeFaseMotor[] = ["sin_iniciar", "en_curso", "hecha", "desactualizada"];

export const FASES_DEL_MOTOR = ["carga", "validacion", "codificacion", "analitica", "graficos"] as const;
export type FaseDelMotor = (typeof FASES_DEL_MOTOR)[number];

export type EstadoDeFase = {
  estado: EstadoDeFaseMotor;
  /** Código estable del porqué ("cerrada", "respuestas_actualizadas"). */
  motivo: string;
  /** Texto para la persona; `null` si el estado no necesita explicación. */
  causa: string | null;
  /** ISO del último cambio de la fase. */
  actualizadoEn: string | null;
  /** Por qué no hay fecha, cuando falta. */
  sinFecha: string | null;
};

export type FuenteDeBase = {
  plataforma: "kobo" | "surveymonkey" | null;
  leidaEn: string | null;
  sinFecha: string | null;
};

export type FasesDeBaseMotor = {
  fuente: FuenteDeBase;
  /** `null` en una fase que el motor no publicó o con un estado fuera de la lista. */
  fases: Readonly<Record<FaseDelMotor, EstadoDeFase | null>>;
  /** Estados recibidos que no están en `ESTADOS_DE_FASE`, por fase. */
  fueraDeLista: Readonly<Partial<Record<FaseDelMotor, string>>>;
};

export type CarpetaDeEntregables = { ruta: string | null; sinRuta: string | null };

function registro(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
}

function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio && limpio !== "NA" ? limpio : null;
}

function esEstado(valor: unknown): valor is EstadoDeFaseMotor {
  return typeof valor === "string" && (ESTADOS_DE_FASE as readonly string[]).includes(valor);
}

export function normalizarFasesDeBase(crudo: unknown): FasesDeBaseMotor | null {
  const raiz = registro(crudo);
  const fasesCrudas = registro(raiz?.fases);
  if (!raiz || !fasesCrudas) return null;
  const fueraDeLista: Partial<Record<FaseDelMotor, string>> = {};
  const fases = {} as Record<FaseDelMotor, EstadoDeFase | null>;
  for (const fase of FASES_DEL_MOTOR) {
    const f = registro(fasesCrudas[fase]);
    if (!f) {
      fases[fase] = null;
      continue;
    }
    if (!esEstado(f.estado)) {
      fueraDeLista[fase] = String(f.estado ?? "");
      fases[fase] = null;
      continue;
    }
    fases[fase] = {
      estado: f.estado,
      motivo: texto(f.motivo) ?? "",
      causa: texto(f.causa),
      actualizadoEn: texto(f.actualizado_en),
      sinFecha: texto(f.sin_fecha),
    };
  }
  const fuente = registro(raiz.fuente);
  const plataforma = texto(fuente?.plataforma);
  return {
    fuente: {
      plataforma: plataforma === "kobo" || plataforma === "surveymonkey" ? plataforma : null,
      leidaEn: texto(fuente?.leida_en),
      sinFecha: texto(fuente?.sin_fecha),
    },
    fases,
    fueraDeLista,
  };
}

export function normalizarCarpetaDeEntregables(crudo: unknown): CarpetaDeEntregables | null {
  const r = registro(crudo);
  if (!r) return null;
  return { ruta: texto(r.ruta), sinRuta: texto(r.sin_ruta) };
}
