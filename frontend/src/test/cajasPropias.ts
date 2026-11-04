/**
 * Detector común de «cajas propias» para los ratchets de P2 (un bloque con marco es un `Panel`).
 *
 * Una caja es un selector que, sumando TODAS sus reglas en la hoja, dibuja un marco: borde sólido, radio y
 * relleno. Las seis copias que tenía cada módulo miraban una regla a la vez y sólo veían la caja cuando las
 * tres cosas venían juntas; una caja repartida («.x { border… }» en un sitio y «.x { padding… }» en otro) no
 * contaba. Mordió dos veces: `.cmv2-panel` en Cálculo (los 23 bloques pasaron al kit y el conteo no bajó) y
 * `SettingBlock` en el Dashboard (4 nov 2026).
 *
 * Se cuenta por selector: una regla con tres selectores que dibujan caja son tres cajas. Las reglas dentro de
 * `@media` se suman a las de su selector, porque son la misma caja en otra medida.
 */

const BORDE_SOLIDO = /(?:^|;|\s)border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?\s*:[^;]*\bsolid\b|(?:^|;|\s)border-style\s*:[^;]*\bsolid\b/;
const RADIO = /(?:^|;|\s)border-(?:[a-z-]*-)?radius\s*:/;
const RELLENO = /(?:^|;|\s)padding(?:-[a-z-]+)?\s*:/;

type Rasgos = { borde: boolean; radio: boolean; relleno: boolean };

/** Las reglas de la hoja como `[selector, cuerpo]`, sin comentarios; las de `@media` se aplanan. */
export function reglasDeLaHoja(css: string): [string, string][] {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const reglas: [string, string][] = [];
  for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const prelude = m[1].trim();
    if (!prelude || prelude.startsWith("@")) continue;
    for (const sel of prelude.split(",")) {
      const s = sel.replace(/\s+/g, " ").trim();
      if (s) reglas.push([s, m[2]]);
    }
  }
  return reglas;
}

/** Los selectores de la hoja que, juntando todas sus reglas, dibujan una caja. */
export function selectoresConCaja(css: string): string[] {
  const porSelector = new Map<string, Rasgos>();
  for (const [sel, cuerpo] of reglasDeLaHoja(css)) {
    const r = porSelector.get(sel) ?? { borde: false, radio: false, relleno: false };
    r.borde ||= BORDE_SOLIDO.test(cuerpo);
    r.radio ||= RADIO.test(cuerpo);
    r.relleno ||= RELLENO.test(cuerpo);
    porSelector.set(sel, r);
  }
  return [...porSelector.entries()].filter(([, r]) => r.borde && r.radio && r.relleno).map(([s]) => s);
}

export function cajasDeLaHoja(css: string): number {
  return selectoresConCaja(css).length;
}
