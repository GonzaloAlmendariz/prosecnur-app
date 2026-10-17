import type { ReactNode } from "react";
import { typeTone } from "./typeTone";
import { tipoPregunta } from "./tiposPregunta";
import "./kit.css";

// Maqueta del tipo de pregunta (M8, 2026-10-17): el código visual de cada tipo, como los glifos de Gráficos. Pedido
// de Gonzalo: «maquetas y elementos visuales muy profesionales y sofisticados». Una sola gramática para todas:
//   - Pregunta en miniatura: arriba la línea del enunciado (igual en todas) y debajo el control propio del tipo,
//     dentro de la misma área (y 11 a 29), con trazo de 1.2 y radios de 2.4.
//   - El color de la familia va sólo en el elemento activo (la opción marcada, el valor, el pin); lo demás en tinta.
//   - Lo que el encuestado no ve (cálculo, campo oculto, automáticos) va con borde punteado.
//   - La estructura se dibuja como contenedor, sin enunciado.
// Lienzo 48 × 32.

const TRAZO = "var(--pulso-border-strong)";
const LINEA = "var(--pulso-border)";
const PAPEL = "var(--pulso-surface)";
const SUAVE = "var(--pulso-surface-2)";
const W = 1.2;

const linea = (x: number, y: number, w: number, fill = LINEA, h = 2.4) => <rect x={x} y={y - h / 2} width={w} height={h} rx={h / 2} fill={fill} />;
const enunciado = () => linea(4, 5, 26, TRAZO, 2.6);
const campo = (x = 4, y = 13, w = 40, h = 12, punteado = false) => (
  <rect x={x} y={y} width={w} height={h} rx={2.4} fill={PAPEL} stroke={TRAZO} strokeWidth={W} strokeDasharray={punteado ? "2.6 2" : undefined} />
);
const cifra = (x: number, y: number, t: string, fill: string, size = 7.4) => (
  <text x={x} y={y} fontSize={size} fontWeight={600} fill={fill} fontFamily="ui-sans-serif, system-ui, -apple-system" letterSpacing={0.2}>{t}</text>
);
/** Contador «×3» de la repetición: lleno al abrirla, en contorno al cerrarla. */
const contador = (x: number, y: number, t: string, contorno = false) => (
  <g>
    <rect x={x} y={y} width={11.4} height={6.8} rx={3.4} fill={contorno ? PAPEL : t} stroke={t} strokeWidth={contorno ? W : 0} />
    <text x={x + 5.7} y={y + 5} textAnchor="middle" fontSize={5.2} fontWeight={700} fill={contorno ? t : PAPEL} fontFamily="ui-sans-serif, system-ui, -apple-system">×3</text>
  </g>
);
const pregunta = (control: ReactNode) => <g>{enunciado()}{control}</g>;
const filas = [14, 20, 26];

function porTipo(base: string, t: string): ReactNode | null {
  switch (base) {
    case "select_one":
      return pregunta(filas.map((y, i) => (
        <g key={y}>
          <circle cx={7} cy={y} r={2.4} fill={i === 0 ? t : PAPEL} stroke={i === 0 ? t : TRAZO} strokeWidth={W} />
          {i === 0 ? <circle cx={7} cy={y} r={0.9} fill={PAPEL} /> : null}
          {linea(12, y, [32, 26, 29][i])}
        </g>
      )));
    case "select_multiple":
      return pregunta(filas.map((y, i) => (
        <g key={y}>
          <rect x={4.6} y={y - 2.4} width={4.8} height={4.8} rx={1.2} fill={i < 2 ? t : PAPEL} stroke={i < 2 ? t : TRAZO} strokeWidth={W} />
          {i < 2 ? <path d={`M5.8 ${y} l1.1 1.1 l1.8 -2.1`} stroke={PAPEL} strokeWidth={1.1} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {linea(12, y, [32, 26, 29][i])}
        </g>
      )));
    case "rank":
      return pregunta(filas.map((y, i) => (
        <g key={y}>
          <rect x={4} y={y - 2.6} width={6} height={5.2} rx={1.3} fill={i === 0 ? t : PAPEL} stroke={i === 0 ? t : TRAZO} strokeWidth={W} />
          {cifra(5.6, y + 1.9, String(i + 1), i === 0 ? PAPEL : "var(--pulso-text-muted)", 5)}
          {linea(13, y, [25, 20, 23][i])}
          <path d={`M41 ${y - 1.4} h3 M41 ${y + 1.4} h3`} stroke={TRAZO} strokeWidth={1} strokeLinecap="round" />
        </g>
      )));
    case "text":
      return pregunta(<g>{campo()}{linea(8, 19, 18)}<rect x={28} y={15.6} width={1.3} height={6.8} rx={0.6} fill={t} /></g>);
    case "integer":
      return pregunta(<g>{campo(4, 13, 26)}{cifra(8, 21.6, "123", t)}<path d="M37 16.5 l2 -2 l2 2 M37 21.5 l2 2 l2 -2" stroke={TRAZO} strokeWidth={W} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>);
    case "decimal":
      return pregunta(<g>{campo(4, 13, 26)}{cifra(8, 21.6, "12.5", t)}<path d="M37 16.5 l2 -2 l2 2 M37 21.5 l2 2 l2 -2" stroke={TRAZO} strokeWidth={W} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>);
    case "range":
      return pregunta(
        <g>
          <rect x={5} y={18} width={38} height={2.4} rx={1.2} fill={LINEA} />
          <rect x={5} y={18} width={23} height={2.4} rx={1.2} fill={t} />
          <circle cx={28} cy={19.2} r={3.6} fill={PAPEL} stroke={t} strokeWidth={1.6} />
          {[5, 14.5, 24, 33.5, 43].map((x) => <rect key={x} x={x - 0.5} y={25} width={1} height={2.4} rx={0.5} fill={TRAZO} />)}
        </g>,
      );
    case "date":
      return pregunta(
        <g>
          {campo()}{linea(8, 19, 16)}
          <rect x={33} y={15} width={8} height={8} rx={1.4} fill="none" stroke={t} strokeWidth={W} />
          <path d="M33 17.6 h8" stroke={t} strokeWidth={W} />
          <rect x={35.6} y={19.4} width={2.6} height={2} rx={0.5} fill={t} />
        </g>,
      );
    case "time":
      return pregunta(
        <g>
          {campo()}{linea(8, 19, 14)}
          <circle cx={37} cy={19} r={4} fill="none" stroke={t} strokeWidth={W} />
          <path d="M37 19 V16.6 M37 19 L38.8 20" stroke={t} strokeWidth={W} strokeLinecap="round" />
        </g>,
      );
    case "datetime":
      return pregunta(
        <g>
          {campo()}{linea(8, 19, 10)}
          <rect x={24} y={15} width={8} height={8} rx={1.4} fill="none" stroke={t} strokeWidth={W} />
          <path d="M24 17.6 h8" stroke={t} strokeWidth={W} />
          <circle cx={38} cy={19} r={4} fill="none" stroke={t} strokeWidth={W} />
          <path d="M38 19 V16.6 M38 19 L39.8 20" stroke={t} strokeWidth={W} strokeLinecap="round" />
        </g>,
      );
    case "image":
      return pregunta(
        <g>
          <rect x={4} y={12} width={40} height={17} rx={2.4} fill={SUAVE} stroke={TRAZO} strokeWidth={W} />
          <path d="M8 26 L17 18 L23 23 L28 19.5 L40 26 Z" fill={LINEA} />
          <circle cx={33} cy={16.4} r={2.2} fill={t} />
        </g>,
      );
    case "audio":
      return pregunta(
        <g>
          <circle cx={9} cy={20.5} r={4.6} fill={t} />
          <path d="M8 18.4 v4.2 l3.3 -2.1 z" fill={PAPEL} />
          {[17, 20, 23, 26, 29, 32, 35, 38, 41].map((x, i) => {
            const h = [4, 8, 12, 7, 10, 5, 9, 6, 3][i];
            return <rect key={x} x={x} y={20.5 - h / 2} width={1.6} height={h} rx={0.8} fill={i < 4 ? t : TRAZO} />;
          })}
        </g>,
      );
    case "video":
      return pregunta(
        <g>
          <rect x={4} y={12} width={40} height={17} rx={2.4} fill={SUAVE} stroke={TRAZO} strokeWidth={W} />
          <circle cx={24} cy={20.5} r={4.8} fill={t} />
          <path d="M22.6 18 v5 l4 -2.5 z" fill={PAPEL} />
        </g>,
      );
    case "file":
      return pregunta(
        <g>
          {campo()}
          <path d="M8 15.4 h4.4 l2.4 2.4 v5.4 h-6.8 z" fill="none" stroke={t} strokeWidth={W} strokeLinejoin="round" />
          <path d="M12.4 15.4 v2.4 h2.4" fill="none" stroke={t} strokeWidth={W} strokeLinejoin="round" />
          {linea(18.5, 19, 16)}
          <rect x={36.5} y={16.6} width={4.6} height={4.6} rx={1} fill="none" stroke={TRAZO} strokeWidth={1} />
        </g>,
      );
    case "barcode":
      return pregunta(
        <g>
          {[6, 8.4, 10, 13, 14.6, 17, 20, 21.6, 24.4, 27, 28.6, 31.4, 33, 36, 38.2, 40.6].map((x, i) => (
            <rect key={x} x={x} y={13} width={[1.4, 0.8, 1.8, 0.8, 1.2, 1.8, 0.8, 1.4, 1.2, 0.8, 1.8, 0.8, 1.2, 1.8, 0.8, 1.4][i]} height={15} fill={TRAZO} />
          ))}
          <rect x={4} y={19.8} width={40} height={1.4} rx={0.7} fill={t} />
        </g>,
      );
    case "geopoint":
    case "geotrace":
    case "geoshape":
      return pregunta(
        <g>
          <rect x={4} y={12} width={40} height={17} rx={2.4} fill={SUAVE} stroke={TRAZO} strokeWidth={W} />
          <path d="M4 22 C14 18 20 26 30 20 S40 17 44 18" stroke={LINEA} strokeWidth={1.6} fill="none" />
          {base === "geopoint" ? (
            <g>
              <path d="M24 13.6 a3.8 3.8 0 0 1 3.8 3.8 c0 3.2 -3.8 7 -3.8 7 s-3.8 -3.8 -3.8 -7 a3.8 3.8 0 0 1 3.8 -3.8z" fill={t} />
              <circle cx={24} cy={17.4} r={1.4} fill={PAPEL} />
            </g>
          ) : base === "geotrace" ? (
            <g>
              <path d="M9 25 C16 25 15 16 23 17 S32 25 39 15" stroke={t} strokeWidth={1.4} fill="none" strokeDasharray="2.4 1.8" />
              {[[9, 25], [23, 17], [39, 15]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={1.8} fill={PAPEL} stroke={t} strokeWidth={1.2} />)}
            </g>
          ) : (
            <g>
              <path d="M12 25 L15 15 L29 14 L36 21 L25 26.5 Z" fill={t} fillOpacity={0.18} stroke={t} strokeWidth={1.2} strokeLinejoin="round" />
              {[[12, 25], [15, 15], [29, 14], [36, 21], [25, 26.5]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill={PAPEL} stroke={t} strokeWidth={1.1} />)}
            </g>
          )}
        </g>,
      );
    case "note":
      return (
        <g>
          <rect x={4} y={4} width={40} height={24} rx={2.4} fill={SUAVE} />
          <circle cx={10} cy={10.5} r={3} fill={t} />
          <rect x={9.4} y={9.6} width={1.2} height={3.2} rx={0.6} fill={PAPEL} />
          <circle cx={10} cy={8.4} r={0.7} fill={PAPEL} />
          {linea(16, 10.5, 22, TRAZO)}{linea(9, 17.5, 31)}{linea(9, 22.5, 24)}
        </g>
      );
    case "acknowledge":
      return pregunta(
        <g>
          <rect x={4.6} y={16.6} width={5.6} height={5.6} rx={1.3} fill={t} />
          <path d="M6 19.4 l1.3 1.3 l2 -2.4" stroke={PAPEL} strokeWidth={1.1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {linea(13.5, 19.4, 22)}
        </g>,
      );
    case "calculate":
      return (
        <g>
          {campo(4, 7, 40, 18, true)}
          <text x={9} y={19.6} fontSize={9.5} fontStyle="italic" fontWeight={600} fill={t} fontFamily="Georgia, 'Times New Roman', serif">ƒx</text>
          {linea(22, 16, 18)}
        </g>
      );
    case "hidden":
      return (
        <g>
          {campo(4, 7, 40, 18, true)}
          <path d="M17 16 c3.4 -4.2 10.6 -4.2 14 0 c-3.4 4.2 -10.6 4.2 -14 0z" fill="none" stroke={t} strokeWidth={W} />
          <circle cx={24} cy={16} r={1.6} fill={t} />
          <path d="M18 22 L30 10" stroke={t} strokeWidth={W} strokeLinecap="round" />
        </g>
      );
    case "begin_group":
      return (
        <g>
          <rect x={4} y={4} width={40} height={24} rx={2.4} fill={PAPEL} stroke={TRAZO} strokeWidth={W} />
          <path d="M4 10.5 h40" stroke={TRAZO} strokeWidth={W} />
          <rect x={8} y={6.4} width={14} height={1.8} rx={0.9} fill={t} />
          {linea(8, 16, 22)}{linea(8, 22, 16)}
        </g>
      );
    case "begin_repeat":
      // La sección (marco con cabecera) apilada: se llena varias veces. El contador dice cuántas.
      return (
        <g>
          <rect x={10} y={2.6} width={34} height={20} rx={2.4} fill={SUAVE} stroke={LINEA} strokeWidth={W} />
          <rect x={7} y={5.3} width={34} height={20} rx={2.4} fill={SUAVE} stroke={TRAZO} strokeWidth={W} />
          <rect x={4} y={8} width={34} height={21} rx={2.4} fill={PAPEL} stroke={TRAZO} strokeWidth={W} />
          <path d="M4 13.6 h34" stroke={TRAZO} strokeWidth={W} />
          <rect x={7.6} y={9.9} width={12} height={1.8} rx={0.9} fill={t} />
          {linea(8, 18.6, 16)}{linea(8, 23.6, 11)}
          {contador(27.2, 20, t)}
        </g>
      );
    case "end_group":
    case "end_repeat":
      return (
        <g>
          <path d="M4 4 v21.6 a2.4 2.4 0 0 0 2.4 2.4 h35.2 a2.4 2.4 0 0 0 2.4 -2.4 v-21.6" fill="none" stroke={TRAZO} strokeWidth={W} strokeDasharray="2.6 2" />
          {linea(8, 10, 22)}{linea(8, 16, 16)}
          <rect x={4} y={26.6} width={40} height={1.8} rx={0.9} fill={t} />
          {base === "end_repeat" ? contador(31, 7, t, true) : null}
        </g>
      );
    case "start":
    case "end":
    case "today":
    case "deviceid":
    case "username":
    case "start-geopoint":
    case "audit":
    case "phonenumber":
    case "simserial":
    case "subscriberid":
      return (
        <g>
          <rect x={3} y={7} width={42} height={18} rx={9} fill={PAPEL} stroke={TRAZO} strokeWidth={W} strokeDasharray="2.6 2" />
          <g transform="translate(13 16) scale(1.45) translate(-12 -16)">
          <circle cx={12} cy={16} r={4.2} fill={t} />
          {base === "start" ? <path d="M11 13.8 v4.4 l3.4 -2.2 z" fill={PAPEL} /> : null}
          {base === "end" ? <rect x={10.4} y={14.4} width={3.2} height={3.2} rx={0.6} fill={PAPEL} /> : null}
          {base === "today" ? <g><rect x={10} y={14} width={4} height={4} rx={0.7} fill="none" stroke={PAPEL} strokeWidth={0.9} /><path d="M10 15.3 h4" stroke={PAPEL} strokeWidth={0.9} /></g> : null}
          {base === "deviceid" ? <rect x={10.6} y={13.6} width={2.8} height={4.8} rx={0.6} fill="none" stroke={PAPEL} strokeWidth={0.9} /> : null}
          {base === "username" ? <g><circle cx={12} cy={15} r={1.2} fill={PAPEL} /><path d="M9.8 18.2 a2.2 1.6 0 0 1 4.4 0" fill={PAPEL} /></g> : null}
          {base === "start-geopoint" ? <g><path d="M12 18.7 c-1.5 -1.8 -2.2 -2.9 -2.2 -3.8 a2.2 2.2 0 0 1 4.4 0 c0 0.9 -0.7 2 -2.2 3.8z" fill={PAPEL} /><circle cx={12} cy={14.9} r={0.75} fill={t} /></g> : null}
          {base === "audit" ? <g><circle cx={12} cy={16} r={2.4} fill="none" stroke={PAPEL} strokeWidth={0.9} /><path d="M12 14.6 v1.5 l1 0.7" stroke={PAPEL} strokeWidth={0.8} fill="none" strokeLinecap="round" /></g> : null}
          {base === "phonenumber" ? <path d="M10.4 13.6 c0.4 2.6 1.4 3.8 3.4 4.6 l0.6 -1 l-1.2 -0.8 l-0.6 0.5 c-0.6 -0.4 -1 -0.9 -1.3 -1.5 l0.5 -0.6 l-0.8 -1.2z" fill={PAPEL} /> : null}
          {base === "simserial" ? <path d="M10.4 13.6 h2.4 l1.2 1.2 v3.6 h-3.6z" fill="none" stroke={PAPEL} strokeWidth={0.9} strokeLinejoin="round" /> : null}
          {base === "subscriberid" ? <g><path d="M10.4 13.6 h2.4 l1.2 1.2 v3.6 h-3.6z" fill="none" stroke={PAPEL} strokeWidth={0.9} strokeLinejoin="round" /><circle cx={12.2} cy={16.4} r={0.8} fill={PAPEL} /></g> : null}
          </g>
          {base === "audit" ? <g>{linea(22, 16, 6, t)}{linea(30, 16, 4, t)}{linea(36, 16, 5, t)}</g> : linea(22, 16, 18)}
        </g>
      );
    default:
      return null;
  }
}

export function MaquetaTipo({ baseType, ancho = 48 }: { baseType: string; ancho?: number }) {
  const base = tipoPregunta(baseType).base;
  return (
    <svg className="xfk-maqueta" width={ancho} height={(ancho * 32) / 48} viewBox="0 0 48 32" aria-hidden="true" focusable="false">
      {porTipo(base, typeTone(baseType)) ?? campo(4, 9, 40, 14)}
    </svg>
  );
}
