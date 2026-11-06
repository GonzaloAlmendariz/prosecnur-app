import type { TerritorialResponseAuditRow } from "../../../../../api/monitoreo";

/**
 * Avance › Mapa con envío por cuotas (ADR 0125 A1): sin manzanas sorteadas no
 * hay UMP que pintar, así que el mapa muestra los casos del corte sobre las
 * zonas. Tres estados, los mismos del embudo de Resumen: cuentan sin
 * observación, en observación (también cuentan) y no cuentan.
 */
export type EstadoDeCaso = "cuenta" | "observacion" | "no-cuenta";
export type CasoEnMapa = { lon: number; lat: number; estado: EstadoDeCaso; ubigeo: string };
export type ConteoDeZona = { ubigeo: string; conGps: number; enObservacion: number; cuentan: number };
export type CasosDelMapa = {
  casos: CasoEnMapa[];
  total: { cuentan: number; observacion: number; noCuentan: number };
  conGps: { cuenta: number; observacion: number; "no-cuenta": number };
  sinGps: { total: number; observacion: number; noCuenta: number };
  porZona: ConteoDeZona[];
};

function estadoDe(fila: TerritorialResponseAuditRow): EstadoDeCaso {
  if (fila.observation_status === "no_valida" || fila.advance_valid === false) return "no-cuenta";
  return fila.observation_status === "en_observacion" ? "observacion" : "cuenta";
}

const coordenada = (...valores: Array<number | null | undefined>) => {
  for (const v of valores) if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
};

export function construirCasosDelMapa(filas: readonly TerritorialResponseAuditRow[] | null | undefined, ubigeos: readonly string[]): CasosDelMapa {
  const casos: CasoEnMapa[] = [];
  const total = { cuentan: 0, observacion: 0, noCuentan: 0 };
  const conGps = { cuenta: 0, observacion: 0, "no-cuenta": 0 };
  const sinGps = { total: 0, observacion: 0, noCuenta: 0 };
  const porZona = new Map(ubigeos.map((u) => [u, { ubigeo: u, conGps: 0, enObservacion: 0, cuentan: 0 }]));
  for (const fila of filas ?? []) {
    const estado = estadoDe(fila);
    if (estado === "no-cuenta") total.noCuentan += 1;
    else {
      total.cuentan += 1;
      if (estado === "observacion") total.observacion += 1;
    }
    const ubigeo = String(fila.ubigeo ?? "").trim();
    const zona = porZona.get(ubigeo);
    if (zona && estado !== "no-cuenta") zona.cuentan += 1;
    const lat = coordenada(fila.gps_effective_lat, fila.lat);
    const lon = coordenada(fila.gps_effective_lon, fila.lon);
    if (lat == null || lon == null) {
      sinGps.total += 1;
      if (estado === "observacion") sinGps.observacion += 1;
      if (estado === "no-cuenta") sinGps.noCuenta += 1;
      continue;
    }
    casos.push({ lon, lat, estado, ubigeo });
    conGps[estado] += 1;
    if (zona && estado !== "no-cuenta") {
      zona.conGps += 1;
      if (estado === "observacion") zona.enObservacion += 1;
    }
  }
  return { casos, total, conGps, sinGps, porZona: [...porZona.values()] };
}
