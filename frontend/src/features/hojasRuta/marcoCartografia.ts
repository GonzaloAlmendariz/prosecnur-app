import type { HojasRutaState } from "../../api/hojasRuta";

// Vara V4 en Hojas de ruta. Dos cosas que el motor sabe y la pantalla no decía:
//
//  1. `frame_meta.note` explica qué cartografía está activa y que la oficial
//     queda disponible para auditoría. Se renderizaba **sólo** cuando
//     `frame.pilot` era verdadero, y en un proyecto normal `pilot` es falso:
//     la nota no aparecía nunca.
//
//  2. `frame_meta.audit` —doce campos— no tenía ningún consumidor. En
//     acnur_acg contiene la comparación del marco activo contra la
//     cartografía oficial INEI 2017: 117 352 manzanas en ambas, 1 056 sólo en
//     la oficial y 2 sólo en la activa. El propio motor lo resume como
//     «diferencias registradas sin bloquear el motor», y registradas se
//     quedaban.
//
// Es material de defensa del marco: quien tenga que sustentar la muestra
// necesita poder citarlo sin abrir un CSV de 118 410 filas.

type FrameMeta = NonNullable<HojasRutaState["frame_meta"]>;

export type MarcoCartografia = {
  /** Línea corta para el chip. */
  resumen: string;
  /** Todo lo que el motor sabe, para el `title`. */
  detalle: string;
  /** `true` cuando la nota viene de un marco piloto, que ya avisaba en ámbar. */
  piloto: boolean;
};

function numero(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function conMiles(value: number): string {
  return new Intl.NumberFormat("es-PE").format(value);
}

/**
 * Lo que hay que decir sobre la cartografía del marco, o `null` cuando el
 * motor no aporta nada — que es el único caso en el que callar es correcto.
 */
export function describirMarcoCartografia(frame: FrameMeta | null | undefined): MarcoCartografia | null {
  if (!frame) return null;
  const piloto = Boolean(frame.pilot);
  const nota = typeof frame.note === "string" ? frame.note.trim() : "";

  // En un marco piloto manda su nota, sola. Dos razones: dice que las manzanas
  // están limitadas al piloto —lo más consecuente que hay que saber— y
  // anteponerle la comparación la empujaba debajo de una pared de números. Y
  // además `frame.audit` audita SIEMPRE la cartografía empaquetada completa,
  // no el subconjunto del piloto: pegarla ahí describe un marco que no es el
  // que está en uso.
  if (piloto) return nota ? { resumen: nota, detalle: nota, piloto } : null;

  const audit = frame.audit;
  const counts = (audit?.available ? audit.status_counts : null) ?? null;
  const soloOficial = numero(counts?.official_only) ?? 0;
  const soloActiva = numero(counts?.current_only) ?? 0;
  const enAmbas = numero(counts?.both) ?? 0;

  const hayComparacion = enAmbas > 0 && (soloOficial > 0 || soloActiva > 0);

  if (!hayComparacion) {
    if (!nota) return null;
    return { resumen: nota, detalle: nota, piloto };
  }

  // El número va primero: el chip elide por la derecha, y con un preámbulo
  // delante lo que se pierde al truncar es justo el dato.
  const diferencias = [
    soloOficial > 0 ? `${conMiles(soloOficial)} manzanas sólo en la cartografía oficial` : "",
    soloActiva > 0
      ? soloOficial > 0
        ? `${conMiles(soloActiva)} sólo en la activa`
        : `${conMiles(soloActiva)} manzanas sólo en el marco activo`
      : "",
  ].filter(Boolean).join(" · ");

  const resumen = diferencias;
  const detalle = [
    `${conMiles(enAmbas)} manzanas coinciden con la cartografía oficial; ${diferencias}.`,
    nota,
  ].filter(Boolean).join(" ");

  return { resumen, detalle, piloto };
}
