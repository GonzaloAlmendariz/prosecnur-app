import { trenzaGeometria, type TrenzaCinta, type TrenzaOpciones } from "./trenzaGeometria";

/**
 * El interior del svg del isotipo «Trenza» como texto (defs + contenedor + trenza), con las mismas clases y la
 * misma proporción `--k` por parada que pinta `IsotipoTrenza`. Lo usa `IsotipoCarga` para animar SIN estado de
 * React: cada cuadro reescribe el interior del svg desde un requestAnimationFrame. Un `setState` por cuadro
 * encolaba una actualización que interrumpía el reintento de Suspense y el módulo perezoso nunca montaba
 * (R11-1: «Vista general» quedaba en «Cargando…» con movimiento activado).
 */
export function marcadoTrenza(id: string, opciones: TrenzaOpciones & { contenedor?: boolean } = {}): string {
  const { contenedor = true, ...op } = opciones;
  const g = trenzaGeometria(op);
  const degradado = (c: TrenzaCinta, gid: string) =>
    `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${c.x1}" y1="0" x2="${c.x2}" y2="0">`
    + c.paradas.map((p) => `<stop offset="${p.offset}" style="--k:${p.k}"></stop>`).join("")
    + "</linearGradient>";
  const defs = `<clipPath id="${id}-huso"><path d="${g.huso}"></path></clipPath>`
    + g.atras.map((c, i) => degradado(c, `${id}-a${i}`)).join("")
    + g.adelante.map((c, i) => degradado(c, `${id}-d${i}`)).join("")
    + g.filos.map((filo) => `<clipPath id="${id}-f${filo.hilo}">${filo.recorte.map((d) => `<path d="${d}"></path>`).join("")}</clipPath>`).join("");
  const cuerpo = g.atras.map((c, i) => `<path d="${c.d}" fill="url(#${id}-a${i})"></path>`).join("")
    + g.filos.map((filo) =>
      `<g clip-path="url(#${id}-f${filo.hilo})" fill="none" stroke-width="${g.anchoFilo}" stroke-linecap="round" stroke-linejoin="round" class="pulso-isotipo-filo">`
      + filo.lineas.map((d) => `<path d="${d}"></path>`).join("")
      + "</g>").join("")
    + g.adelante.map((c, i) => `<path d="${c.d}" fill="url(#${id}-d${i})"></path>`).join("");
  return `<defs>${defs}</defs>`
    + (contenedor ? '<rect class="pulso-isotipo-contenedor" width="100" height="100" rx="24"></rect>' : "")
    + `<g transform="rotate(${g.rotacion} 50 50)"><g clip-path="url(#${id}-huso)">${cuerpo}</g></g>`;
}
