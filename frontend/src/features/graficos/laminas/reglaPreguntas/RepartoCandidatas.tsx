// El reparto de las candidatas de la regla: la métrica de TODAS sobre su eje, con la línea del corte. En las reglas por
// umbral es una pila de puntos sobre el valor (0–100, o 0 al techo de las diferencias); en las reglas por N, una barra
// por candidata en el orden de la regla (de mayor a menor) y el corte entre el puesto N y el siguiente. Las que entran
// van con el acento del módulo; las demás, en gris. El eje comparte ancho con la pista del slider que va debajo
// (CifraDeslizable): el pulgar y la línea se mueven juntos. La geometría sale de repartoRegla.ts.

import type { ReactElement } from "react";
import type { TipoReglaPreguntas } from "../../../../api/graficosRegla";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { Resaltada } from "./ListaCandidatas";
import { textoMetrica } from "./modeloReglaPreguntas";
import { apilar, fraccionCorte, fraccionEje, posicionTope, type Reparto } from "./repartoRegla";

const ALTO = 64;
const MARGEN = 4;
const RADIO = 2.5;
const COLUMNAS = 51;

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;

type Props = {
  reparto: Reparto;
  tipo: TipoReglaPreguntas;
  rotulo: string;
  etiquetas: ReadonlyMap<string, string>;
  /** Filas que admite la lámina nativa, si el backend avisó que la selección lo pasa. */
  tope: number | null;
  resaltada: Resaltada;
  onResaltar: (r: Resaltada) => void;
};

/** Las franjas que entran, en fracción del eje. */
function zonas(r: Reparto, tipo: TipoReglaPreguntas): [number, number][] {
  const c = r.cortes.map((x) => fraccionCorte(r, x));
  if (r.modo === "umbral") return tipo === "bajo_umbral" ? [[0, c[0]]] : [[c[0], 1]];
  return c.length > 1 ? [[0, c[0]], [c[1], 1]] : [[0, c[0]]];
}

export function RepartoCandidatas({ reparto: r, tipo, rotulo, etiquetas, tope, resaltada, onResaltar }: Props) {
  const util = ALTO - 2 * MARGEN;
  const entran = r.puntos.filter((p) => p.entra);
  const etiqueta = `Reparto de ${rotulo}: ${formatoConteo(entran.length)} de ${formatoConteo(r.puntos.length)}`;

  const clase = (base: string, tema: string, entra: boolean) =>
    `${base}${entra ? " is-entra" : ""}${resaltada?.tema === tema ? " is-resaltada" : ""}`;
  const eventos = (tema: string) => ({
    onPointerEnter: () => onResaltar({ tema, desde: "reparto" }),
    onPointerLeave: () => onResaltar(null),
  });
  const titulo = (tema: string, metrica: number) => <title>{`${etiquetas.get(tema) ?? tema}: ${textoMetrica(metrica)}`}</title>;
  const xTope = tope !== null ? posicionTope(r, tipo, tope) : null;
  const fTope = xTope === null ? null : r.modo === "umbral" ? fraccionEje(r, xTope) : fraccionCorte(r, xTope);

  let marcas: ReactElement[];
  if (r.modo === "umbral") {
    const pila = apilar(r.puntos, r.ejeMax, COLUMNAS);
    const niveles = pila.reduce((m, p) => Math.max(m, p.nivel + 1), 1);
    const dy = Math.min(2 * RADIO + 1, (util - 2 * RADIO) / Math.max(1, niveles - 1));
    marcas = r.puntos.map((p, i) => (
      <circle key={p.tema} className={clase("pulso-f6-regla-reparto-punto", p.tema, p.entra)} data-tema={p.tema}
        cx={pct(fraccionEje(r, p.x))} cy={ALTO - MARGEN - RADIO - pila[i].nivel * dy} r={RADIO} {...eventos(p.tema)}>
        {titulo(p.tema, p.metrica)}
      </circle>
    ));
  } else {
    const ancho = r.ejeMax > 0 ? Math.min(6, 70 / r.ejeMax) : 0;
    marcas = r.puntos.map((p) => {
      const h = Math.max(1.5, (Math.max(0, p.metrica) / (r.escala || 1)) * util);
      const x = `${(fraccionEje(r, p.x) * 100 - ancho / 2).toFixed(3)}%`;
      return (
        <g key={p.tema} data-tema={p.tema} {...eventos(p.tema)}>
          {titulo(p.tema, p.metrica)}
          {/* Zona de toque a todo el alto: una barra baja no se deja apuntar. */}
          <rect className="pulso-f6-regla-reparto-toque" x={x} width={`${ancho.toFixed(3)}%`} y={0} height={ALTO} />
          <rect className={clase("pulso-f6-regla-reparto-barra", p.tema, p.entra)} x={x} width={`${ancho.toFixed(3)}%`}
            y={ALTO - MARGEN - h} height={h} rx={1} />
        </g>
      );
    });
  }

  return (
    <div className="pulso-f6-regla-reparto-lienzo" data-modo={r.modo}>
      <svg className="pulso-f6-regla-reparto-svg" width="100%" height={ALTO} role="img" aria-label={etiqueta}>
        {zonas(r, tipo).map(([a, b]) => (
          <rect key={`${a}-${b}`} className="pulso-f6-regla-reparto-zona" x={pct(Math.min(a, b))} width={pct(Math.abs(b - a))} y={0} height={ALTO} />
        ))}
        <line className="pulso-f6-regla-reparto-base" x1="0%" x2="100%" y1={ALTO - MARGEN + 0.5} y2={ALTO - MARGEN + 0.5} />
        {marcas}
        {fTope !== null && (
          <line className="pulso-f6-regla-reparto-tope" data-tope={tope ?? undefined} x1={pct(fTope)} x2={pct(fTope)} y1={0} y2={ALTO} />
        )}
        {r.cortes.map((c, i) => (
          <line key={i} className="pulso-f6-regla-reparto-corte" data-corte={c}
            x1={pct(fraccionCorte(r, c))} x2={pct(fraccionCorte(r, c))} y1={0} y2={ALTO} />
        ))}
      </svg>
    </div>
  );
}
