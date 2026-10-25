// monitoreoCasosUmp.ts — casos de una UMP con GPS y hora, incluidos los
// anulados (Monitoreo › Territorial › Avance › UMP · exploración, §3.16b).
//
// Contrato: GET /api/monitoreo/territorial/casos-ump?ump=<UMP>
// (`api/R/monitoreo_territorial_casos_ump.R`). Solo lectura.
//
// Normalizador defensivo: Plumber serializa con auto_unbox (lista de uno como
// objeto suelto, escalar como vector de largo uno, `NULL` como `{}`). Un GPS o
// una duración ausentes quedan `null`, nunca cero: un punto en (0, 0) caería en
// el golfo de Guinea.

import { apiFetch, handle, headers } from "./core";
import { booleano, enteroONulo, lista, numeroONulo, registro, texto } from "./normalizarR";

export type EstadoDeCasoUmp = "cuenta" | "observacion" | "no_cuenta" | "anulado_efectiva" | "anulado_sin_consentimiento";

export type CasoDeUmpConGps = {
  id: string;
  orden: number;
  fechaIso: string;
  hora: string;
  momento: string;
  duracionSegundos: number | null;
  lat: number | null;
  lon: number | null;
  gpsEstado: string;
  distanciaM: number | null;
  idManzana: string;
  manzana: string;
  tipoManzana: string;
  aplicador: string;
  codigoPulso: string;
  sexo: string;
  edad: number | null;
  consentimiento: boolean;
  motivos: string[];
  anulado: boolean;
  estado: EstadoDeCasoUmp;
};

export type CasosDeUmp = {
  ump: string;
  fase: string;
  casos: CasoDeUmpConGps[];
  resumen: { total: number; anulados: number; conGps: number };
};

const ESTADOS: readonly EstadoDeCasoUmp[] = ["cuenta", "observacion", "no_cuenta", "anulado_efectiva", "anulado_sin_consentimiento"];

function estadoDeCaso(valor: unknown): EstadoDeCasoUmp {
  const clave = texto(valor) as EstadoDeCasoUmp;
  return ESTADOS.includes(clave) ? clave : "no_cuenta";
}

export function normalizeCasosDeUmp(raw: unknown): CasosDeUmp {
  const cuerpo = registro(raw);
  const resumen = registro(cuerpo.resumen);
  const casos = lista(cuerpo.casos).map((caso, indice): CasoDeUmpConGps => {
    const lat = numeroONulo(caso.lat);
    const lon = numeroONulo(caso.lon);
    const conGps = lat != null && lon != null;
    return {
      id: texto(caso.id) || String(indice + 1),
      orden: enteroONulo(caso.orden) ?? indice + 1,
      fechaIso: texto(caso.fecha_iso),
      hora: texto(caso.hora),
      momento: texto(caso.momento),
      duracionSegundos: numeroONulo(caso.duracion_segundos),
      lat: conGps ? lat : null,
      lon: conGps ? lon : null,
      gpsEstado: texto(caso.gps_estado),
      distanciaM: numeroONulo(caso.distancia_m),
      idManzana: texto(caso.id_manzana),
      manzana: texto(caso.manzana),
      tipoManzana: texto(caso.tipo_manzana),
      aplicador: texto(caso.aplicador),
      codigoPulso: texto(caso.codigo_pulso),
      sexo: texto(caso.sexo),
      edad: numeroONulo(caso.edad),
      consentimiento: booleano(caso.consentimiento),
      motivos: texto(caso.motivos).split(";").map((motivo) => motivo.trim()).filter(Boolean),
      anulado: booleano(caso.anulado),
      estado: estadoDeCaso(caso.estado),
    };
  });
  return {
    ump: texto(cuerpo.ump),
    fase: texto(cuerpo.phase),
    casos,
    resumen: {
      total: enteroONulo(resumen.total) ?? casos.length,
      anulados: enteroONulo(resumen.anulados) ?? casos.filter((caso) => caso.anulado).length,
      conGps: enteroONulo(resumen.con_gps) ?? casos.filter((caso) => caso.lat != null).length,
    },
  };
}

export async function getMonitoreoTerritorialCasosUmp(ump: string): Promise<CasosDeUmp> {
  const url = `/api/monitoreo/territorial/casos-ump?ump=${encodeURIComponent(ump)}`;
  return normalizeCasosDeUmp(await handle<unknown>(await apiFetch(url, { headers: headers() })));
}
