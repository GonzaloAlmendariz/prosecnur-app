import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * Cuánta reserva lleva gastada el operativo.
 *
 * Es la pregunta que decide si el plan de reemplazos aguanta. El estudio de 2025
 * planificó cadenas de hasta once eslabones y **consumió dos**: 26 reemplazos
 * sobre 170 titulares. Saberlo a mitad de campo cambia decisiones —si medio
 * operativo va por el tercer eslabón, el problema no es el aula, es el criterio
 * de contacto—.
 */

/**
 * Una reserva libre es la que sigue esperando su turno.
 *
 * **Misma definición que `monitoreo_aulas_reservas_disponibles()`** en
 * `api/R/monitoreo_aulas_reemplazos.R`: si las dos divergen, el gráfico dice que
 * quedan reservas que el motor ya no ofrece, o al revés. La cadena vacía cuenta
 * como libre porque un plan recién importado no trae estado.
 */
const ESTADOS_LIBRES = new Set(["en_reserva", "sin_contactar", ""]);

export type TramoDeConsumo = {
  etiqueta: string;
  /** Cadenas —titulares— en ese tramo. */
  cadenas: number;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** El titular de una fila: el propio código si lo es, su `replacement_for` si es reserva. */
function titularDe(fila: MonitoreoAulasPlanRow): string {
  return texto(fila.replacement_for)
    || texto(fila.titular_operational_code)
    || texto(fila.operational_code);
}

/**
 * Reparte las cadenas por cuántas reservas llevan consumidas.
 *
 * @returns tramos 0 / 1 / 2 / 3+, más `sinReserva` —cadenas que el diseño
 *   muestral nunca dotó, que NO es lo mismo que una cadena agotada (L54)— y
 *   `reservasLibres`, que es lo que queda en el banco.
 */
export function consumoDeCadena(filas: ReadonlyArray<MonitoreoAulasPlanRow>) {
  const consumidas = new Map<string, number>();
  const disponibles = new Map<string, number>();
  const titulares = new Set<string>();

  for (const fila of filas) {
    const rol = texto(fila.sample_role);
    const cadena = titularDe(fila);
    if (!cadena) continue;
    if (rol !== "chain_reserve") {
      titulares.add(cadena);
      if (!consumidas.has(cadena)) consumidas.set(cadena, 0);
      if (!disponibles.has(cadena)) disponibles.set(cadena, 0);
      continue;
    }
    const libre = ESTADOS_LIBRES.has(texto(fila.sample_status));
    const mapa = libre ? disponibles : consumidas;
    mapa.set(cadena, (mapa.get(cadena) ?? 0) + 1);
    if (!consumidas.has(cadena)) consumidas.set(cadena, 0);
    if (!disponibles.has(cadena)) disponibles.set(cadena, 0);
    // Una reserva puede llegar sin que su titular esté en las filas visibles
    // —la agenda recorta—; la cadena existe igual.
    titulares.add(cadena);
  }

  const tramos: TramoDeConsumo[] = [
    { etiqueta: "Sin gastar", cadenas: 0 },
    { etiqueta: "1 reemplazo", cadenas: 0 },
    { etiqueta: "2 reemplazos", cadenas: 0 },
    { etiqueta: "3 o más", cadenas: 0 },
  ];
  let sinReserva = 0;
  let reservasLibres = 0;
  let reservasGastadas = 0;

  for (const cadena of titulares) {
    const gastadas = consumidas.get(cadena) ?? 0;
    const libres = disponibles.get(cadena) ?? 0;
    reservasLibres += libres;
    reservasGastadas += gastadas;
    // Nunca haber tenido reserva es una decisión del diseño muestral, no un
    // hecho del operativo: se cuenta aparte y no como «sin gastar» (L54).
    if (!gastadas && !libres) { sinReserva += 1; continue; }
    tramos[Math.min(gastadas, 3)].cadenas += 1;
  }

  return {
    tramos,
    sinReserva,
    reservasLibres,
    reservasGastadas,
    cadenas: titulares.size - sinReserva,
    total: titulares.size,
  };
}
