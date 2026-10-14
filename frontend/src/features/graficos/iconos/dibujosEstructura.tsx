// Láminas de estructura dibujadas en su tamaño real (13,333 × 7,5 in) para `ComposicionLamina` (F6.2). No tienen ranuras
// en el estándar: se dibujan desde la geometría del motor (api/R/lamina_identidad.R) con sus variantes —portada
// centrada/izquierda/banda (23–25), índice arcos/facetas/círculos/bloques (31…), separador capítulo/subcapítulo (4, 5),
// cierre en sus cinco composiciones (61–65)—. Es un esquema didáctico, no la lámina rasterizada: el visor muestra esa.
// Con `datos` (la maqueta del editor; contrato de la maqueta M6, Gonzalo 2026-10-13) cada zona lleva su texto real
// —título, capítulos, objetivo, actores, criterios—; sin ellos (selector, miniaturas) o donde falta, el renglón gris.

import { lineas } from "../laminas/maqueta/geometriaFicha";
import type { DatosEstructura } from "../laminas/maqueta/datosEstructura";

type Clase = "tinta" | "titulo" | "suave" | "acento" | "banda" | "banda-clara" | "logo" | "ilustracion" | "papel-claro";
type D = Partial<DatosEstructura> | undefined;

function Caja({ x, y, w, h, c, rx = 0.06 }: { x: number; y: number; w: number; h: number; c: Clase; rx?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={rx} className={`pulso-composicion__${c}`} />;
}

/** Renglón de texto: una barra redondeada. */
function Renglon({ x, y, w, h = 0.12, c = "suave" }: { x: number; y: number; w: number; h?: number; c?: Clase }) {
  return <Caja x={x} y={y} w={w} h={h} c={c} rx={h / 2} />;
}

function Centrado({ y, w, h, c }: { y: number; w: number; h: number; c: Clase }) {
  return <Renglon x={(13.333 - w) / 2} y={y} w={w} h={h} c={c} />;
}

/**
 * El texto real en la zona del renglón (`x`, `y`, alto `h`) o, si no hay, el renglón gris de ancho `w`. `max`: ancho
 * disponible para el texto; `ancla` middle centra en `x`.
 */
function TextoO({ x, y, w, h, c = "suave", texto, max, negrita = false, ancla = "start", lineasMax = 1 }: {
  x: number; y: number; w: number; h: number; c?: Clase; texto?: string | null; max?: number; negrita?: boolean;
  ancla?: "start" | "middle"; lineasMax?: number;
}) {
  if (!texto) return <Renglon x={ancla === "middle" ? x - w / 2 : x} y={y} w={w} h={h} c={c} />;
  const fs = h * 1.15;
  const ls = lineas(texto, max ?? w, fs, lineasMax, negrita);
  return (
    <>
      {ls.map((l, i) => (
        <text key={i} x={x} y={y + h * 0.92 + i * fs * 1.2} fontSize={fs} fontWeight={negrita ? 700 : 400} textAnchor={ancla} className={c === "suave" ? "pulso-composicion__texto-suave" : `pulso-composicion__${c}`}>
          {l}
        </text>
      ))}
    </>
  );
}

/** Cuánto baja un texto de `TextoO` (para colocar lo que va debajo): sin texto, el alto del renglón. */
function bajaTexto(texto: string | null | undefined, h: number, max: number, lineasMax: number, negrita = false): number {
  if (!texto) return h;
  const fs = h * 1.15;
  return Math.max(1, lineas(texto, max, fs, lineasMax, negrita).length) * fs * 1.2;
}

/** Cabecera de lámina de contenido: antetítulo gris y título coral. */
export function Cabecera({ titulo }: { titulo?: string | null } = {}) {
  return (
    <>
      <Renglon x={0.495} y={0.42} w={2.4} h={0.13} />
      <TextoO x={0.495} y={0.72} w={6.2} h={0.34} c="titulo" texto={titulo} max={11.5} negrita />
    </>
  );
}

function Portada({ variante, d }: { variante: string; d: D }) {
  if (variante === "izquierda") {
    return (
      <>
        <Renglon x={1.08} y={2.25} w={2.6} h={0.16} c="titulo" />
        <TextoO x={1.08} y={2.66} w={8.2} h={0.42} c="tinta" texto={d?.titulo} max={11} negrita lineasMax={2} />
        {!d?.titulo && <Renglon x={1.08} y={3.2} w={5.6} h={0.42} c="tinta" />}
        <Caja x={1.08} y={4.19} w={11.2} h={0.04} c="titulo" rx={0.02} />
        <TextoO x={1.08} y={4.5} w={4.4} h={0.18} c="tinta" texto={d?.subtitulo} max={11} />
        <TextoO x={1.08} y={4.9} w={2} h={0.15} texto={d?.fecha} max={6} />
      </>
    );
  }
  if (variante === "banda") {
    return (
      <>
        <Centrado y={2.25} w={2.6} h={0.16} c="titulo" />
        <TextoO x={6.667} y={2.66} w={8.2} h={0.42} c="tinta" texto={d?.titulo} max={10.5} negrita ancla="middle" lineasMax={2} />
        {!d?.titulo && <Centrado y={3.2} w={5.6} h={0.42} c="tinta" />}
        <Caja x={0} y={6.25} w={13.333} h={1.25} c="banda" rx={0} />
        <TextoO x={6.667} y={6.6} w={4.4} h={0.17} c="papel-claro" texto={d?.subtitulo} max={11} ancla="middle" />
        <TextoO x={6.667} y={6.95} w={2} h={0.14} c="papel-claro" texto={d?.fecha} max={6} ancla="middle" />
      </>
    );
  }
  return (
    <>
      <Centrado y={2.12} w={2.6} h={0.16} c="titulo" />
      <TextoO x={6.667} y={2.55} w={8.6} h={0.44} c="tinta" texto={d?.titulo} max={10.5} negrita ancla="middle" lineasMax={2} />
      {!d?.titulo && <Centrado y={3.1} w={6} h={0.44} c="tinta" />}
      <TextoO x={6.667} y={4.72} w={4.6} h={0.2} c="tinta" texto={d?.subtitulo} max={11} ancla="middle" />
      <TextoO x={6.667} y={5.2} w={2.2} h={0.18} texto={d?.fecha} max={6} ancla="middle" />
    </>
  );
}

/** Ilustración de la columna izquierda del índice, según su composición. */
function IlustracionIndice({ composicion }: { composicion: string }) {
  if (composicion === "facetas") {
    return (
      <>
        <polygon points="0,0 4.2,0 0,3.6" className="pulso-composicion__ilustracion" />
        <polygon points="0,3.6 4.2,0 5.4,3.9" className="pulso-composicion__acento is-suave" />
        <polygon points="0,3.6 5.4,3.9 2.2,7.5 0,7.5" className="pulso-composicion__ilustracion" />
        <polygon points="5.4,3.9 6.2,7.5 2.2,7.5" className="pulso-composicion__acento" />
      </>
    );
  }
  if (composicion === "circulos") {
    return (
      <>
        <circle cx={2.2} cy={2.2} r={1.5} className="pulso-composicion__acento" />
        <circle cx={4.4} cy={4.2} r={1.1} className="pulso-composicion__ilustracion" />
        <circle cx={1.8} cy={5.6} r={1.2} className="pulso-composicion__acento is-suave" />
        <circle cx={4.9} cy={6.6} r={0.6} className="pulso-composicion__ilustracion" />
      </>
    );
  }
  if (composicion === "bloques") {
    return (
      <>
        <Caja x={0.5} y={0.6} w={2.4} h={2.6} c="acento" rx={0.12} />
        <Caja x={3.1} y={0.6} w={2.4} h={1.6} c="ilustracion" rx={0.12} />
        <Caja x={3.1} y={2.4} w={2.4} h={2.6} c="ilustracion" rx={0.12} />
        <Caja x={0.5} y={3.4} w={2.4} h={3.5} c="ilustracion" rx={0.12} />
        <Caja x={3.1} y={5.2} w={2.4} h={1.7} c="acento" rx={0.12} />
      </>
    );
  }
  // Arcos (la 31, por defecto): cuartos de círculo desde la esquina inferior izquierda. El índice sólo usa las cuatro
  // composiciones del recetario (Gonzalo, 2026-10-13: «el índice ya no usa focos»): un «focos» heredado se dibuja así.
  return (
    <>
      <path d="M0 7.5V1.3A6.2 6.2 0 0 1 6.2 7.5Z" className="pulso-composicion__ilustracion" />
      <path d="M0 7.5V3.3A4.2 4.2 0 0 1 4.2 7.5Z" className="pulso-composicion__acento is-suave" />
      <path d="M0 7.5V5.3A2.2 2.2 0 0 1 2.2 7.5Z" className="pulso-composicion__acento" />
    </>
  );
}

function Indice({ composicion, d }: { composicion: string; d: D }) {
  const caps = d?.capitulos ?? [];
  const subs = d?.subcapitulos ?? [];
  const ns = subs.reduce((a, x) => a + x.length, 0);
  const titulo = <TextoO x={6.65} y={0.98} w={1.9} h={0.42} c="titulo" texto={caps.length ? d?.titulo ?? "Índice" : null} max={6} negrita />;
  if (caps.length && ns) {
    // Con subcapítulos (`.lam_indice_geo`, la 32 del recetario): el capítulo con su número, ícono y título; debajo, sus
    // subcapítulos «k.j» en gris; filete entre capítulos. Las filas se ajustan para caber en la columna.
    const n = caps.length, hm = 0.5, alto = 5.2;
    const hs = Math.max(0.16, Math.min(0.31, (alto - hm * n - 0.12 * (n - 1)) / ns));
    let y = 1.75;
    return (
      <>
        <IlustracionIndice composicion={composicion} />
        {titulo}
        {caps.map((c, k) => {
          const y0 = y;
          y += hm;
          const filas = (subs[k] ?? []).map((sc, j) => {
            const yy = y; y += hs;
            return (
              <g key={j}>
                <text x={7.95} y={yy + hs * 0.72} fontSize={Math.min(0.17, hs * 0.62)} fontWeight={700} className="pulso-composicion__texto-suave">{`${k + 1}.${j + 1}`}</text>
                <TextoO x={8.42} y={yy + hs * 0.18} w={2.4} h={Math.min(0.15, hs * 0.5)} texto={sc} max={4.4} />
              </g>
            );
          });
          const sep = k < n - 1 ? <Caja x={6.65} y={y + 0.04} w={6.2} h={0.012} c="suave" rx={0} /> : null;
          if (k < n - 1) y += 0.12;
          return (
            <g key={k}>
              <text x={6.7} y={y0 + hm * 0.68} fontSize={0.24} fontWeight={700} className="pulso-composicion__titulo">{k + 1}</text>
              <circle cx={7.55} cy={y0 + hm / 2} r={0.17} className="pulso-composicion__acento" />
              <TextoO x={7.95} y={y0 + hm * 0.3} w={3} h={0.2} c="tinta" texto={c} max={4.9} negrita />
              {filas}
              {sep}
            </g>
          );
        })}
      </>
    );
  }
  // Sin subcapítulos: un capítulo por fila (hasta seis; el resto se cuenta); sin datos, los cinco renglones del esquema.
  const n = caps.length ? Math.min(6, caps.length) : 5;
  const paso = Math.min(0.95, 4.9 / n);
  return (
    <>
      <IlustracionIndice composicion={composicion} />
      {titulo}
      {Array.from({ length: n }, (_, k) => {
        const y = 2.05 + k * paso;
        const ultimo = caps.length > 6 && k === 5;
        return (
          <g key={k}>
            {caps.length
              ? <text x={6.7} y={y + 0.52} fontSize={0.26} fontWeight={700} className="pulso-composicion__titulo">{ultimo ? "…" : k + 1}</text>
              : <Caja x={6.65} y={y + 0.28} w={0.24} h={0.3} c="titulo" rx={0.04} />}
            <circle cx={7.65} cy={y + 0.43} r={0.22} className="pulso-composicion__acento" />
            <TextoO x={8.15} y={y + 0.34} w={[3.6, 2.8, 3.2, 2.4, 3][k] ?? 3} h={0.2} c="tinta"
              texto={caps.length ? (ultimo ? `y ${caps.length - 5} capítulos más` : caps[k]) : null} max={4.8} negrita={n <= 5} />
            {k < n - 1 && <Caja x={6.65} y={y + paso - 0.02} w={6.2} h={0.012} c="suave" rx={0} />}
          </g>
        );
      })}
    </>
  );
}

// G8: las seis versiones del recetario (52–57). `nivel` llega compuesto («subcapitulo:banda», «capitulo:numero»).
function Separador({ nivel: compuesto, d }: { nivel: string; d: D }) {
  const [nivel, version] = compuesto.split(":");
  const t = d?.titulo, s = d?.subtitulo, num = d?.numero;
  if (nivel === "subcapitulo") {
    if (version === "barra") {
      return (
        <>
          <Caja x={0.49} y={2.85} w={0.08} h={1.35} c="titulo" rx={0.02} />
          <Renglon x={0.75} y={2.85} w={4.2} h={0.13} />
          <TextoO x={0.75} y={3.2} w={6.8} h={0.42} c="tinta" texto={t} max={11.5} negrita />
          <TextoO x={0.75} y={3.85} w={4.2} h={0.17} texto={s} max={11.5} />
        </>
      );
    }
    if (version === "sin_lamina") {
      // Sin lámina propia: se dibuja la lámina siguiente, con el antetítulo en coral.
      return (
        <>
          <Caja x={0.4} y={0.45} w={0.06} h={0.55} c="titulo" rx={0.02} />
          <TextoO x={0.6} y={0.45} w={2.2} h={0.13} c="titulo" texto={t} max={8} />
          <Renglon x={0.6} y={0.7} w={6.4} h={0.3} c="tinta" />
          {[0, 1, 2, 3].map((k) => <Renglon key={k} x={1.6} y={2.2 + k * 1.0} w={[9.5, 7, 8.2, 5.4][k]} h={0.45} c="suave" />)}
        </>
      );
    }
    if (version === "banda") {
      return (
        <>
          <Caja x={0} y={2.55} w={13.333} h={1.75} c="banda-clara" rx={0} />
          <TextoO x={0.6} y={3.15} w={1.1} h={0.42} c="tinta" texto={num} max={1.3} negrita />
          <Caja x={1.95} y={3.0} w={0.05} h={0.9} c="titulo" rx={0.02} />
          <TextoO x={2.2} y={3.05} w={5.6} h={0.4} c="tinta" texto={t} max={10.5} negrita />
          <TextoO x={2.2} y={3.65} w={3.4} h={0.15} texto={s} max={10.5} />
        </>
      );
    }
    return (
      <>
        <Renglon x={0.495} y={2.75} w={4.2} h={0.13} />
        <TextoO x={0.495} y={3.15} w={0.75} h={0.42} c="titulo" texto={num} max={0.85} negrita />
        <TextoO x={1.4} y={3.15} w={6.4} h={0.42} c="tinta" texto={t} max={11} negrita />
        <TextoO x={1.4} y={3.8} w={4.2} h={0.17} texto={s} max={11} />
      </>
    );
  }
  const ilustracion = (
    <>
      <path d="M13.333 0V7.5H8.6C9.6 5.6 10.4 3.4 13.333 0Z" className="pulso-composicion__ilustracion" />
      <path d="M13.333 2.8V7.5H10.6C11.2 6 12.1 4.4 13.333 2.8Z" className="pulso-composicion__acento is-suave" />
    </>
  );
  if (version === "numero") {
    return (
      <>
        {ilustracion}
        <Caja x={1} y={2.5} w={1.1} h={1.5} c="titulo" rx={0.08} />
        {num && <text x={1.55} y={3.5} fontSize={0.62} fontWeight={700} textAnchor="middle" className="pulso-composicion__papel-claro">{num.slice(0, 3)}</text>}
        <Caja x={2.35} y={2.6} w={0.06} h={1.2} c="titulo" rx={0.02} />
        <TextoO x={2.65} y={2.7} w={5.2} h={0.45} c="tinta" texto={t} max={6.2} negrita lineasMax={2} />
        <TextoO x={2.65} y={2.7 + bajaTexto(t, 0.45, 6.2, 2, true) + 0.2} w={3.6} h={0.18} texto={s} max={6.2} />
      </>
    );
  }
  if (version === "fondo") {
    return (
      <>
        {ilustracion}
        <Caja x={6.4} y={2.2} w={1.9} h={2.4} c="banda-clara" rx={0.1} />
        <TextoO x={1} y={2.55} w={1.7} h={0.17} c="titulo" texto={num} max={5} />
        <TextoO x={1} y={3.0} w={5.4} h={0.5} c="tinta" texto={t} max={5.3} negrita lineasMax={2} />
        <TextoO x={1} y={3.0 + bajaTexto(t, 0.5, 5.3, 2, true) + 0.25} w={4.0} h={0.2} texto={s} max={5.3} />
      </>
    );
  }
  return (
    <>
      {ilustracion}
      <TextoO x={1} y={2.55} w={1.7} h={0.17} c="titulo" texto={num} max={6} />
      <Caja x={1} y={2.9} w={0.7} h={0.05} c="titulo" rx={0.02} />
      <TextoO x={1} y={3.2} w={6.4} h={0.52} c="tinta" texto={t} max={7.4} negrita lineasMax={2} />
      <TextoO x={1} y={3.2 + bajaTexto(t, 0.52, 7.4, 2, true) + 0.28} w={4.4} h={0.2} texto={s} max={7.4} />
    </>
  );
}

function Contacto({ x, y, claro = false, texto }: { x: number; y: number; claro?: boolean; texto?: string | null }) {
  return (
    <>
      <circle cx={x} cy={y} r={0.13} className={`pulso-composicion__${claro ? "papel-claro" : "acento"}`} />
      <TextoO x={x + 0.25} y={y - 0.06} w={1.7} h={0.12} c={claro ? "papel-claro" : "suave"} texto={texto} max={3.4} />
    </>
  );
}

function Cierre({ variante, d }: { variante: string; d: D }) {
  const c = d?.contactos ?? [];
  const logo = <Caja x={5.17} y={2.5} w={3} h={1.5} c="logo" rx={0.12} />;
  if (variante === "banda_azul" || variante === "banda_clara") {
    const claro = variante === "banda_azul";
    return (
      <>
        {logo}
        <Caja x={0} y={6.1} w={13.333} h={1.4} c={claro ? "banda" : "banda-clara"} rx={0} />
        {[1.6, 5.6, 9.6].map((x, i) => <Contacto key={x} x={x} y={6.8} claro={claro} texto={c[i]} />)}
      </>
    );
  }
  if (variante === "contacto") {
    return (
      <>
        {logo}
        {[[4.55, 3.4], [4.85, 4.2], [5.15, 2.6]].map(([y, w], i) => <TextoO key={y} x={6.667} y={y} w={w} h={0.14} texto={c[i]} max={8} ancla="middle" />)}
      </>
    );
  }
  if (variante === "tres_columnas") {
    return (
      <>
        {logo}
        {[2.4, 5.9, 9.4].map((x, i) => (
          <g key={x}>
            <circle cx={x + 0.85} cy={4.7} r={0.2} className="pulso-composicion__acento" />
            <TextoO x={x + 0.85} y={5.05} w={1.7} h={0.12} texto={c[i]} max={3.2} ancla="middle" />
          </g>
        ))}
      </>
    );
  }
  return (
    <>
      {logo}
      {[1.08, 5.2, 11.17].map((x, i) => <Contacto key={x} x={x} y={6.76} texto={c[i]} />)}
    </>
  );
}

/** Un actor del objetivo: su círculo y, con datos, su nombre. */
function Actor({ cx, cy, r, nombre, al = "abajo" }: { cx: number; cy: number; r: number; nombre?: string | null; al?: "abajo" | "derecha" }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className="pulso-composicion__acento" />
      <circle cx={cx} cy={cy - r * 0.22} r={r * 0.24} className="pulso-composicion__papel-claro" />
      <path d={`M ${cx - r * 0.45} ${cy + r * 0.55} Q ${cx} ${cy - r * 0.05} ${cx + r * 0.45} ${cy + r * 0.55}`} className="pulso-composicion__papel-claro" />
      {nombre && (al === "abajo"
        ? <TextoO x={cx} y={cy + r + 0.12} w={1} h={0.16} c="tinta" texto={nombre} max={2} negrita ancla="middle" />
        : <TextoO x={cx + r + 0.15} y={cy - 0.1} w={1} h={0.16} c="tinta" texto={nombre} max={2} negrita />)}
    </g>
  );
}

// G6: las tres versiones del recetario (26 clásica, 27 panel, 28 dimensiones).
function Objetivo({ variante, d }: { variante: string; d: D }) {
  const actores = d?.actores ?? [];
  if (variante === "panel") {
    const n = actores.length ? Math.min(6, actores.length) : 6;
    return (
      <>
        <Caja x={0} y={0} w={4.4} h={7.5} c="banda" rx={0} />
        <circle cx={1.35} cy={2.3} r={0.6} className="pulso-composicion__papel-claro" />
        <TextoO x={0.75} y={3.3} w={2.8} h={0.35} c="papel-claro" texto={d?.titulo ?? (actores.length || d?.texto ? "Objetivo del estudio" : null)} max={3.4} negrita lineasMax={2} />
        <Caja x={0.75} y={4.6} w={0.9} h={0.06} c="titulo" rx={0.02} />
        {d?.texto
          ? <TextoO x={5} y={1.6} w={7.6} h={0.18} c="tinta" texto={d.texto} max={7.9} lineasMax={5} />
          : [1.7, 2.15, 2.6, 3.05].map((y, i) => <Renglon key={y} x={5} y={y} w={[7.6, 7.2, 7.8, 5][i]} h={0.15} c="tinta" />)}
        {Array.from({ length: n }, (_, k) => <Actor key={k} cx={5.3 + (k % 3) * 2.675} cy={5.25 + Math.floor(k / 3) * 0.9} r={0.29} nombre={actores[k]?.nombre} al="derecha" />)}
      </>
    );
  }
  if (variante === "dimensiones") {
    const dims = d?.dimensiones ?? [];
    const n = actores.length ? Math.min(6, actores.length) : 6;
    const paso = 12.35 / n;
    return (
      <>
        <circle cx={0.8} cy={0.93} r={0.31} className="pulso-composicion__acento" />
        <TextoO x={1.29} y={0.82} w={3} h={0.2} c="titulo" texto={d?.titulo ?? (dims.length || actores.length ? "Objetivo del estudio" : null)} max={8} negrita />
        {[0, 1, 2, 3].map((k) => (
          <g key={k}>
            <Caja x={0.49 + k * 3.19} y={2.1} w={2.94} h={1.35} c="papel-claro" rx={0.04} />
            <Caja x={0.49 + k * 3.19} y={2.1} w={2.94} h={0.06} c="tinta" rx={0} />
            <TextoO x={0.74 + k * 3.19} y={2.5} w={2} h={0.15} c="tinta" texto={dims[k]} max={2.5} negrita lineasMax={3} />
          </g>
        ))}
        {Array.from({ length: n }, (_, k) => <Actor key={k} cx={0.49 + paso * (k + 0.5)} cy={4.81} r={0.36} nombre={actores[k]?.nombre} />)}
      </>
    );
  }
  return (
    <>
      <Cabecera titulo={d?.titulo ?? (d?.texto || actores.length ? "Objetivo del estudio" : null)} />
      <circle cx={2.2} cy={3.9} r={1.25} className="pulso-composicion__ilustracion" />
      <circle cx={2.2} cy={3.9} r={0.75} className="pulso-composicion__acento is-suave" />
      <circle cx={2.2} cy={3.9} r={0.3} className="pulso-composicion__acento" />
      {d?.texto
        ? <TextoO x={4.4} y={2.5} w={7.8} h={0.2} c="tinta" texto={d.texto} max={8.4} lineasMax={actores.length ? 4 : 6} />
        : [2.6, 3.1, 3.6, 4.1, 4.6].map((y, i) => <Renglon key={y} x={4.4} y={y} w={[7.8, 8.2, 6.6, 7.4, 4.8][i]} h={0.15} c={i === 0 ? "tinta" : "suave"} />)}
      {actores.length > 0 && (
        <>
          <Caja x={0.495} y={5.25} w={12.34} h={0.012} c="suave" rx={0} />
          {actores.slice(0, 6).map((a, k, xs) => <Actor key={k} cx={0.495 + (12.34 / xs.length) * (k + 0.5)} cy={5.85} r={0.3} nombre={a.nombre} />)}
        </>
      )}
    </>
  );
}

function FichaTecnica({ d }: { d: D }) {
  const criterios = d?.criterios ?? [];
  const n = criterios.length ? Math.min(7, criterios.length) : 6;
  const paso = Math.min(0.72, 5 / n);
  return (
    <>
      <Cabecera titulo={d?.titulo ?? (criterios.length ? "Ficha técnica" : null)} />
      {Array.from({ length: n }, (_, k) => {
        const y = 1.75 + k * paso;
        return (
          <g key={k}>
            <Caja x={0.495} y={y} w={3.2} h={paso * 0.78} c="ilustracion" rx={0.05} />
            <TextoO x={0.7} y={y + paso * 0.29} w={1.9} h={0.14} c="tinta" texto={criterios[k]} max={2.9} negrita />
            <Renglon x={4} y={y + paso * 0.29} w={[6.4, 4.8, 7.8, 5.2, 6.8, 3.6, 5.8][k] ?? 5} h={0.14} />
          </g>
        );
      })}
    </>
  );
}

/** Top Two Box: una barra de cinco puntos con los dos de arriba bajo la llave (recetario p19). */
function TopTwoBox({ d }: { d: D }) {
  const tramos: ReadonlyArray<readonly [number, number, Clase]> = [
    [1.2, 1.6, "ilustracion"], [2.84, 1.3, "ilustracion"], [4.18, 1.2, "suave"], [5.42, 2.6, "acento"], [8.06, 2.9, "acento"],
  ];
  return (
    <>
      <Cabecera titulo={d?.titulo} />
      <Renglon x={1.2} y={1.8} w={9.4} h={0.15} />
      <Renglon x={1.2} y={2.15} w={6.8} h={0.15} />
      {tramos.map(([x, w, c]) => <Caja key={x} x={x} y={3.6} w={w} h={0.9} c={c} rx={0.04} />)}
      <path d="M5.42 3.35V3.05H10.96V3.35" className="pulso-composicion__llave" />
      <Renglon x={7.2} y={2.7} w={2} h={0.18} c="tinta" />
      {tramos.map(([x, w]) => <Renglon key={`r-${x}`} x={x + w / 2 - 0.45} y={4.8} w={0.9} h={0.12} />)}
    </>
  );
}

/** Redondeo: la misma distribución con los dos métodos y su suma al lado (recetario p20–21). */
function Redondeo({ d }: { d: D }) {
  const fila = (y: number) => (
    <>
      {([[1.2, 0.4], [1.64, 1.4], [3.08, 4.4], [7.52, 2.6], [10.16, 0.4]] as const).map(([x, w], i) => (
        <Caja key={x} x={x} y={y} w={w} h={0.7} c={i === 2 ? "acento" : "ilustracion"} rx={0.04} />
      ))}
      <Renglon x={11.1} y={y + 0.24} w={1.2} h={0.22} c="titulo" />
    </>
  );
  return (
    <>
      <Cabecera titulo={d?.titulo} />
      <Renglon x={1.2} y={1.75} w={8} h={0.15} />
      <Renglon x={1.2} y={2.5} w={2.2} h={0.15} c="tinta" />
      {fila(2.8)}
      <Renglon x={1.2} y={4.25} w={2.2} h={0.15} c="tinta" />
      {fila(4.55)}
    </>
  );
}

/** ¿Hay dibujo de estructura para este tipo? */
export function tieneDibujoEstructura(tipo: string): boolean {
  return tipo in DIBUJOS;
}

const DIBUJOS: Readonly<Record<string, (variante: string | null, d: D) => JSX.Element>> = {
  p_slide_portada: (v, d) => <Portada variante={v ?? "centrada"} d={d} />,
  p_slide_indice: (v, d) => <Indice composicion={v ?? "arcos"} d={d} />,
  p_slide_seccion: (v, d) => <Separador nivel={v ?? "capitulo"} d={d} />,
  p_slide_cierre: (v, d) => <Cierre variante={v ?? "contraportada"} d={d} />,
  p_slide_objetivo_icono: (v, d) => <Objetivo variante={v ?? "clasica"} d={d} />,
  p_slide_tabla_tecnica: (_v, d) => <FichaTecnica d={d} />,
  p_slide_top_two_box: (_v, d) => <TopTwoBox d={d} />,
  p_slide_redondeo: (_v, d) => <Redondeo d={d} />,
};

export function DibujoEstructura({ tipo, variante, datos }: { tipo: string; variante: string | null; datos?: D }): JSX.Element | null {
  const dibujo = DIBUJOS[tipo];
  return dibujo ? dibujo(variante, datos) : null;
}
