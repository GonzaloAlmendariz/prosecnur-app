import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { comparaCodigos } from "./aulasPresentation";

/**
 * Cómo llegó cada cadena a su meta —o por qué no llegó.
 *
 * La tabla de reemplazos dice qué reserva entró y por qué; el histograma de
 * consumo dice cuánta reserva se gastó. Ninguno de los dos contesta lo que se
 * pregunta al cerrar el operativo: **cómo nos fue en el titular, cómo nos fue en
 * su reemplazo, y cuál de los dos cerró la meta.**
 *
 * Cada eslabón lleva su propia meta —el aforo elegible de ESA aula—, así que el
 * cierre no se acumula entre eslabones: cierra el primero que llega a la suya.
 */

export type EslabonDeCadena = {
  /** Código operativo: `CH 4` el titular, `R 4.1` la primera reserva. */
  codigo: string;
  /** `EN RESERVA n` del Excel: 0 es el titular. */
  orden: number;
  /** `STATUS MUESTRA` tal como lo trae el plan. */
  status: string;
  /** Respuestas válidas atribuidas a ese eslabón. */
  validas: number;
  /** Su meta propia. */
  meta: number;
  /** Si ese eslabón, por sí solo, alcanzó su meta. */
  cumple: boolean;
  /**
   * **No hay por dónde llamarle.** El resultado de la llamada dice «Número no
   * existe» o «fuera de servicio», así que su «En contacto» no es una gestión en
   * marcha: es una vía muerta.
   *
   * Visto en pantalla el 2026-09-11: la cadena de CH 85 —Derecho, titular
   * rechazado— mostraba `R 85.1 · En contacto`, y ese mismo R 85.1 salía en el
   * panel de riesgo entre los que no tienen teléfono válido. Quien trabajara
   * esta pantalla habría vuelto a llamar a un número inexistente en vez de
   * saltar a R 85.2.
   */
  sinVia: boolean;
};

export type HistoriaDeCadena = {
  /** Código del titular, que da nombre a la cadena. */
  titular: string;
  facultad: string;
  eslabones: EslabonDeCadena[];
  /** Código del eslabón que cerró la meta; vacío si ninguno llegó. */
  cerro: string;
  /** Dónde cerró: en el titular, en una reserva, o en ninguno. */
  desenlace: "titular" | "reemplazo" | "abierta";
  /** Respuestas válidas sumadas de toda la cadena. */
  validas: number;
  /**
   * La meta que la cadena tiene que alcanzar, que es la del TITULAR.
   *
   * No se suman las de los eslabones: reemplazar un aula no multiplica lo que
   * el estudio pide, la reserva entra a cubrir la misma meta que dejó el
   * titular. Sumarlas daría 30 donde el plan pide 15.
   */
  meta: number;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
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
 *
 * **Y no porque `replacement_for` venga siempre mal: porque viene INCONSISTENTE.**
 * Medido el 2026-08-30 sobre el estudio de 1.424 filas, ese mismo campo trae
 * códigos operativos —«CH 3», «CH 4»— y sus 174 valores distintos existen los
 * 174 como fila, justo al revés que en el estudio de 2.615. Un campo que en un
 * proyecto es `classroom_id` y en otro es código operativo no se puede usar
 * como clave, y eso vale más que «viene mal»: `titular_operational_code`
 * mapea en los dos.
 */
function titularDe(fila: MonitoreoAulasPlanRow): string {
  return texto(fila.titular_operational_code)
    || texto(fila.operational_code);
}

function esReserva(fila: MonitoreoAulasPlanRow) {
  return texto(fila.sample_role) === "chain_reserve";
}

/**
 * Arma la historia de cada cadena que tuvo movimiento.
 *
 * **Sólo las cadenas con reserva**: un titular sin ninguna reserva no tiene
 * historia que contar y llenaría la vista con 170 filas de una sola línea. El
 * conteo de esos va aparte, en `sinReserva`.
 *
 * `sinReserva` cuenta titulares a los que el diseño muestral NO asignó reserva.
 * Se llamaba `sinMovimiento` y se leía como «no necesitaron reemplazo», que es
 * otra afirmación y tranquilizadora: el dato no dice si la necesitaron, dice que
 * si caen no hay con qué cubrirlas. El pie del gráfico de consumo —que cuenta
 * exactamente el mismo conjunto en `consumoDeCadena.sinReserva`— ya lo decía
 * así, y las dos frases se contradecían a dos renglones de distancia.
 */
export function historiaDeCadena(filas: ReadonlyArray<MonitoreoAulasPlanRow>) {
  // `agenda` basta: trae la estructura de la cadena Y las cuentas
  // —`respuestas_validas` y `expected_valid`, comprobado que coinciden con
  // `course_status`—. Llegué a unir las dos fuentes creyendo que a la agenda le
  // faltaban las válidas; el «0 de N» que veía era el valor real: las aulas que
  // necesitaron reemplazo son precisamente las que no recogieron nada.
  const porCadena = new Map<string, MonitoreoAulasPlanRow[]>();
  for (const fila of filas) {
    const cadena = titularDe(fila);
    if (!cadena) continue;
    // El banco fuera. `extra_reserve_pool` son reservas sueltas sin titular al
    // que volver: no forman cadena. Aquí no llegaban a dibujar una tarjeta
    // —caen en la rama «sin reserva» y se saltan— pero SÍ engordaban ese
    // contador, que es el que alimenta «ninguno de los N cursos-horario
    // titulares tiene reserva asignada». Sobre HSVG2026 esa frase pasaba a
    // hablar de 639 aulas que no son titulares de nada.
    if (texto(fila.sample_role) === "extra_reserve_pool") continue;
    const actual = porCadena.get(cadena);
    if (actual) actual.push(fila);
    else porCadena.set(cadena, [fila]);
  }

  const historias: HistoriaDeCadena[] = [];
  let sinReserva = 0;

  for (const [titular, propias] of porCadena) {
    if (!propias.some(esReserva)) { sinReserva += 1; continue; }
    const eslabones = propias
      .map((fila) => {
        const codigo = texto(fila.operational_code);
        const validas = numero(fila.respuestas_validas);
        // **La meta se publica en personas enteras.** `expected_valid` es
        // `elegibles x tasa` y llega fraccionaria por construcción: la tabla
        // mostraba «META 24.6» y «CH 88, 18 de 24.6». Es la QUINTA vez que el
        // mismo defecto aparece hoy, y las cuatro anteriores las arreglé donde
        // las vi en vez de barrer las tablas.
        //
        // Hacia ARRIBA, como `.mac_brecha()` y `fmtCuenta()`: es una meta que
        // hay que ALCANZAR, y con 24 no se cumple una de 24,6. La comparación
        // `cumple` usa la meta ya redondeada, que es contra la que se juzga.
        const meta = Math.ceil(numero(fila.expected_valid) - 1e-9);
        return {
          codigo,
          // El titular es el orden 0 aunque el plan no lo diga: es de donde sale
          // la cadena.
          orden: esReserva(fila) ? Math.max(1, numero(fila.replacement_order)) : 0,
          status: texto(fila.sample_status),
          validas,
          meta,
          cumple: meta > 0 && validas >= meta,
          // El mismo criterio que el motor (`.maau_con_fecha` y su vecino
          // `sin_via`): sin tildes y por subcadena, porque el libro lo escribe
          // a mano —«Número no existe», «NUMERO FUERA DE SERVICIO»—.
          sinVia: /no existe|fuera de servicio/.test(
            texto((fila as { call_status?: unknown }).call_status)
              .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
          ),
        };
      })
      .sort((a, b) => a.orden - b.orden || comparaCodigos(a.codigo, b.codigo));

    const queCerro = eslabones.find((eslabon) => eslabon.cumple);
    historias.push({
      titular,
      facultad: texto(propias.find((f) => !esReserva(f))?.faculty ?? propias[0]?.faculty),
      eslabones,
      cerro: queCerro?.codigo ?? "",
      desenlace: !queCerro ? "abierta" : queCerro.orden === 0 ? "titular" : "reemplazo",
      validas: eslabones.reduce((suma, e) => suma + e.validas, 0),
      meta: eslabones.find((e) => e.orden === 0)?.meta ?? eslabones[0]?.meta ?? 0,
    });
  }

  // Primero las abiertas —son las que piden decisión— y dentro, las más largas.
  const peso = { abierta: 0, reemplazo: 1, titular: 2 } as const;
  historias.sort((a, b) => peso[a.desenlace] - peso[b.desenlace]
    || b.eslabones.length - a.eslabones.length
    || comparaCodigos(a.titular, b.titular));

  return {
    historias,
    sinReserva,
    cerraronEnTitular: historias.filter((h) => h.desenlace === "titular").length,
    cerraronEnReemplazo: historias.filter((h) => h.desenlace === "reemplazo").length,
    abiertas: historias.filter((h) => h.desenlace === "abierta").length,
    // **Sin intentar no es lo mismo que no llegó.** Una cadena abierta que no
    // ha recibido ni una respuesta no falló su meta: todavía no se aplicó. El
    // KPI decía «ningún eslabón llegó a su meta» sobre las 193, cuando 183 ni
    // se habían visitado — y eso convierte trabajo pendiente en fracaso.
    sinRespuestaAlguna: historias
      .filter((h) => h.desenlace === "abierta" && !h.validas).length,
  };
}
