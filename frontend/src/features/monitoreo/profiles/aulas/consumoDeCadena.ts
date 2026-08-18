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

/**
 * El titular de una fila, en códigos operativos.
 *
 * Por `titular_operational_code` y NO por `replacement_for`, que es el error
 * que rompía la cadena entera: ese campo lleva el `classroom_id` del titular
 * —`arc232_0905`— porque así lo escriben sus dos escritores, `calc_muestra_aulas.R`
 * y `monitoreo_aulas_apply_replacement()`; ahí es su clave interna, no un código
 * operativo. Medido sobre HSVG2026 (2 615 filas): de los 202 `replacement_for`
 * distintos, CERO coincidían con un titular y ninguno existía siquiera como
 * fila, así que cada reserva formaba una cadena huérfana con un titular que no
 * existe. `titular_operational_code` sí mapea: 1 774 de 1 774.
 */
function titularDe(fila: MonitoreoAulasPlanRow): string {
  return texto(fila.titular_operational_code)
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
  // Reservas del banco: sueltas, sin titular al que volver.
  let enElBanco = 0;
  const consumidas = new Map<string, number>();
  const disponibles = new Map<string, number>();
  const titulares = new Set<string>();

  for (const fila of filas) {
    const rol = texto(fila.sample_role);
    const cadena = titularDe(fila);
    if (!cadena) continue;
    // El banco NO es una cadena. `extra_reserve_pool` son reservas sueltas que
    // el diseño muestral dejó sin colgar de ningún titular: no tienen cadena a
    // la que pertenecer y no son el titular de nada. Contadas como titulares,
    // el estudio real HSVG2026 —639 filas de banco frente a 202 titulares—
    // enseñaba **841 cadenas** donde hay 202, y la frase «N titulares no tienen
    // ninguna reserva, así que sus metas quedan sin cubrir si caen» pasaba a
    // hablar de 639 aulas que no tienen meta ni pueden caerse.
    //
    // Van al banco, que es donde el propio panel ya las nombra: «10 todavía en
    // el banco».
    if (rol === "extra_reserve_pool") {
      enElBanco += 1;
      continue;
    }
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
    // Lo libre de las cadenas MÁS el banco suelto: las dos cosas son reserva
    // que el operativo todavía no gastó, y separarlas en la cifra haría pensar
    // que hay menos colchón del que hay.
    reservasLibres: reservasLibres + enElBanco,
    enElBanco,
    reservasGastadas,
    cadenas: titulares.size - sinReserva,
    total: titulares.size,
  };
}

export type ColchonDeFacultad = {
  facultad: string;
  /** Cadenas —titulares— de la facultad. */
  titulares: number;
  /** Reservas de esas cadenas que siguen esperando su turno. */
  libres: number;
  /** Reservas ya activadas. */
  gastadas: number;
  /**
   * Cadenas que el plan nunca dotó de reserva. Es una decisión del diseño
   * muestral, no un hecho del operativo, y no se suma con las agotadas (L54).
   */
  nuncaTuvo: number;
  /** Cadenas que tuvieron reserva y ya no les queda ninguna libre. */
  agotadas: number;
};

/**
 * Cuánta reserva le queda a CADA facultad.
 *
 * La franja de consumo dice si el plan aguanta en conjunto; ésta dice dónde se
 * rompe. Y aquí importa porque la cuota es por facultad: un operativo con
 * veinte reservas libres puede tener una facultad a cero, y esa facultad no
 * cierra su cuota por muchas reservas que sobren en las otras.
 *
 * **La reserva se atribuye a la facultad de su TITULAR, no a la suya.** Sólo
 * repone la cuota de la facultad del aula que cayó; una reserva de otra
 * facultad no le sirve a ésta aunque figure en su cadena. Cuando el titular no
 * viene entre las filas —la agenda recorta— se cae a la facultad de la propia
 * fila, que es lo único que queda.
 *
 * **Los extras no entran.** No reemplazan a nadie —son aulas adicionales para
 * la cuota de hombres y mujeres— y además la vista que consume esto los recibe
 * ya filtrados a propósito, así que una columna suya aquí no podría llenarse
 * nunca. Su reparto por facultad, con composición por sexo, vive en su propia
 * pestaña (`monitoreo_aulas_banco_extras.R`).
 */
export function colchonPorFacultad(filas: ReadonlyArray<MonitoreoAulasPlanRow>): ColchonDeFacultad[] {
  const facultadDelTitular = new Map<string, string>();
  for (const fila of filas) {
    const rol = texto(fila.sample_role);
    if (rol === "chain_reserve" || rol === "extra_reserve_pool") continue;
    const cadena = titularDe(fila);
    if (cadena) facultadDelTitular.set(cadena, texto(fila.faculty));
  }

  type Cuenta = { libres: number; total: number };
  type Acumulado = ColchonDeFacultad & { porCadena: Map<string, Cuenta> };
  const porFacultad = new Map<string, Acumulado>();
  const de = (facultad: string): Acumulado => {
    let a = porFacultad.get(facultad);
    if (!a) {
      a = {
        facultad, titulares: 0, libres: 0, gastadas: 0,
        nuncaTuvo: 0, agotadas: 0,
        porCadena: new Map(),
      };
      porFacultad.set(facultad, a);
    }
    return a;
  };

  for (const fila of filas) {
    const rol = texto(fila.sample_role);
    if (rol === "extra_reserve_pool") continue;
    const propia = texto(fila.faculty) || "Sin facultad";
    const cadena = titularDe(fila);
    if (!cadena) continue;
    if (rol !== "chain_reserve") {
      const a = de(propia);
      a.titulares += 1;
      if (!a.porCadena.has(cadena)) a.porCadena.set(cadena, { libres: 0, total: 0 });
      continue;
    }
    const facultad = facultadDelTitular.get(cadena) || propia;
    const a = de(facultad);
    let cuenta = a.porCadena.get(cadena);
    if (!cuenta) { cuenta = { libres: 0, total: 0 }; a.porCadena.set(cadena, cuenta); }
    cuenta.total += 1;
    if (ESTADOS_LIBRES.has(texto(fila.sample_status))) {
      a.libres += 1;
      cuenta.libres += 1;
    } else {
      a.gastadas += 1;
    }
  }

  const filasFinales: ColchonDeFacultad[] = [];
  for (const a of porFacultad.values()) {
    let nuncaTuvo = 0;
    let agotadas = 0;
    for (const cuenta of a.porCadena.values()) {
      if (!cuenta.total) nuncaTuvo += 1;
      else if (!cuenta.libres) agotadas += 1;
    }
    const { porCadena: _omitido, ...resto } = a;
    filasFinales.push({ ...resto, nuncaTuvo, agotadas });
  }
  // Por riesgo y no alfabético: primero la que MÁS cadenas agotó, que es lo que
  // el operativo puede corregir; nunca-tuvo desempata porque es del diseño.
  return filasFinales.sort((x, y) =>
    y.agotadas - x.agotadas
    || y.nuncaTuvo - x.nuncaTuvo
    || y.titulares - x.titulares
    || x.facultad.localeCompare(y.facultad, "es"));
}
