import { useId, useMemo, type CSSProperties } from "react";
import { trenzaGeometria, type TrenzaCinta } from "./trenzaGeometria";
import "./isotipo.css";

/**
 * El isotipo «Trenza» (ADR 0132) dibujado desde su geometría única. Quieto por defecto; `m` y `om` lo mueven
 * (los usa `IsotipoCarga`). Los colores son CSS: el contenedor toma `fondo` (navy de marca, o el tono del módulo
 * en su pantalla de carga) y cada hilo es una mezcla de `tinta` sobre ese fondo, así nunca hay un hex del módulo
 * escrito aquí. La mezcla la hace isotipo.css con la proporción `--k` de cada parada.
 */
export function IsotipoTrenza({
  fondo = "var(--pulso-primary)",
  tinta = "#fff",
  contenedor = true,
  chica = false,
  m = 1,
  om = 0,
  pasos,
  paradas,
  size,
  className,
  style,
}: {
  fondo?: string;
  tinta?: string;
  /** Sin contenedor, la trenza va en `tinta` sobre lo que haya detrás, que debe ser `fondo`. */
  contenedor?: boolean;
  /** Cinco hilos más gruesos, para 32 px o menos. */
  chica?: boolean;
  m?: number;
  om?: number;
  pasos?: number;
  paradas?: number;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const crudo = useId();
  const id = "trz" + crudo.replace(/[^a-zA-Z0-9_-]/g, "");
  const g = useMemo(() => trenzaGeometria({ chica, m, om, pasos, paradas }), [chica, m, om, pasos, paradas]);
  const degradado = (c: TrenzaCinta, gid: string) => (
    <linearGradient key={gid} id={gid} gradientUnits="userSpaceOnUse" x1={c.x1} y1={0} x2={c.x2} y2={0}>
      {c.paradas.map((p, i) => <stop key={i} offset={p.offset} style={{ "--k": p.k } as CSSProperties} />)}
    </linearGradient>
  );
  return (
    <svg
      className={["pulso-isotipo", className].filter(Boolean).join(" ")}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{ "--isotipo-fondo": fondo, "--isotipo-tinta": tinta, ...style } as CSSProperties}
    >
      <defs>
        <clipPath id={`${id}-huso`}><path d={g.huso} /></clipPath>
        {g.atras.map((c, i) => degradado(c, `${id}-a${i}`))}
        {g.adelante.map((c, i) => degradado(c, `${id}-d${i}`))}
        {g.filos.map((filo) => (
          <clipPath key={filo.hilo} id={`${id}-f${filo.hilo}`}>
            {filo.recorte.map((d, i) => <path key={i} d={d} />)}
          </clipPath>
        ))}
      </defs>
      {contenedor ? <rect className="pulso-isotipo-contenedor" width="100" height="100" rx="24" /> : null}
      <g transform={`rotate(${g.rotacion} 50 50)`}>
        <g clipPath={`url(#${id}-huso)`}>
          {g.atras.map((c, i) => <path key={`a${i}`} d={c.d} fill={`url(#${id}-a${i})`} />)}
          {g.filos.map((filo) => (
            <g key={`f${filo.hilo}`} clipPath={`url(#${id}-f${filo.hilo})`} fill="none" strokeWidth={g.anchoFilo} strokeLinecap="round" strokeLinejoin="round" className="pulso-isotipo-filo">
              {filo.lineas.map((d, i) => <path key={i} d={d} />)}
            </g>
          ))}
          {g.adelante.map((c, i) => <path key={`d${i}`} d={c.d} fill={`url(#${id}-d${i})`} />)}
        </g>
      </g>
    </svg>
  );
}
