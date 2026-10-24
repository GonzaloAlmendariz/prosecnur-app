import type {
  MonitoreoTerritorialDashboard,
  MonitoreoTerritorialOperationalAdjustmentDeficit,
  MonitoreoTerritorialOperationalAdjustmentSuggestion,
  TerritorialQuotaProgressBlock,
  TerritorialQuotaProgressItem,
} from "../../../../../api/client";
import { celdaEnFrase, rotuloDeAplicador, diaYMes, fmt, nombreDeDistrito, numeroDeUmp, rotuloDeCelda } from "../rotulos";

/**
 * Avance › Faltante por UMP (§3.17), la pantalla de llegada del modo.
 *
 * Todo sale de `route_quota_progress` (la cuota de cada manzana con lo logrado
 * y el signo de lo subsanado) y de `operational_adjustments` (las celdas con
 * déficit y la sugerencia del motor). La manzana EN USO de cada UMP es la que
 * `ump_groups` marca como seleccionada: las celdas con déficit en manzanas que
 * la UMP ya no usa se cuentan aparte (§5, «UMP 51, 66, 115, R 144»).
 */

export type EstadoDeUmp = "pendiente" | "subsanada" | "completa";

export type CeldaDeCuota = {
  clave: string;
  rotulo: string;
  logrado: number;
  meta: number;
  /** Lo recibido (+) o cedido (−) por subsanación en esa celda. */
  delta: number;
  falta: number;
};

export type QuienCubre =
  | { tipo: "sugerencia"; ump: string; km: number | null; manzana: string }
  | { tipo: "sin-excedente" }
  | null;

export type FilaDeUmp = {
  ump: string;
  distrito: string;
  manzana: string;
  idManzana: string;
  reemplazo: boolean;
  aplicador: string;
  aplicadorCompleto: string;
  celdas: CeldaDeCuota[];
  /** Las mismas celdas agrupadas por variable de cuota, una sub-tarjeta cada una. */
  variables: VariableDeCuota[];
  /** Zona censal de la manzana en uso («00100»), vacía si la ruta no la trae. */
  zona: string;
  logrado: number;
  meta: number;
  falta: number;
  ganancia: number;
  perdida: number;
  estado: EstadoDeUmp;
  cubre: QuienCubre;
  ultimoCaso: string;
  /** Las celdas que faltan, en frase: «30 a 44 años». */
  faltantes: Array<{ texto: string; falta: number }>;
  bloque: TerritorialQuotaProgressBlock;
  /** Las otras manzanas de la UMP (titular o reemplazo que ya no se usa). */
  otras: TerritorialQuotaProgressBlock[];
};

export type VariableDeCuota = {
  nombre: "Sexo" | "Edad";
  celdas: CeldaDeCuota[];
  logrado: number;
  meta: number;
  falta: number;
};

function variableDeCuota(nombre: VariableDeCuota["nombre"], celdas: CeldaDeCuota[]): VariableDeCuota {
  return {
    nombre,
    celdas,
    logrado: celdas.reduce((suma, celda) => suma + celda.logrado, 0),
    meta: celdas.reduce((suma, celda) => suma + celda.meta, 0),
    falta: celdas.reduce((suma, celda) => suma + celda.falta, 0),
  };
}

export type CeldaDeDistrito = { clave: string; rotulo: string; logrado: number; meta: number };

export type FilaDeDistrito = {
  distrito: string;
  celdas: CeldaDeDistrito[];
};

export type ModeloFaltante = {
  configurado: boolean;
  filas: FilaDeUmp[];
  pendientes: FilaDeUmp[];
  subsanadas: number;
  totalUmp: number;
  /** Celdas con déficit en manzanas que la UMP ya no usa. */
  celdasFueraDeUso: number;
  columnas: Array<{ clave: string; rotulo: string }>;
  distritos: FilaDeDistrito[];
  /** Base del mapa de calor: casos con sexo y edad del motor de cuotas. */
  casosConSexoYEdad: number;
};

function n(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function esReemplazo(bloque: TerritorialQuotaProgressBlock): boolean {
  return String(bloque.tipo_manzana ?? "").trim().toLowerCase() === "reemplazo";
}

function numeroDeOrden(ump: string): number {
  const match = ump.match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function celdaDe(item: TerritorialQuotaProgressItem): CeldaDeCuota {
  const meta = Math.max(0, n(item.target));
  const logrado = Math.max(0, n(item.achieved));
  return {
    clave: String(item.label),
    rotulo: rotuloDeCelda(item.label),
    logrado,
    meta,
    delta: Math.round(n(item.operational_adjustment_delta)),
    falta: Math.max(0, Math.round(item.missing != null ? n(item.missing) : meta - logrado)),
  };
}

export function estadoDeGrupo(status: string | undefined, falta: number): EstadoDeUmp {
  if (falta > 0) return "pendiente";
  const valor = String(status ?? "").toLowerCase();
  if (valor.startsWith("subsan")) return "subsanada";
  if (valor === "complete" || valor === "exceeded") return "completa";
  return "pendiente";
}

function textoDeDeficit(deficit: MonitoreoTerritorialOperationalAdjustmentDeficit): string {
  const sexo = String(deficit.sex ?? "").trim();
  const edad = String(deficit.age_group ?? "").trim();
  if (sexo && edad) return `${celdaEnFrase(sexo)} de ${celdaEnFrase(edad)}`;
  return celdaEnFrase(sexo || edad);
}

const ORDEN: Record<EstadoDeUmp, number> = { pendiente: 0, subsanada: 1, completa: 2 };

export function construirFaltante(reports: MonitoreoTerritorialDashboard | null | undefined): ModeloFaltante {
  const cuota = reports?.route_quota_progress;
  const ajustes = reports?.operational_adjustments;
  const bloques = cuota?.blocks ?? [];
  const deficits = ajustes?.deficits ?? [];
  const sugerencias = ajustes?.suggestions ?? [];
  // Un corte que no calcula subsanaciones (p. ej. `validation_summary`) publica
  // el payload vacío con `reason`: ahí no se sabe quién cubre, y decir «sin
  // excedente» sería afirmar lo que el motor no midió.
  const subsanacionesCalculadas = Boolean(ajustes) && !/scope/i.test(String(ajustes?.reason ?? ""));
  const porId = new Map(bloques.map((bloque) => [bloque.id_manzana, bloque]));
  const grupos = cuota?.ump_groups?.length
    ? cuota.ump_groups
    : bloques
      .filter((bloque) => bloque.operational_group_selected === true)
      .map((bloque) => ({ ump: String(bloque.ump ?? ""), status: bloque.operational_group_status ?? bloque.status, selected_id_manzana: bloque.id_manzana }));
  const enUso = new Set(grupos.map((grupo) => grupo.selected_id_manzana).filter(Boolean));

  const filas: FilaDeUmp[] = [];
  for (const grupo of grupos) {
    const bloque = porId.get(String(grupo.selected_id_manzana ?? ""));
    if (!bloque) continue;
    const celdasDeSexo = (bloque.sex ?? []).map(celdaDe);
    const celdasDeEdad = (bloque.age ?? []).map(celdaDe);
    const celdas = [...celdasDeSexo, ...celdasDeEdad];
    const variables = [
      ...(celdasDeSexo.length ? [variableDeCuota("Sexo", celdasDeSexo)] : []),
      ...(celdasDeEdad.length ? [variableDeCuota("Edad", celdasDeEdad)] : []),
    ];
    const deficitsEnUso = deficits.filter((item) => item.target_block_id === bloque.id_manzana && n(item.missing) > 0);
    const falta = Math.max(
      0,
      Math.round(n(bloque.missing_total)),
      deficitsEnUso.reduce((suma, item) => suma + n(item.missing), 0),
    );
    const sugerencia: MonitoreoTerritorialOperationalAdjustmentSuggestion | undefined = sugerencias
      .find((item) => item.target_block_id === bloque.id_manzana);
    let cubre: QuienCubre = null;
    if (sugerencia) {
      cubre = {
        tipo: "sugerencia",
        ump: numeroDeUmp(sugerencia.source_ump),
        km: sugerencia.distance_km != null && Number.isFinite(Number(sugerencia.distance_km)) ? Number(sugerencia.distance_km) : null,
        manzana: String(sugerencia.source_manzana ?? ""),
      };
    } else if (subsanacionesCalculadas && (deficitsEnUso.some((item) => item.match_status === "blocked") || falta > 0)) {
      cubre = { tipo: "sin-excedente" };
    }
    const ump = numeroDeUmp(grupo.ump || bloque.ump);
    filas.push({
      ump,
      distrito: nombreDeDistrito(bloque.distrito),
      manzana: String(bloque.manzana ?? ""),
      idManzana: bloque.id_manzana,
      reemplazo: esReemplazo(bloque),
      aplicador: rotuloDeAplicador(bloque.responsable || bloque.responsible),
      aplicadorCompleto: String(bloque.responsable || bloque.responsible || ""),
      celdas,
      variables,
      zona: String(bloque.zona ?? "").trim(),
      logrado: Math.round(n(bloque.validas)),
      meta: Math.round(n(bloque.target)),
      falta,
      ganancia: Math.round(n(bloque.operational_adjustment_gain)),
      perdida: Math.round(n(bloque.operational_adjustment_loss)),
      estado: estadoDeGrupo(grupo.status, falta),
      cubre,
      ultimoCaso: diaYMes(bloque.last_response_date_iso || bloque.last_response_date_label),
      faltantes: deficitsEnUso.length
        ? deficitsEnUso.map((item) => ({ texto: textoDeDeficit(item), falta: Math.round(n(item.missing)) }))
        : celdas.filter((celda) => celda.falta > 0).map((celda) => ({ texto: celdaEnFrase(celda.clave), falta: celda.falta })),
      bloque,
      otras: bloques.filter((otro) => otro.id_manzana !== bloque.id_manzana && numeroDeUmp(otro.ump).split(/\s*·\s*/)[0] === ump),
    });
  }
  filas.sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || numeroDeOrden(a.ump) - numeroDeOrden(b.ump));

  const columnas = filas[0]?.celdas.map((celda) => ({ clave: celda.clave, rotulo: celda.rotulo })) ?? [];
  const distritos: FilaDeDistrito[] = (cuota?.districts ?? []).map((distrito) => ({
    distrito: nombreDeDistrito(distrito.distrito),
    celdas: [...(distrito.sex ?? []), ...(distrito.age ?? [])].map((item) => ({
      clave: String(item.label),
      rotulo: rotuloDeCelda(item.label),
      logrado: Math.max(0, n(item.achieved)),
      meta: Math.max(0, n(item.target)),
    })),
  }));
  const casosConSexoYEdad = (cuota?.districts ?? [])
    .reduce((suma, distrito) => suma + (distrito.sex ?? []).reduce((parcial, item) => parcial + n(item.achieved), 0), 0);

  return {
    configurado: Boolean(cuota?.configured && filas.length),
    filas,
    pendientes: filas.filter((fila) => fila.estado === "pendiente"),
    subsanadas: filas.filter((fila) => fila.estado === "subsanada").length,
    totalUmp: filas.length,
    celdasFueraDeUso: deficits.filter((item) => !enUso.has(item.target_block_id) && n(item.missing) > 0).length,
    columnas,
    distritos,
    casosConSexoYEdad,
  };
}

export type FiltroDeFaltante = "pendientes" | "subsanadas" | "todas";

export function filtrarFilas(filas: readonly FilaDeUmp[], filtro: FiltroDeFaltante, conReemplazos: boolean): FilaDeUmp[] {
  return filas.filter((fila) => {
    if (!conReemplazos && fila.reemplazo) return false;
    if (filtro === "pendientes") return fila.estado === "pendiente";
    if (filtro === "subsanadas") return fila.estado === "subsanada";
    return true;
  });
}

/** «+1», «+1 −1», «−2» o «—». */
export function saldoDeSubsanaciones(fila: Pick<FilaDeUmp, "ganancia" | "perdida">): string {
  const partes = [
    fila.ganancia > 0 ? `+${fmt(fila.ganancia)}` : "",
    fila.perdida > 0 ? `−${fmt(fila.perdida)}` : "",
  ].filter(Boolean);
  return partes.length ? partes.join(" ") : "—";
}

/** «UMP 142, a 0.45 km», «Sin excedente compatible cerca» o «—». */
export function textoDeQuienCubre(cubre: QuienCubre): string {
  if (!cubre) return "—";
  if (cubre.tipo === "sin-excedente") return "Sin excedente compatible cerca";
  const distancia = cubre.km != null
    ? `, a ${cubre.km.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`
    : "";
  return `UMP ${cubre.ump}${distancia}`;
}
