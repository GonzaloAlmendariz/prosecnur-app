// Geometría de la ficha de una ranura (contrato de la maqueta M2–M5, M8; galería aprobada el 2026-10-13). Pura: dada la
// ficha y el tamaño de la ranura en pulgadas de la lámina, devuelve las piezas en coordenadas locales (0..w, 0..h).
// - Retícula común (Gonzalo: «que todo se vea ordenado y pulcro en términos de orden, geometrías y contenedores»): en
//   horizontal, la columna de información y el dibujo comparten borde superior y alto; en vertical, todo a una sangría.
// - M3: el bloque se centra en la ficha.
// - M4: si la información no cabe, se ajusta por niveles hasta caber; nada se sale de la ficha.
// - Las barras llevan clave para transitar (M8).

import type { FichaInfo, FormaBarras, LeyendaFicha } from "./fichaModelo";

export type Caja = { x: number; y: number; w: number; h: number };
export type TonoChip = "publico" | "ajuste" | "aviso";
export type Pieza =
  | ({ tipo: "cabecera"; texto: string; fs: number; lado: number } & Caja)
  | { tipo: "texto"; x: number; y: number; texto: string; fs: number; estilo: "pregunta" | "suave" }
  | ({ tipo: "chip"; texto: string; fs: number; tono: TonoChip } & Caja)
  | ({ tipo: "leyenda"; titulo: string | null; fs: number; modo: "completa" | "linea"; items: { x: number; y: number; lado: number; color: string; texto: string | null }[] } & Caja)
  | ({ tipo: "barra"; clave: string; color: string; rol: "segmento" | "ttb" | "pregunta" } & Caja)
  | { tipo: "separador"; x1: number; x2: number; y: number }
  | ({ tipo: "glifo"; tenue: boolean } & Caja)
  | { tipo: "vacia"; x: number; y: number; texto: string; fs: number };

export type EscenaFicha = { w: number; h: number; fs: number; nivel: number; horizontal: boolean; piezas: Pieza[]; info: Caja | null; dibujo: Caja | null };

/**
 * Ancho aproximado de un texto en la letra de la app (system-ui): 0,57 em por carácter, 0,62 en negrita. Medido en el
 * editor («Totalmente en desacuerdo» a 0,211 in mide 2,84 in: 0,56 em); con 0,5 las leyendas se encimaban.
 */
const EM = 0.57, EM_NEGRITA = 0.62;
export const anchoTexto = (t: string, fs: number, negrita = false): number => t.length * fs * (negrita ? EM_NEGRITA : EM);

export function recortar(t: string, max: number, fs: number, negrita = false): string {
  if (anchoTexto(t, fs, negrita) <= max) return t;
  const n = Math.floor(max / (fs * (negrita ? EM_NEGRITA : EM))) - 1;
  return n <= 2 ? "" : `${t.slice(0, n).trimEnd()}…`;
}

/** Líneas que caben en `max`; la última lleva el resto recortado con un solo «…». */
export function lineas(t: string, max: number, fs: number, maxLineas: number, negrita = false): string[] {
  const out: string[] = [];
  let cur = "";
  for (const p of t.split(/\s+/).filter(Boolean)) {
    const prueba = cur ? `${cur} ${p}` : p;
    if (anchoTexto(prueba, fs, negrita) <= max) cur = prueba;
    else { if (cur) out.push(cur); cur = p; }
  }
  if (cur) out.push(cur);
  if (out.length > maxLineas) {
    const resto = out.slice(maxLineas - 1).join(" ");
    out.length = maxLineas;
    out[maxLineas - 1] = recortar(resto, max, fs, negrita);
  }
  return out.map((l) => recortar(l, max, fs, negrita)).filter(Boolean);
}

/** Proporciones verosímiles de una escala de n respuestas (no son cifras: la maqueta no las inventa). */
export function proporciones(n: number, semilla: number): number[] {
  const centro = 0.62 * (n - 1);
  const v = Array.from({ length: n }, (_, k) => (0.25 + Math.exp(-((k - centro) ** 2) / Math.max(1, n / 2))) * (1 + Math.sin(semilla * 7.3 + k * 2.1) * 0.3));
  const s = v.reduce((a, b) => a + b, 0);
  return v.map((x) => x / s);
}

/** Barras de la forma dentro de `caja`: filas reales por tema, la columna de la pregunta a su ancho y la del Top Two Box. */
export function barrasDeForma(forma: FormaBarras, caja: Caja, clave = ""): Pieza[] {
  const piezas: Pieza[] = [];
  const algunTtb = forma.bloques.some((b) => b.ttb);
  const filas = forma.bloques.reduce((a, b) => a + b.temas.reduce((x, t) => x + t.filas, 0), 0);
  if (!filas) return piezas;
  const huecos = forma.bloques.reduce((a, b) => a + b.temas.length - 1, 0) * 0.5 + (forma.bloques.length - 1) * 1.1;
  const paso = Math.min(0.8, caja.h / (filas + huecos));
  const barH = Math.min(0.5, paso * 0.64);
  const temaW = caja.w * Math.min(0.45, forma.eje * 1.1);
  const ttbW = algunTtb ? Math.max(0.35, caja.w * 0.09) : 0;
  const x0 = caja.x + temaW + (temaW ? 0.12 : 0);
  const w = caja.w - (x0 - caja.x) - ttbW - (ttbW ? 0.1 : 0);
  let y = caja.y + Math.max(0, (caja.h - paso * (filas + huecos)) / 2);
  let semilla = 1;
  forma.bloques.forEach((b, bi) => {
    if (bi) {
      y += paso * 0.55;
      piezas.push({ tipo: "separador", x1: caja.x, x2: caja.x + caja.w, y });
      y += paso * 0.55;
    }
    b.temas.forEach((t, ti) => {
      if (ti) y += paso * 0.5;
      const yTema = y;
      for (let fi = 0; fi < t.filas; fi += 1) {
        const yb = y + (paso - barH) / 2;
        let x = x0;
        proporciones(b.colores.length || 1, semilla++).forEach((p, k) => {
          const ww = p * w;
          piezas.push({ tipo: "barra", rol: "segmento", clave: `${clave}${bi}-${ti}-${fi}-${k}`, x, y: yb, w: Math.max(0.005, ww - 0.015), h: barH, color: b.colores[k] ?? "rgb(160,163,170)" });
          x += ww;
        });
        if (b.ttb) piezas.push({ tipo: "barra", rol: "ttb", clave: `${clave}${bi}-${ti}-${fi}-t`, x: x0 + w + 0.1 + ttbW * 0.15, y: yb + barH * 0.2, w: ttbW * 0.7, h: barH * 0.6, color: "" });
        y += paso;
      }
      if (temaW) piezas.push({ tipo: "barra", rol: "pregunta", clave: `${clave}${bi}-${ti}-q`, x: caja.x, y: (yTema + y) / 2 - paso * 0.12, w: temaW * 0.85, h: paso * 0.24, color: "" });
    });
  });
  return piezas;
}

// ── Información: chips y leyendas, medidas y colocadas ──

function chips(textos: readonly string[], x: number, y: number, maxW: number, fs: number, tono: TonoChip): { piezas: Pieza[]; h: number } {
  const piezas: Pieza[] = [];
  const alto = fs * 1.55, gap = fs * 0.4;
  let cx = x, cy = y;
  for (const t of textos) {
    const tt = recortar(t, maxW - fs, fs * 0.9);
    if (!tt) continue;
    const w = anchoTexto(tt, fs * 0.9) + fs * 1.1;
    if (cx > x && cx + w > x + maxW) { cx = x; cy += alto + gap; }
    piezas.push({ tipo: "chip", x: cx, y: cy, w, h: alto, texto: tt, fs: fs * 0.9, tono });
    cx += w + gap;
  }
  return { piezas, h: piezas.length ? cy - y + alto : 0 };
}

function leyenda(ley: LeyendaFicha, x: number, y: number, maxW: number, fs: number, modo: "completa" | "linea"): { pieza: Pieza; h: number } {
  const pad = fs * 0.55;
  if (modo === "linea") {
    const h = fs * 1.6;
    let cx = x + pad;
    const titulo = ley.titulo ? recortar(ley.titulo, maxW * 0.55, fs * 0.85, true) : null;
    if (titulo) cx += anchoTexto(titulo, fs * 0.85, true) + fs * 0.5;
    const lado = Math.max(0.04, Math.min(fs * 0.9, (x + maxW - pad - cx) / Math.max(1, ley.items.length) - 0.03));
    const items = ley.items.map((it, k) => ({ x: cx + k * (lado + 0.03), y: y + (h - lado) / 2, lado, color: it.color, texto: null }));
    return { pieza: { tipo: "leyenda", modo, x, y, w: maxW, h, titulo, fs: fs * 0.85, items }, h };
  }
  const lh = fs * 1.45;
  let cx = x + pad, cy = y + pad + (ley.titulo ? fs * 1.3 : 0);
  const items: { x: number; y: number; lado: number; color: string; texto: string | null }[] = [];
  for (const it of ley.items) {
    const tt = recortar(it.rotulo, maxW - pad * 2 - fs * 1.2, fs * 0.88) || it.rotulo.slice(0, 1);
    const w = fs * 0.8 + 0.06 + anchoTexto(tt, fs * 0.88) + fs * 0.9;
    if (cx > x + pad && cx + w > x + maxW - pad) { cx = x + pad; cy += lh; }
    items.push({ x: cx, y: cy + lh * 0.2, lado: fs * 0.8, color: it.color, texto: tt });
    cx += w;
  }
  const h = cy - y + lh + pad * 0.6;
  const titulo = ley.titulo ? recortar(ley.titulo, maxW - pad * 2, fs * 0.85, true) : null;
  return { pieza: { tipo: "leyenda", modo, x, y, w: maxW, h, titulo, fs: fs * 0.88, items }, h };
}

/**
 * El cuerpo de la información (sin la cabecera) en el nivel de ajuste `nivel` (M4):
 * 0 todo · 1 una pregunta y «y N más» · 2 las leyendas siguientes en línea · 3 todas en línea · 4 sin chips de ajustes ·
 * 5 públicos como conteo · 6 sin preguntas · 7 sin leyendas · 8 sólo la cabecera y el dibujo.
 */
function cuerpo(info: FichaInfo, x: number, y0: number, colW: number, fs: number, nivel: number): { piezas: Pieza[]; h: number } {
  const piezas: Pieza[] = [];
  const gap = fs * 0.5;
  let y = y0;
  const pregs = nivel >= 6 ? [] : nivel >= 1 || info.preguntas.length > 2 ? info.preguntas.slice(0, 1) : info.preguntas;
  const mas = nivel >= 6 ? 0 : info.preguntas.length - pregs.length;
  for (const q of pregs) {
    lineas(q, colW, fs * 0.95, nivel >= 1 ? 1 : 2, true).forEach((l) => {
      piezas.push({ tipo: "texto", x, y: y + fs * 0.95, texto: l, fs: fs * 0.95, estilo: "pregunta" });
      y += fs * 1.2;
    });
  }
  if (mas > 0) { piezas.push({ tipo: "texto", x, y: y + fs * 0.85, texto: `y ${mas} ${mas === 1 ? "pregunta" : "preguntas"} más`, fs: fs * 0.85, estilo: "suave" }); y += fs * 1.15; }
  if (pregs.length || mas) y += gap;
  const pubs = nivel >= 8 ? [] : nivel >= 5 && info.publicos.length > 1 ? [`${info.publicos.length} públicos`] : info.publicos;
  if (pubs.length) { const c = chips(pubs, x, y, colW, fs, "publico"); piezas.push(...c.piezas); y += c.h + gap; }
  (nivel >= 7 ? [] : info.leyendas).forEach((ley, k) => {
    const modo = nivel >= 3 || (nivel >= 2 && k > 0) ? "linea" : "completa";
    const l = leyenda(ley, x, y, colW, fs, modo);
    piezas.push(l.pieza);
    y += l.h + gap;
  });
  const aj = chips(nivel >= 4 ? [] : info.ajustes, x, y, colW, fs, "ajuste");
  const av = chips(nivel >= 8 ? [] : info.avisos, x, y + (aj.h ? aj.h + gap * 0.8 : 0), colW, fs, "aviso");
  piezas.push(...aj.piezas, ...av.piezas);
  y += aj.h + (aj.h && av.h ? gap * 0.8 : 0) + av.h;
  return { piezas, h: Math.max(0, y - y0 - (aj.h || av.h ? 0 : gap)) };
}

/** La escena de la ficha de una ranura de `w` × `h` pulgadas. */
export function escenaFicha(info: FichaInfo, w: number, h: number, clave = ""): EscenaFicha {
  const fs = Math.max(0.19, Math.min(0.24, Math.min(w * 0.034, h * 0.06)));
  const pad = Math.min(0.3, Math.max(0.16, w * 0.045));
  const gap = fs * 0.5;
  const ix = pad, iy = pad, iw = w - pad * 2, ih = h - pad * 2;
  const cab = fs * 1.3;
  if (info.vacia) return { w, h, fs, nivel: 0, horizontal: false, info: null, dibujo: null, piezas: [{ tipo: "vacia", x: w / 2, y: h / 2, texto: "Elegir gráfico", fs: fs * 1.2 }] };

  // Apaisada (aunque sea baja, 8,5 × 1,6 in en «Dos gráficos + texto izquierda»): información y dibujo lado a lado.
  const horizontal = w >= 5 && w / h >= 1.55;
  const colW = horizontal ? Math.min(5.4, iw * 0.44) : iw;
  const cabecera = (x: number, y: number): Pieza => ({ tipo: "cabecera", x, y, w: colW, h: cab, lado: cab, fs, texto: recortar(info.tipo, colW - cab - fs * 0.5, fs, true) });
  const info2: FichaInfo = info.faltaPregunta ? { ...info, avisos: ["Falta elegir la pregunta"] } : info;
  const nivelQueCabe = (disp: number) => { for (let n = 0; n <= 8; n += 1) if (cuerpo(info2, 0, 0, colW, fs, n).h <= disp) return n; return 8; };
  const dibujo = (caja: Caja): Pieza[] => (info2.forma && !info2.faltaPregunta ? barrasDeForma(info2.forma, caja, clave) : [{ tipo: "glifo", ...caja, tenue: info2.faltaPregunta }]);

  if (horizontal) {
    const nivel = nivelQueCabe(ih - cab - gap);
    const hInfo = cab + gap + cuerpo(info2, 0, 0, colW, fs, nivel).h;
    const gx = ix + colW + pad * 1.4, gw = w - pad - gx;
    const alto = Math.min(ih, Math.max(hInfo, Math.min(ih, gw * 0.5)));
    const y0 = iy + (ih - alto) / 2;
    const yInfo = y0 + (alto - hInfo) / 2;
    const cajaDibujo = { x: gx, y: y0, w: gw, h: alto };
    return {
      w, h, fs, nivel, horizontal: true, info: { x: ix, y: yInfo, w: colW, h: hInfo }, dibujo: cajaDibujo,
      piezas: [cabecera(ix, yInfo), ...cuerpo(info2, ix, yInfo + cab + gap, colW, fs, nivel).piezas, ...dibujo(cajaDibujo)],
    };
  }
  const minDibujo = Math.max(0.5, ih * 0.32);
  const nivel = nivelQueCabe(ih - cab - gap * 2 - minDibujo);
  const hPie = cuerpo(info2, 0, 0, colW, fs, nivel).h;
  const gh = Math.max(minDibujo, Math.min(ih * 0.62, ih - cab - gap * 2 - hPie));
  const total = cab + gap + gh + (hPie ? gap + hPie : 0);
  const y0 = iy + Math.max(0, (ih - total) / 2);
  const cajaDibujo = { x: ix, y: y0 + cab + gap, w: iw, h: gh };
  return {
    w, h, fs, nivel, horizontal: false, info: { x: ix, y: y0, w: iw, h: total }, dibujo: cajaDibujo,
    piezas: [cabecera(ix, y0), ...dibujo(cajaDibujo), ...cuerpo(info2, ix, y0 + cab + gap + gh + gap, colW, fs, nivel).piezas],
  };
}

/** La caja que ocupa una pieza (para los tests de M4: nada fuera de la ficha). */
export function cajaDe(p: Pieza): Caja {
  switch (p.tipo) {
    case "texto": return { x: p.x, y: p.y - p.fs * 0.8, w: anchoTexto(p.texto, p.fs, p.estilo === "pregunta"), h: p.fs };
    case "separador": return { x: p.x1, y: p.y, w: p.x2 - p.x1, h: 0 };
    case "vacia": return { x: p.x - anchoTexto(p.texto, p.fs) / 2, y: p.y - p.fs, w: anchoTexto(p.texto, p.fs), h: p.fs };
    default: return { x: p.x, y: p.y, w: p.w, h: p.h };
  }
}
