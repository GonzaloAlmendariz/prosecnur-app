import { composicionDelAula } from "./composicionDelAula";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * Los cursos-horario con brecha, listos para decidir qué hacer con cada uno.
 *
 * Es el diagnóstico que separa el complemento (B) del refuerzo (C): «rindió
 * poco» no significa nada suelto —poco contra lo que su facultad preveía— y la
 * decisión cambia según si falta poco o no se aplicó nunca.
 *
 * **La severidad se mide contra la tasa prevista de SU facultad, no contra una
 * media del estudio.** Un 48 % es malo en Artes Escénicas, que preveía 74, y
 * bueno en una que preveía 40. Es la misma vara que usa la pestaña Efectividad,
 * y por eso viaja en la fila del plan (`tasa_facultad`).
 */

export type SeveridadDeBrecha = "sin_aplicar" | "muy_por_debajo" | "por_debajo" | "cerca" | "cumplida";

export type BrechaDeCurso = {
  codigo: string;
  facultad: string;
  /** «LUN 08:00–11:00 · L104», tal como lo dice la agenda. */
  cuando: string;
  donde: string;
  /** Lo que rinde y lo que su facultad preveía, en tanto por uno. */
  observada: number | null;
  prevista: number | null;
  faltan: number;
  efectivas: number;
  esperadas: number;
  severidad: SeveridadDeBrecha;
  /** Qué toca hacer con este curso-horario, en el vocabulario del libro. */
  accion: "reemplazo" | "complemento" | "nada";
  /** Su composición por sexo: decide si un relevo suyo cerraría lo que falta. */
  mujeres: number;
  hombres: number;
};

const texto = (v: unknown) => (v == null ? "" : String(v)).trim();
const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const opcional = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** El orden en que se atiende: primero lo que no se aplicó, luego lo más corto. */
const PESO: Record<SeveridadDeBrecha, number> = {
  sin_aplicar: 0, muy_por_debajo: 1, por_debajo: 2, cerca: 3, cumplida: 4,
};

export function brechasDelCorte(
  filas: ReadonlyArray<MonitoreoAulasPlanRow> | null | undefined,
): BrechaDeCurso[] {
  const salida: BrechaDeCurso[] = [];
  for (const f of filas ?? []) {
    const faltan = Math.round(numero(f.brecha));
    const efectivas = Math.round(numero(f.respuestas_validas));
    const esperadas = Math.round(numero(f.expected_valid));
    if (faltan <= 0 && efectivas === 0 && esperadas === 0) continue;

    const elegibles = numero(f.eligible_n);
    const observada = elegibles > 0 ? efectivas / elegibles : null;
    const prevista = opcional((f as Record<string, unknown>).tasa_facultad)
      ?? opcional((f as Record<string, unknown>).efectividad_tau);

    // **Sin aplicar NO es rendir cero.** Un aula a la que todavía no se ha ido
    // no ha fallado: le falta todo porque no le ha tocado, y su salida es la
    // agenda, no un relevo. Se distingue por el parte, no por la cifra.
    const aplicada = efectivas > 0
      || texto(f.application_status).toLowerCase() === "aplicada"
      || numero((f as Record<string, unknown>).applied_surveys) > 0;

    let severidad: SeveridadDeBrecha;
    if (!aplicada) severidad = "sin_aplicar";
    else if (faltan <= 0) severidad = "cumplida";
    else if (observada == null || prevista == null) severidad = "por_debajo";
    else {
      const cuanto = observada / prevista;
      severidad = cuanto < 0.5 ? "muy_por_debajo" : cuanto < 0.85 ? "por_debajo" : "cerca";
    }

    const { mujeres, hombres } = composicionDelAula(f);
    salida.push({
      codigo: texto(f.operational_code) || texto(f.classroom_id),
      facultad: texto(f.faculty),
      cuando: texto((f as Record<string, unknown>).sesiones_dia_hora) || texto(f.schedule),
      donde: texto(f.venue),
      observada, prevista, faltan, efectivas, esperadas, severidad,
      // Un aula sin aplicar se agenda; una aplicada que se quedó corta se
      // complementa. Nunca al revés: complementar la que no se visitó sería
      // gastar una reserva por un hueco que nadie ha intentado llenar.
      accion: severidad === "sin_aplicar" ? "reemplazo"
        : severidad === "cumplida" ? "nada" : "complemento",
      mujeres, hombres,
    });
  }
  return salida.sort((a, b) =>
    PESO[a.severidad] - PESO[b.severidad] || b.faltan - a.faltan || a.codigo.localeCompare(b.codigo));
}

/** Cuántos hay de cada severidad, para la lectura de arriba. */
export function repartoDeBrechas(brechas: ReadonlyArray<BrechaDeCurso>) {
  const cuenta = (s: SeveridadDeBrecha) => brechas.filter((b) => b.severidad === s).length;
  return {
    total: brechas.length,
    sinAplicar: cuenta("sin_aplicar"),
    muyPorDebajo: cuenta("muy_por_debajo"),
    porDebajo: cuenta("por_debajo"),
    cerca: cuenta("cerca"),
    faltanEnTotal: brechas.reduce((n, b) => n + Math.max(0, b.faltan), 0),
  };
}
