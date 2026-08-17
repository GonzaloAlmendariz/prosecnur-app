import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

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
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** El titular de una fila: su `replacement_for` si es reserva, si no su código. */
function titularDe(fila: MonitoreoAulasPlanRow): string {
  return texto(fila.replacement_for)
    || texto(fila.titular_operational_code)
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
        const meta = numero(fila.expected_valid);
        return {
          codigo,
          // El titular es el orden 0 aunque el plan no lo diga: es de donde sale
          // la cadena.
          orden: esReserva(fila) ? Math.max(1, numero(fila.replacement_order)) : 0,
          status: texto(fila.sample_status),
          validas,
          meta,
          cumple: meta > 0 && validas >= meta,
        };
      })
      .sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo, "es"));

    const queCerro = eslabones.find((eslabon) => eslabon.cumple);
    historias.push({
      titular,
      facultad: texto(propias.find((f) => !esReserva(f))?.faculty ?? propias[0]?.faculty),
      eslabones,
      cerro: queCerro?.codigo ?? "",
      desenlace: !queCerro ? "abierta" : queCerro.orden === 0 ? "titular" : "reemplazo",
      validas: eslabones.reduce((suma, e) => suma + e.validas, 0),
    });
  }

  // Primero las abiertas —son las que piden decisión— y dentro, las más largas.
  const peso = { abierta: 0, reemplazo: 1, titular: 2 } as const;
  historias.sort((a, b) => peso[a.desenlace] - peso[b.desenlace]
    || b.eslabones.length - a.eslabones.length
    || a.titular.localeCompare(b.titular, "es"));

  return {
    historias,
    sinReserva,
    cerraronEnTitular: historias.filter((h) => h.desenlace === "titular").length,
    cerraronEnReemplazo: historias.filter((h) => h.desenlace === "reemplazo").length,
    abiertas: historias.filter((h) => h.desenlace === "abierta").length,
  };
}
