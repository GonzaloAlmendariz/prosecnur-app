// Modelo de lectura del equipo telefónico: estados por encuestador y descuadre
// plataforma↔barrido. Ambos bloques los produce el engine R
// (`estatus_responsable`, `campo_vs_plataforma_responsable`) y hasta ahora solo
// viajaban al PDF de publicación. Ver docs/plan-monitoreo-telefonico-2026-07.md §3.

export type TelefonicoStatusCell = {
  estado: string;
  casos: number;
  pct: number | null;
  /** Puntos porcentuales por encima (+) o debajo (−) de la mediana del equipo. */
  desviacion: number | null;
  /** `alta` cuando el desvío supera el umbral y merece mirada del coordinador. */
  senal: "alta" | "baja" | "normal";
};

export type TelefonicoStatusRow = {
  key: string;
  responsable: string;
  actor: string;
  total: number;
  celdas: TelefonicoStatusCell[];
};

export type TelefonicoStatusMatrix = {
  estados: string[];
  /** Distribución del equipo completo: la fila de referencia. */
  general: TelefonicoStatusCell[];
  responsables: TelefonicoStatusRow[];
  total: number;
  /** Responsables con muy pocos casos quedan fuera del cálculo de mediana. */
  minimoParaComparar: number;
};

export type TelefonicoPlatformGapRow = {
  key: string;
  responsable: string;
  actor: string;
  asignados: number;
  barridos: number;
  efectivasTel: number;
  efectivasPlataforma: number;
  conciliadas: number;
  telSinPlataforma: number;
  plataformaSinTel: number;
  /** Casos que exigen acción de este responsable: registrar lo ya entrevistado. */
  brecha: number;
};

export type TelefonicoPlatformGap = {
  filas: TelefonicoPlatformGapRow[];
  totales: {
    efectivasTel: number;
    efectivasPlataforma: number;
    conciliadas: number;
    telSinPlataforma: number;
    plataformaSinTel: number;
    brecha: number;
  };
};

const UMBRAL_DESVIACION_PP = 12;
const MINIMO_CASOS_PARA_COMPARAR = 10;
const MAX_ESTADOS_VISIBLES = 8;

function norm(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function pickText(row: Record<string, unknown>, keys: string[], fallback = "") {
  const normalized = new Map(Object.keys(row).map((key) => [norm(key), key]));
  for (const key of keys) {
    const real = normalized.get(norm(key));
    if (!real) continue;
    const value = row[real];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return fallback;
}

function pickNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  const normalized = new Map(Object.keys(row).map((key) => [norm(key), key]));
  for (const key of keys) {
    const real = normalized.get(norm(key));
    if (!real) continue;
    const raw = row[real];
    if (raw == null || raw === "") continue;
    const value = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d.,-]/g, "").replace(",", "."));
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function pct(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return null;
  return (value / total) * 100;
}

function median(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function esSinAsignar(value: string) {
  const key = norm(value);
  return !key || key === "sin responsable" || key === "sin asignar" || key === "na" || key === "-";
}

/**
 * El bloque trae en `Actor` el nombre de la fuente cuando el estudio no declara
 * actores (`11_ACNUR_PDM_Base de barrido`). Mostrarlo como si fuera un segmento
 * es ruido: se descarta.
 */
function esEtiquetaTecnica(value: string) {
  const key = norm(value);
  if (!key) return true;
  if (/^\d+[_-]/.test(key)) return true;
  if (key.includes("_")) return true;
  if (/\.(xlsx|csv|sav)$/.test(key)) return true;
  return key.includes("base de barrido") || key.includes("sheet") || key.includes("spreadsheet");
}

function actorVisible(value: string) {
  return esEtiquetaTecnica(value) ? "" : value;
}

/**
 * Matriz estado × encuestador desde `estatus_responsable` (formato largo:
 * Actor · Responsable · Estado · Casos). Se lee en dos direcciones: hacia abajo
 * diagnostica la base, hacia el lado diagnostica al equipo.
 */
export function buildTelefonicoStatusMatrix(rows: Array<Record<string, unknown>>): TelefonicoStatusMatrix {
  const porResponsable = new Map<string, { responsable: string; actor: string; estados: Map<string, number> }>();
  const totalesEstado = new Map<string, number>();

  rows.forEach((row) => {
    const responsable = pickText(row, ["Responsable", "Encuestador", "Operador"], "");
    if (esSinAsignar(responsable)) return;
    const estado = pickText(row, ["Estado", "Estatus", "Estado telefónico", "Estado telefonico"], "");
    if (!estado) return;
    const casos = pickNumber(row, ["Casos", "Total", "Valor"], 0);
    if (!(casos > 0)) return;
    const actor = actorVisible(pickText(row, ["Actor", "Unidad", "Segmento"], ""));
    const key = `${norm(actor)}${norm(responsable)}`;
    let entry = porResponsable.get(key);
    if (!entry) {
      entry = { responsable, actor, estados: new Map() };
      porResponsable.set(key, entry);
    }
    entry.estados.set(estado, (entry.estados.get(estado) ?? 0) + casos);
    totalesEstado.set(estado, (totalesEstado.get(estado) ?? 0) + casos);
  });

  const estados = [...totalesEstado.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .slice(0, MAX_ESTADOS_VISIBLES)
    .map(([estado]) => estado);

  const total = [...totalesEstado.values()].reduce((sum, value) => sum + value, 0);

  const base = [...porResponsable.entries()].map(([key, entry]) => {
    const totalResponsable = [...entry.estados.values()].reduce((sum, value) => sum + value, 0);
    return { key, ...entry, total: totalResponsable };
  });

  // La mediana se calcula solo sobre quienes tienen volumen suficiente: un
  // responsable con 3 casos distorsiona cualquier referencia.
  const comparables = base.filter((entry) => entry.total >= MINIMO_CASOS_PARA_COMPARAR);
  const medianas = new Map<string, number | null>();
  estados.forEach((estado) => {
    const valores = comparables
      .map((entry) => pct(entry.estados.get(estado) ?? 0, entry.total))
      .filter((value): value is number => value != null);
    medianas.set(estado, median(valores));
  });

  const responsables: TelefonicoStatusRow[] = base
    .sort((a, b) => b.total - a.total || a.responsable.localeCompare(b.responsable, "es"))
    .map((entry) => ({
      key: entry.key,
      responsable: entry.responsable,
      actor: entry.actor,
      total: entry.total,
      celdas: estados.map((estado) => {
        const casos = entry.estados.get(estado) ?? 0;
        const porcentaje = pct(casos, entry.total);
        const referencia = medianas.get(estado) ?? null;
        const comparable = entry.total >= MINIMO_CASOS_PARA_COMPARAR;
        const desviacion = porcentaje != null && referencia != null && comparable
          ? porcentaje - referencia
          : null;
        const senal: TelefonicoStatusCell["senal"] = desviacion == null || Math.abs(desviacion) < UMBRAL_DESVIACION_PP
          ? "normal"
          : desviacion > 0 ? "alta" : "baja";
        return { estado, casos, pct: porcentaje, desviacion, senal };
      }),
    }));

  const general: TelefonicoStatusCell[] = estados.map((estado) => {
    const casos = totalesEstado.get(estado) ?? 0;
    return { estado, casos, pct: pct(casos, total), desviacion: null, senal: "normal" };
  });

  return { estados, general, responsables, total, minimoParaComparar: MINIMO_CASOS_PARA_COMPARAR };
}

/**
 * Descuadre plataforma↔barrido por responsable desde
 * `campo_vs_plataforma_responsable`. La brecha es detección temprana: significa
 * que alguien está entrevistando sin registrar el estado en la hoja.
 */
export function buildTelefonicoPlatformGap(rows: Array<Record<string, unknown>>): TelefonicoPlatformGap {
  const filas: TelefonicoPlatformGapRow[] = rows
    .map((row, index) => {
      const responsable = pickText(row, ["Responsable", "Encuestador", "Operador"], "");
      const actor = actorVisible(pickText(row, ["Actor", "Unidad", "Segmento"], ""));
      const efectivasTel = pickNumber(row, ["Efectivas telefónicas", "Efectivas telefonicas", "Efectivas tel."], 0);
      const efectivasPlataforma = pickNumber(
        row,
        ["Efectivas Kobo", "Plataforma completa", "Efectivas plataforma"],
        0,
      );
      const conciliadas = pickNumber(row, ["Conciliadas por CodPulso", "Conciliadas"], 0);
      const telSinPlataforma = pickNumber(
        row,
        ["Tel. efectiva sin efectiva Kobo", "Tel. efectiva sin plataforma completa"],
        0,
      );
      const plataformaSinTel = pickNumber(
        row,
        ["Efectiva Kobo sin tel. efectiva", "Plataforma completa sin tel. efectiva"],
        0,
      );
      return {
        key: `${norm(actor)}-${norm(responsable)}-${index}`,
        responsable,
        actor,
        asignados: pickNumber(row, ["Casos asignados", "Asignados"], 0),
        barridos: pickNumber(row, ["Barridos"], 0),
        efectivasTel,
        efectivasPlataforma,
        conciliadas,
        telSinPlataforma,
        plataformaSinTel,
        brecha: plataformaSinTel,
      };
    })
    .filter((fila) => !esSinAsignar(fila.responsable))
    .filter((fila) => fila.efectivasTel > 0 || fila.efectivasPlataforma > 0 || fila.barridos > 0)
    // El que más casos entrevistados sin registrar tiene es el que primero hay
    // que llamar: ordenar por brecha, no por producción.
    .sort((a, b) => b.brecha - a.brecha || b.efectivasPlataforma - a.efectivasPlataforma
      || a.responsable.localeCompare(b.responsable, "es"));

  const totales = filas.reduce(
    (acc, fila) => ({
      efectivasTel: acc.efectivasTel + fila.efectivasTel,
      efectivasPlataforma: acc.efectivasPlataforma + fila.efectivasPlataforma,
      conciliadas: acc.conciliadas + fila.conciliadas,
      telSinPlataforma: acc.telSinPlataforma + fila.telSinPlataforma,
      plataformaSinTel: acc.plataformaSinTel + fila.plataformaSinTel,
      brecha: acc.brecha + fila.brecha,
    }),
    { efectivasTel: 0, efectivasPlataforma: 0, conciliadas: 0, telSinPlataforma: 0, plataformaSinTel: 0, brecha: 0 },
  );

  return { filas, totales };
}
