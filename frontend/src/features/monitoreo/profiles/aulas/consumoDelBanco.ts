import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { colchonPorFacultad } from "./consumoDeCadena";
import { fechaDeAplicacion } from "./ritmoPorFacultad";

/**
 * A qué ritmo se está gastando el colchón, y cuándo se acaba.
 *
 * Gonzalo: «no es que los reemplazos sean una cosa infinita que podamos ir cada
 * vez que queramos… la idea operativa para algunos estudios es que no nos
 * pasemos de determinadas aulas».
 *
 * **Ese tope de política NO existe como dato**: ninguna configuración del perfil
 * declara un máximo de aulas. Lo que sí existe y sí es un techo real es el
 * banco: cuando una facultad se queda sin reservas libres, un aula que caiga ya
 * no se puede reemplazar. Esta función mide ese techo, que es el único que los
 * datos sostienen.
 *
 * `colchonPorFacultad` ya dice cuánto queda; lo que faltaba es **a qué ritmo se
 * gasta**, y eso lo dan las fechas de caída.
 */

export type ConsumoDeFacultad = {
  facultad: string;
  /** Reservas libres que le quedan. */
  quedan: number;
  /** Aulas suyas que ya cayeron. */
  caidas: number;
  /** Días distintos en los que cayó alguna. */
  diasConCaidas: number;
  /** Caídas por día con caídas. `null` si no hay fechas. */
  ritmo: number | null;
  /** Días hasta quedarse sin reservas al ritmo actual. `null` si no se puede. */
  diasHastaAgotarse: number | null;
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

export function consumoDelBanco(filas: ReadonlyArray<MonitoreoAulasPlanRow>): {
  facultades: ConsumoDeFacultad[];
  caidasPorDia: Array<{ fecha: string; caidas: number }>;
  sinFecha: number;
} {
  const colchon = new Map(colchonPorFacultad(filas).map((f) => [f.facultad, f]));

  const porFacultad = new Map<string, { caidas: number; dias: Set<string> }>();
  const porDia = new Map<string, number>();
  let sinFecha = 0;

  for (const fila of filas) {
    // Sólo lo que YA cayó. Una reserva en el banco no es consumo.
    if (texto(fila.sample_status) !== "reemplazada") continue;
    const facultad = texto(fila.faculty) || "Sin facultad";
    let f = porFacultad.get(facultad);
    if (!f) { f = { caidas: 0, dias: new Set() }; porFacultad.set(facultad, f); }
    f.caidas += 1;
    const fecha = fechaDeAplicacion((fila as { replaced_at?: unknown }).replaced_at);
    if (!fecha) { sinFecha += 1; continue; }
    f.dias.add(fecha);
    porDia.set(fecha, (porDia.get(fecha) ?? 0) + 1);
  }

  const facultades: ConsumoDeFacultad[] = [];
  for (const [facultad, f] of porFacultad) {
    const quedan = colchon.get(facultad)?.libres ?? 0;
    // Con UN solo día de caídas no hay ritmo: «1 caída en 1 día» daría «1/día»
    // y proyectaría el agotamiento del colchón desde una sola observación. Se
    // declara nulo, igual que la tendencia con menos de cuatro días.
    const ritmo = f.dias.size >= 2 ? Math.round((10 * f.caidas) / f.dias.size) / 10 : null;
    facultades.push({
      facultad,
      quedan,
      caidas: f.caidas,
      diasConCaidas: f.dias.size,
      ritmo,
      // Sin reservas ya no quedan días: es cero, no «no se sabe». Y sin ritmo
      // no se puede proyectar, que es distinto de «nunca se agota».
      diasHastaAgotarse: quedan === 0 ? 0 : ritmo && ritmo > 0 ? Math.ceil(quedan / ritmo) : null,
    });
  }

  // La que antes se queda sin colchón, primero. Las que ya están a cero
  // encabezan: no es que se vayan a agotar, es que ya pasó.
  facultades.sort((x, y) => {
    const a = x.diasHastaAgotarse; const b = y.diasHastaAgotarse;
    if ((a == null) !== (b == null)) return a == null ? 1 : -1;
    return (a ?? 0) - (b ?? 0) || y.caidas - x.caidas;
  });

  return {
    facultades,
    caidasPorDia: [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, caidas]) => ({ fecha, caidas })),
    sinFecha,
  };
}
