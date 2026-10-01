import type { MonitoreoAulasAvanceCuota } from "../../../../api/monitoreo";
import { sexoEnPalabra } from "./tresLecturasDeCuota";

/**
 * **A quién se está alcanzando, contra la población — y nada más.**
 *
 * El estudio promete su cuota por el eje declarado. Sexo y carrera se
 * DESCRIBEN: sirven para saber a quién se está llegando, no para exigir nada.
 * Gonzalo, 2026-09-17: «Recuerda que la meta no es por sexo y nivel sino sólo
 * nivel».
 *
 * De ahí la regla que gobierna este módulo y su panel: **ni umbrales, ni
 * avisos de desvío, ni un tono de alarma.** El motor la respeta —tiene una
 * prueba de AUSENCIA que la defiende— y aquí se respeta igual: una diferencia
 * de diez puntos entre la población y lo recogido se enseña, no se juzga. Un
 * rojo convertiría en incumplimiento algo que el estudio no prometió.
 *
 * **El cálculo es del motor.** `.monitoreo_aulas_payload_sin_marco()` recorta
 * `quotas.category_profiles` del payload del estado —pesaba ~54 MB—, así que el
 * denominador poblacional NO se puede derivar desde aquí: un panel que lo
 * intente ve `undefined` en un estudio real y cero en los tests sintéticos.
 * Este módulo sólo ordena y redacta lo que `avance_cuota.composicion` trae.
 */

export type FilaDeComposicion = {
  categoria: string;
  /** La palabra con la que se dice: `F` → «Mujeres»; una carrera, tal cual. */
  etiqueta: string;
  poblacion: number;
  poblacionPct: number | null;
  obtenidas: number;
  obtenidasPct: number | null;
};

export type DimensionDeComposicion = {
  clave: string;
  etiqueta: string;
  poblacionTotal: number;
  obtenidasTotal: number;
  /**
   * **Si el proyecto declara la población de ESTA dimensión.**
   *
   * El módulo cuida la ausencia de lo OBTENIDO —`sin_padron` y `sin_cruce` se
   * dicen con su causa— y daba por supuesto que la población siempre se conoce.
   * No siempre: el motor la devuelve vacía cuando no la puede leer de la
   * config, y entonces el panel publicaba «451 de 0 de la población» y un
   * carril rotulado «todavía nada», que se lee como que está por llegar. Las
   * dos son el cero mudo que este módulo existe para no escribir. Visto en el
   * PDF a cliente de CCSS Perfil 2026-II el 2026-10-01.
   */
  poblacionDeclarada: boolean;
  filas: FilaDeComposicion[];
  /**
   * El tope del carril, en puntos porcentuales, común a las filas de ESTA
   * dimensión.
   *
   * Común y no por fila: lo que se compara es la forma de dos repartos, y con
   * una escala por fila todas las barras saldrían del mismo largo y no habría
   * nada que comparar. Por dimensión y no del panel entero porque sexo llega al
   * 52 % y la carrera más pequeña al 2 %: con un tope compartido, las seis
   * carreras quedarían en un hilo.
   */
  tope: number;
};

export type VistaDeComposicion = {
  /** Por qué no hay nada que describir, cuando no lo hay. Nunca un cero mudo. */
  vacio: string | null;
  personas: number;
  dimensiones: DimensionDeComposicion[];
};

function numero(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

function pctONulo(x: unknown): number | null {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * La palabra de una categoría.
 *
 * `sexoEnPalabra` es la del perfil y se reusa: hay seis traducciones de `F`/`M`
 * en este directorio y el plan lo dice con nombre y apellido —«no escribir una
 * tercera»—. Lo que no es sexo se dice tal como lo publica el motor: una
 * carrera ya viene con su nombre.
 */
function etiquetaDeCategoria(clave: string, categoria: string): string {
  if (clave !== "sexo") return categoria;
  const palabra = sexoEnPalabra(categoria);
  return palabra === "Sin sexo declarado" ? categoria : palabra;
}

export function composicionReferencial(
  bloque?: MonitoreoAulasAvanceCuota | null,
): VistaDeComposicion {
  const comp = (bloque ?? null)?.composicion ?? null;
  if (!comp) {
    return {
      vacio: "El estudio no publica la composición de su población, así que no hay marco con el que comparar lo recogido.",
      personas: 0, dimensiones: [],
    };
  }
  const personas = numero(comp.personas);
  const dimensiones: DimensionDeComposicion[] = [];
  for (const [clave, d] of Object.entries(comp.dimensiones ?? {})) {
    const filas: FilaDeComposicion[] = (d?.filas ?? [])
      .filter((f) => f && String(f.categoria ?? "").trim() !== "")
      .map((f) => ({
        categoria: String(f.categoria),
        etiqueta: etiquetaDeCategoria(clave, String(f.categoria)),
        poblacion: numero(f.poblacion),
        poblacionPct: pctONulo(f.poblacion_pct),
        obtenidas: numero(f.obtenidas),
        obtenidasPct: pctONulo(f.obtenidas_pct),
      }));
    if (!filas.length) continue;
    const tope = Math.max(
      10,
      ...filas.map((f) => Math.max(f.poblacionPct ?? 0, f.obtenidasPct ?? 0)),
    );
    dimensiones.push({
      clave,
      etiqueta: typeof d?.etiqueta === "string" && d.etiqueta ? d.etiqueta : clave,
      poblacionTotal: numero(d?.poblacion_total),
      obtenidasTotal: numero(d?.obtenidas_total),
      poblacionDeclarada: numero(d?.poblacion_total) > 0,
      filas, tope,
    });
  }
  if (!dimensiones.length) {
    return {
      vacio: "El estudio no publica dimensiones referenciales que describir.",
      personas, dimensiones: [],
    };
  }
  /**
   * **`sin_cruce` no es un cero: es «todavía no se puede decir».**
   *
   * El motor lo declara cuando ninguna respuesta resolvió contra el padrón —sin
   * respuestas, o con el padrón purgado—. Pintar seis carreras al 0 % haría
   * creer que se midió y salió cero. Aquí la población se conoce, así que se
   * dice qué falta, no que no haya nada.
   *
   * **Su espejo es `poblacionDeclarada`**, y conviene leerlos juntos: son las
   * dos mitades del mismo panel, y la de la población llegó un mes tarde porque
   * este bloque la daba por segura.
   */
  if (String(comp.fuente ?? "") === "sin_padron") {
    return {
      vacio: "Este estudio no cruza las respuestas con un padrón (su cuota va por curso-horario, o le falta el padrón o el código del estudiante), así que no se puede describir a quién se está alcanzando por sexo y carrera.",
      personas, dimensiones: [],
    };
  }
  if (String(comp.fuente ?? "") === "sin_cruce" || personas <= 0) {
    return {
      vacio: "Todavía ninguna respuesta resuelve contra el padrón, así que no se puede describir a quién se está alcanzando. La composición de la población sí se conoce y aparecerá en cuanto haya respuestas cruzadas.",
      personas, dimensiones,
    };
  }
  return { vacio: null, personas, dimensiones };
}
