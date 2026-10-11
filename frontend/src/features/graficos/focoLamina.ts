// `foco` de una lámina en Procesamiento › Gráficos: una sola gramática para Láminas y Vista general.
//
// Se escribe el id estable de la lámina (`foco=<slide.id>`, el de `newId()` en el store o `.graficos_plan_slide_id` en
// el backend) y, para una ranura, `foco=<slide.id>:gK`. Reordenar, duplicar o insertar no cambia a qué lámina apunta un
// enlace. La forma por posición (`foco=l-07[:g2]`) es heredada: se sigue leyendo —enlaces guardados— y se resuelve contra
// el plan de ese momento, pero nunca se escribe; quien la lee la reescribe al id.

import type { Slide } from "../../api/graficos";

/** Lámina (y ranura) que nombra el `foco`, ya resuelta contra el plan. */
export type FocoLaminaResuelto = {
  id: string;
  /** Posición 1-based vigente de la lámina en el plan. */
  posicion: number;
  /** Ranura 1-based, o null si el foco nombra la lámina entera. */
  ranura: number | null;
  /** Vino en la forma heredada `l-NN`: hay que reescribirlo con `focoDeId`. */
  heredado: boolean;
};

type ConId = Pick<Slide, "id">;

const RANURA = /^(.+):g(\d{1,2})$/;
const HEREDADO = /^l-(\d{1,4})(?::g(\d{1,2}))?$/;

const ranuraValida = (r: string | undefined): number | null => {
  const n = r ? Number(r) : NaN;
  return Number.isInteger(n) && n >= 1 ? n : null;
};

/** Forma heredada `l-07` → lámina 7; `l-07:g2` → lámina 7, ranura 2. Cualquier otra cosa → null. */
export function parsearFocoHeredado(foco: string | null | undefined): { posicion: number; ranura: number | null } | null {
  const m = HEREDADO.exec((foco ?? "").trim());
  if (!m) return null;
  const posicion = Number(m[1]);
  if (!Number.isInteger(posicion) || posicion < 1) return null;
  return { posicion, ranura: ranuraValida(m[2]) };
}

/**
 * Resuelve el `foco` contra las láminas del plan, en su orden:
 * `<id>` → esa lámina; `<id>:gK` → esa lámina y su ranura K; `l-NN[:gK]` (heredado) → la N-ésima de ahora.
 * Un id inexistente, una posición fuera de rango o cualquier otra cosa → null (quien llama cae a su lámina por defecto).
 */
export function resolverFocoLamina(foco: string | null | undefined, slides: readonly ConId[]): FocoLaminaResuelto | null {
  const valor = (foco ?? "").trim();
  if (!valor) return null;
  const posicionDe = (id: string) => slides.findIndex((s) => s.id === id) + 1;

  // El id entero gana: un id que casualmente termine en `:gK` o tenga forma `l-NN` sigue siendo ese id.
  const exacta = posicionDe(valor);
  if (exacta > 0) return { id: valor, posicion: exacta, ranura: null, heredado: false };

  const conRanura = RANURA.exec(valor);
  if (conRanura) {
    const pos = posicionDe(conRanura[1]);
    if (pos > 0) return { id: conRanura[1], posicion: pos, ranura: ranuraValida(conRanura[2]), heredado: false };
  }

  const heredado = parsearFocoHeredado(valor);
  if (!heredado) return null;
  const slide = slides[heredado.posicion - 1];
  return slide ? { id: slide.id, posicion: heredado.posicion, ranura: heredado.ranura, heredado: true } : null;
}

/** El `foco` que se escribe para una lámina (y, opcionalmente, su ranura). */
export function focoDeId(id: string, ranura?: number | null): string {
  return ranura ? `${id}:g${ranura}` : id;
}
