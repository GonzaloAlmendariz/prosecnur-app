/**
 * Límites del Perú en el lienzo (ADR 0119): país, departamentos y provincias,
 * para que una ciudad principal se lea en su lugar del mapa nacional y no
 * flotando sobre blanco. Datos de `limitesPeru.json`
 * (api/inst/hojas_ruta/build_limites_peru.R; provincias del IGN vía OCHA,
 * CC BY 3.0 IGO, la fuente va en el mapa).
 */

import type { UtilLienzo } from "./LienzoMapa";
import { proyectarLonLat } from "./camara";
import { cajaDe, type Pieza } from "./piezas";

type AnillosCrudos = unknown;
export type LimitesCrudos = {
  fuente?: string;
  pais?: AnillosCrudos;
  departamentos?: Array<{ nombre?: string; rotulo?: unknown; anillos?: AnillosCrudos }>;
  provincias?: Array<{ nombre?: string; departamento?: string; anillos?: AnillosCrudos }>;
};

export type LimiteNombrado = Pieza & { nombre: string; rotulo: [number, number] };
export type LimitesPeru = { fuente: string; pais: Pieza[]; departamentos: LimiteNombrado[]; provincias: Pieza[] };

/** Más cerca que esto (una ciudad en pantalla) país y departamentos no orientan: cruzan la ciudad (checklist F3). */
export const ESCALA_SIN_LIMITES = 0.004;
/** Las provincias sólo se trazan desde esta escala (una región en pantalla); antes enredan. */
export const ESCALA_PROVINCIAS = 0.0012;
/** Por debajo de esta escala (más lejos que Lima entera) se rotulan los departamentos. */
export const ESCALA_NOMBRES_DEPARTAMENTO = 0.003;
/**
 * Desde esta escala (unos 2 km por píxel) el trazo nacional, simplificado a 3 km, se ve quebrado y va el
 * fino (400 m). Los dos niveles salen del mismo pipeline con topología compartida (build_limites_peru.R):
 * dentro de un nivel, la frontera de dos departamentos es una sola línea.
 */
export const ESCALA_DETALLE = 0.0005;

export type NivelesLimites = { nacional: LimitesPeru; fino: LimitesPeru | null };
/** El nivel que se dibuja a esa escala; mientras el fino no llega, el nacional. */
export const limitesALaEscala = (n: NivelesLimites, s: number): LimitesPeru => (n.fino && s >= ESCALA_DETALLE ? n.fino : n.nacional);

function anillos(crudo: AnillosCrudos): number[][] {
  if (!Array.isArray(crudo)) return [];
  return crudo
    .map((r) => (Array.isArray(r) ? r.flatMap((p) => (Array.isArray(p) && p.length >= 2 ? proyectarLonLat(Number(p[0]), Number(p[1])) : [])) : []))
    .filter((r) => r.length >= 6);
}

function pieza(crudo: AnillosCrudos): Pieza | null {
  const a = anillos(crudo);
  return a.length ? { anillos: a, caja: cajaDe(a) } : null;
}

export function limitesDePeru(crudo: LimitesCrudos): LimitesPeru {
  const pais = pieza(crudo.pais);
  return {
    fuente: String(crudo.fuente ?? ""),
    pais: pais ? [pais] : [],
    departamentos: (crudo.departamentos ?? []).flatMap((d) => {
      const p = pieza(d.anillos);
      if (!p) return [];
      const r = Array.isArray(d.rotulo) && d.rotulo.length >= 2 ? proyectarLonLat(Number(d.rotulo[0]), Number(d.rotulo[1])) : [(p.caja[0] + p.caja[2]) / 2, (p.caja[1] + p.caja[3]) / 2];
      return [{ ...p, nombre: String(d.nombre ?? ""), rotulo: [r[0], r[1]] as [number, number] }];
    }),
    provincias: (crudo.provincias ?? []).flatMap((d) => {
      const p = pieza(d.anillos);
      return p ? [p] : [];
    }),
  };
}

/** Debajo de todo: el país relleno con el fondo, y encima las líneas de provincia, departamento y país. */
export function dibujarLimites(ctx: CanvasRenderingContext2D, u: UtilLienzo, l: LimitesPeru) {
  if (u.camara.s >= ESCALA_SIN_LIMITES) return;
  ctx.save();
  ctx.lineJoin = "round";
  if (u.camara.s >= ESCALA_PROVINCIAS) {
    ctx.strokeStyle = u.colores.distritoBorde;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 0.6 * u.px;
    for (const p of l.provincias) ctx.stroke(u.trazo(p));
  }
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = u.colores.suave;
  ctx.lineWidth = 1.1 * u.px;
  for (const p of l.departamentos) ctx.stroke(u.trazo(p));
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = u.colores.texto;
  ctx.lineWidth = 1.5 * u.px;
  for (const p of l.pais) ctx.stroke(u.trazo(p));
  ctx.restore();
}

/**
 * La esquina inferior derecha que ocupan el zoom, la escala y la atribución de límites (a h − 66): ningún
 * rótulo del mapa debe caer ahí, se lee tapado. [x0, y0, x1, y1] en píxeles del lienzo.
 */
export const zonaControles = (w: number, h: number): [number, number, number, number] => [w - 236, h - 80, w, h];

/** Nombres de departamento en versalitas tenues, sólo cuando se ve el país o una región. */
export function dibujarNombresDepartamento(ctx: CanvasRenderingContext2D, u: UtilLienzo, l: LimitesPeru) {
  if (u.camara.s >= ESCALA_NOMBRES_DEPARTAMENTO) return;
  ctx.save();
  ctx.font = "600 10px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = u.colores.suave;
  ctx.globalAlpha = 0.8;
  const zona = zonaControles(u.tamano.w, u.tamano.h);
  for (const d of l.departamentos) {
    const [x, y] = u.aPantalla(d.rotulo[0], d.rotulo[1]);
    if (x < 20 || y < 20 || x > u.tamano.w - 20 || y > u.tamano.h - 20) continue;
    const nombre = d.nombre.toLocaleUpperCase("es-PE");
    const mitad = ctx.measureText(nombre).width / 2;
    if (x + mitad > zona[0] && y + 6 > zona[1]) continue;
    ctx.fillText(nombre, x, y);
  }
  // La licencia de las provincias (CC BY 3.0 IGO) pide citar la fuente donde se ven.
  ctx.font = "500 9.5px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.globalAlpha = 0.7;
  // Encima del grupo de zoom y la escala (≈ 48 px desde el borde con su sombra): a 54 px el texto quedaba bajo
  // el borde de los controles y se leía «IGN vía OCHA» tapado.
  // Con halo del fondo, como los rótulos: a 1024 cae sobre marcas de ciudad y nombres de departamento.
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = u.colores.fondo;
  ctx.strokeText("Límites: IGN vía OCHA, CC BY 3.0 IGO", u.tamano.w - 12, u.tamano.h - 66);
  ctx.fillText("Límites: IGN vía OCHA, CC BY 3.0 IGO", u.tamano.w - 12, u.tamano.h - 66);
  ctx.restore();
}
