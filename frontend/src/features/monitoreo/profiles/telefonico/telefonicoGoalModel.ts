// Cumplimiento del estudio telefónico. Una sola forma para los tres estados que
// el usuario puede declarar: metas por cuota, meta total sin cuotas, o sin meta.
// La cuota es un MÍNIMO a alcanzar, no un techo ni un objetivo exacto; lo que
// queda por barrer es reserva y solo asciende cuando hay brecha.
// Ver docs/plan-monitoreo-telefonico-2026-07.md §1.1, §1.2 y §5.

export type TelefonicoObjetivoModo = "cuotas" | "total" | "sin-meta";

/**
 * Qué se declaró como objetivo. `minimo` es el piso interno con el que nos
 * cubrimos; `barrido` es el acuerdo de trabajar el universo entero, típico de
 * universos chicos. Lo declara el usuario por actor y viaja en el `.pulso`
 * (contrato compartido con el modo Acreditación).
 */
export type TelefonicoObjetivoDeclarado = "barrido" | "minimo";

export type TelefonicoCumplimientoCategoria = {
  clave: string;
  etiqueta: string;
  contexto: string;
  universo: number;
  minimo: number | null;
  logrado: number;
  brecha: number | null;
  pct: number | null;
  cubierto: boolean;
  /** Base disponible por encima del mínimo. */
  reserva: number | null;
  objetivo: TelefonicoObjetivoDeclarado;
  /** Cifra contra la que se mide: el mínimo o el universo entero. */
  referencia: number | null;
};

export type TelefonicoRitmo = {
  porDia: number;
  diasConDatos: number;
  /** Efectivas por día necesarias para cerrar la brecha en los días restantes. */
  requeridoPorDia: number | null;
  diasRestantes: number | null;
  /** Días que tomaría cerrar la brecha al ritmo observado. */
  diasProyectados: number | null;
};

export type TelefonicoReserva = {
  disponible: number;
  /** Registros que hay que consumir por cada efectiva, según lo observado. */
  costoPorEfectiva: number | null;
  /** Base estimada que hace falta para cerrar la brecha. */
  necesariaEstimada: number | null;
  suficiente: boolean | null;
};

export type TelefonicoCumplimiento = {
  modo: TelefonicoObjetivoModo;
  minimoTotal: number | null;
  logradoTotal: number;
  brechaTotal: number | null;
  pctTotal: number | null;
  cubierto: boolean;
  categorias: TelefonicoCumplimientoCategoria[];
  categoriasCubiertas: number;
  /** Solo relevante cuando hay brecha; con el mínimo cubierto pasa a segundo plano. */
  reserva: TelefonicoReserva | null;
  ritmo: TelefonicoRitmo | null;
};

export type TelefonicoCumplimientoInput = {
  /** Filas de cuota ya normalizadas por el consumidor. */
  categorias: Array<{
    clave: string;
    etiqueta: string;
    contexto?: string;
    universo: number;
    minimo: number | null;
    logrado: number;
    /** Sin declarar, se asume `minimo`: el piso interno. */
    objetivo?: TelefonicoObjetivoDeclarado | null;
  }>;
  /** Meta total declarada cuando no hay cuotas por categoría. */
  minimoTotalDeclarado?: number | null;
  logradoTotal: number;
  /** Casos de la base que aún no se han trabajado. */
  porBarrer: number;
  /** Casos ya trabajados, para estimar el costo por efectiva. */
  barridos: number;
  /** Efectivas por día del corte, para el ritmo. */
  serieDiaria?: number[];
  diasRestantes?: number | null;
};

function pct(value: number, total: number | null) {
  if (total == null || !Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(value)) return null;
  return (value / total) * 100;
}

export function buildTelefonicoCumplimiento(input: TelefonicoCumplimientoInput): TelefonicoCumplimiento {
  // Una categoría cuenta como declarada si tiene mínimo o si pidió barrido
  // total: en ese caso el universo es la referencia y no hace falta mínimo.
  const conObjetivo = input.categorias.filter(
    (item) => (item.minimo != null && item.minimo > 0) || (item.objetivo === "barrido" && item.universo > 0),
  );
  const modo: TelefonicoObjetivoModo = conObjetivo.length
    ? "cuotas"
    : input.minimoTotalDeclarado != null && input.minimoTotalDeclarado > 0
      ? "total"
      : "sin-meta";

  const categorias: TelefonicoCumplimientoCategoria[] = input.categorias.map((item) => {
    const minimo = item.minimo != null && item.minimo > 0 ? item.minimo : null;
    const objetivo: TelefonicoObjetivoDeclarado = item.objetivo === "barrido" ? "barrido" : "minimo";
    // Con `barrido` declarado, el acuerdo es trabajar el universo entero: el
    // mínimo deja de ser la referencia y no se puede dar por cerrada la
    // categoría con universo todavía sin trabajar.
    const referencia = objetivo === "barrido"
      ? (item.universo > 0 ? item.universo : minimo)
      : minimo;
    const brecha = referencia != null ? Math.max(0, referencia - item.logrado) : null;
    return {
      clave: item.clave,
      etiqueta: item.etiqueta,
      contexto: item.contexto ?? "",
      universo: item.universo,
      minimo,
      logrado: item.logrado,
      brecha,
      pct: referencia != null ? pct(item.logrado, referencia) : pct(item.logrado, item.universo),
      cubierto: brecha != null ? brecha === 0 : false,
      reserva: minimo != null ? Math.max(0, item.universo - minimo) : null,
      objetivo,
      referencia,
    };
  })
    // Con brecha, lo urgente arriba. Sin brecha, el orden natural por volumen.
    .sort((a, b) => (b.brecha ?? 0) - (a.brecha ?? 0) || b.universo - a.universo
      || a.etiqueta.localeCompare(b.etiqueta, "es", { numeric: true }));

  // El total se suma sobre la referencia de cada categoría, no sobre el mínimo:
  // si una pidió barrido total, su universo es lo que hay que alcanzar.
  const minimoTotal = modo === "cuotas"
    ? categorias.reduce((sum, item) => sum + (item.referencia ?? 0), 0)
    : modo === "total"
      ? input.minimoTotalDeclarado ?? null
      : null;

  // Con cuotas, la brecha real es la suma de brechas por categoría: cubrir el
  // total no sirve si una categoría quedó corta.
  const brechaTotal = modo === "cuotas"
    ? categorias.reduce((sum, item) => sum + (item.brecha ?? 0), 0)
    : minimoTotal != null
      ? Math.max(0, minimoTotal - input.logradoTotal)
      : null;

  const cubierto = brechaTotal != null && brechaTotal === 0;

  const serie = (input.serieDiaria ?? []).filter((value) => Number.isFinite(value) && value > 0);
  const totalSerie = serie.reduce((sum, value) => sum + value, 0);
  const porDia = serie.length ? totalSerie / serie.length : 0;
  const ritmo: TelefonicoRitmo | null = serie.length
    ? {
      porDia,
      diasConDatos: serie.length,
      requeridoPorDia: brechaTotal && input.diasRestantes && input.diasRestantes > 0
        ? brechaTotal / input.diasRestantes
        : null,
      diasRestantes: input.diasRestantes ?? null,
      diasProyectados: brechaTotal && porDia > 0 ? Math.ceil(brechaTotal / porDia) : null,
    }
    : null;

  // El costo por efectiva es lo que decide si la reserva alcanza: cuántos
  // registros de base se consumen por cada entrevista lograda.
  const costoPorEfectiva = input.barridos > 0 && input.logradoTotal > 0
    ? input.barridos / input.logradoTotal
    : null;
  const necesariaEstimada = brechaTotal != null && brechaTotal > 0 && costoPorEfectiva != null
    ? Math.ceil(brechaTotal * costoPorEfectiva)
    : null;
  const reserva: TelefonicoReserva | null = input.porBarrer > 0 || brechaTotal != null
    ? {
      disponible: input.porBarrer,
      costoPorEfectiva,
      necesariaEstimada,
      suficiente: necesariaEstimada == null ? null : input.porBarrer >= necesariaEstimada,
    }
    : null;

  return {
    modo,
    minimoTotal,
    logradoTotal: input.logradoTotal,
    brechaTotal,
    pctTotal: pct(input.logradoTotal, minimoTotal),
    cubierto,
    categorias,
    categoriasCubiertas: categorias.filter((item) => item.cubierto).length,
    reserva,
    ritmo,
  };
}
