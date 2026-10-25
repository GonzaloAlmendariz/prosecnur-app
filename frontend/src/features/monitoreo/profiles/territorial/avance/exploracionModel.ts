import type { CasoDeUmpConGps, EstadoDeCasoUmp } from "../../../../../api/monitoreoCasosUmp";
import { diaYMes, fmt } from "../rotulos";

/**
 * Exploración de una UMP (territorial.md §3.16b): el mapa con un punto por
 * formulario en su GPS de Kobo, numerado por orden, y la jornada formulario por
 * formulario. Todo sale de `GET /api/monitoreo/territorial/casos-ump`, que trae
 * también los anulados con su GPS y su hora.
 */

export type VistaDeManzana = "titular" | "reemplazo" | "ambas";
export type CapaDeExploracion = "recorrido" | "estado" | "cuota";

export const ROTULO_DE_ESTADO_DE_CASO: Record<EstadoDeCasoUmp, string> = {
  cuenta: "Cuenta",
  observacion: "En observación",
  no_cuenta: "No cuenta",
  anulado_efectiva: "Anulado, había aceptado",
  anulado_sin_consentimiento: "Anulado, sin consentimiento",
};

export function esReemplazo(caso: Pick<CasoDeUmpConGps, "tipoManzana">): boolean {
  return caso.tipoManzana.trim().toLowerCase() === "reemplazo";
}

/** Las vistas que tienen sentido: «Ambas» sólo si la UMP usó las dos manzanas. */
export function vistasDisponibles(casos: readonly CasoDeUmpConGps[]): VistaDeManzana[] {
  const conReemplazo = casos.some(esReemplazo);
  const conTitular = casos.some((caso) => !esReemplazo(caso));
  if (conReemplazo && conTitular) return ["titular", "reemplazo", "ambas"];
  return conReemplazo ? ["reemplazo"] : ["titular"];
}

export function casosDeLaVista(casos: readonly CasoDeUmpConGps[], vista: VistaDeManzana): CasoDeUmpConGps[] {
  if (vista === "ambas") return [...casos];
  return casos.filter((caso) => (vista === "reemplazo" ? esReemplazo(caso) : !esReemplazo(caso)));
}

/** Clase de color de un punto según la capa elegida. */
export function claseDelPunto(caso: CasoDeUmpConGps, capa: CapaDeExploracion, indiceDeAplicador: number): string {
  if (capa === "cuota") {
    const sexo = caso.sexo.trim().toLowerCase();
    if (/^(mujer|femenino|female|f)$/.test(sexo)) return "is-mujer";
    if (/^(hombre|masculino|male|m)$/.test(sexo)) return "is-hombre";
    return "is-sin-dato";
  }
  if (capa === "estado") {
    if (caso.anulado) return caso.estado === "anulado_efectiva" ? "is-anulado-efectiva" : "is-anulado-sin";
    if (caso.gpsEstado === "geo_no_defendible" || caso.gpsEstado === "geo_revision") return "is-gps-fuera";
    return caso.estado === "no_cuenta" ? "is-no-cuenta" : "is-cuenta";
  }
  return `is-aplicador-${indiceDeAplicador % 4}`;
}

/** Los aplicadores en el orden en que aparecen: su índice da el color del recorrido. */
export function aplicadoresEnOrden(casos: readonly CasoDeUmpConGps[]): string[] {
  return [...new Set(casos.map((caso) => caso.aplicador || "Sin aplicador"))];
}

/** Recorrido de cada aplicador: sus casos con GPS en orden de llegada. */
export function recorridos(casos: readonly CasoDeUmpConGps[]): Array<{ aplicador: string; casos: CasoDeUmpConGps[] }> {
  return aplicadoresEnOrden(casos).map((aplicador) => ({
    aplicador,
    casos: casos
      .filter((caso) => (caso.aplicador || "Sin aplicador") === aplicador && caso.lat != null && caso.lon != null)
      .sort((a, b) => a.orden - b.orden),
  }));
}

function segundosDelDia(caso: Pick<CasoDeUmpConGps, "hora">): number | null {
  const match = caso.hora.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
}

/** «12 min después del anterior» del mismo aplicador y el mismo día, o «Primero del día». */
export function tiempoDesdeElAnterior(caso: CasoDeUmpConGps, casos: readonly CasoDeUmpConGps[]): string {
  const propio = segundosDelDia(caso);
  if (propio == null) return "Sin hora";
  const anteriores = casos
    .filter((otro) => otro.id !== caso.id && otro.aplicador === caso.aplicador && otro.fechaIso === caso.fechaIso)
    .map((otro) => segundosDelDia(otro))
    .filter((valor): valor is number => valor != null && valor < propio);
  if (!anteriores.length) return "Primero del día";
  const minutos = Math.round((propio - Math.max(...anteriores)) / 60);
  return minutos < 60 ? `${fmt(minutos)} min después del anterior` : `${fmt(Math.floor(minutos / 60))} h ${fmt(minutos % 60)} min después del anterior`;
}

export type MarcaDeJornada = { caso: CasoDeUmpConGps; inicio: number; ancho: number | null };
export type Jornada = { dia: string; fecha: string; desde: number; hasta: number; marcas: MarcaDeJornada[] };

/**
 * «Ver cada formulario»: las marcas de una jornada sobre su horario. El ancho
 * es lo que duró el formulario cuando se conoce; si no, la marca es un trazo.
 */
export function jornadas(casos: readonly CasoDeUmpConGps[]): Jornada[] {
  const porDia = new Map<string, CasoDeUmpConGps[]>();
  for (const caso of casos) {
    if (!caso.fechaIso) continue;
    porDia.set(caso.fechaIso, [...(porDia.get(caso.fechaIso) ?? []), caso]);
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, delDia]) => {
      const marcas = delDia
        .map((caso) => ({ caso, inicio: segundosDelDia(caso) }))
        .filter((item): item is { caso: CasoDeUmpConGps; inicio: number } => item.inicio != null)
        .sort((a, b) => a.inicio - b.inicio)
        .map(({ caso, inicio }) => ({ caso, inicio, ancho: caso.duracionSegundos != null && caso.duracionSegundos > 0 ? caso.duracionSegundos : null }));
      const desde = marcas.length ? Math.floor(marcas[0].inicio / 3600) * 3600 : 8 * 3600;
      const fin = marcas.reduce((maximo, marca) => Math.max(maximo, marca.inicio + Math.min(marca.ancho ?? 0, 3 * 3600)), desde + 3600);
      return { dia, fecha: diaYMes(dia), desde, hasta: Math.ceil(fin / 3600) * 3600, marcas };
    });
}

export type PuntoEnPantalla = { id: string; x: number; y: number };

/**
 * Puntos con el mismo GPS (dentro de `tolerancia` px) se separan en espiral
 * alrededor del primero, para que ninguno tape a otro.
 */
export function separarEnEspiral(puntos: readonly PuntoEnPantalla[], paso = 9, tolerancia = 1.5): PuntoEnPantalla[] {
  const grupos: PuntoEnPantalla[][] = [];
  for (const punto of puntos) {
    const grupo = grupos.find((otro) => Math.hypot(otro[0].x - punto.x, otro[0].y - punto.y) <= tolerancia);
    if (grupo) grupo.push(punto);
    else grupos.push([punto]);
  }
  return grupos.flatMap((grupo) => grupo.map((punto, indice) => {
    if (indice === 0) return { ...punto };
    const angulo = indice * 2.4;
    const radio = paso * Math.sqrt(indice);
    return { id: punto.id, x: grupo[0].x + radio * Math.cos(angulo), y: grupo[0].y + radio * Math.sin(angulo) };
  }));
}

export function textoDeDistancia(metros: number | null): string {
  if (metros == null) return "Sin GPS";
  return metros >= 1000 ? `${(metros / 1000).toLocaleString("es-PE", { maximumFractionDigits: 1 })} km de su manzana` : `${fmt(Math.round(metros))} m de su manzana`;
}
