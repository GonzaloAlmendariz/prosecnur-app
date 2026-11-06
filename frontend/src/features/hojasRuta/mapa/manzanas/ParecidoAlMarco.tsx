import { NSE, pct } from "../territorio/TerritorioGraficos";

/**
 * «¿Se parece al marco?» (brecha B38): el reparto por NSE de las viviendas del marco
 * frente al de las UMP titulares sorteadas. Con un sorteo proporcional a las
 * viviendas, las dos barras deberían parecerse; una brecha grande en un nivel se
 * marca para revisar la semilla o el marco.
 */
type Props = {
  /** Viviendas por nivel NSE de las manzanas del marco (distritos confirmados). */
  marco: Record<number, number> | null;
  /** UMP titulares por nivel NSE de su manzana. */
  muestra: Record<number, number> | null;
  /** F12: la muestra es del reparto v1; la brecha la explica el algoritmo, no la semilla. */
  causaV1?: boolean;
};

const total = (r: Record<number, number>) => Object.values(r).reduce((a, v) => a + v, 0);
const UMBRAL = 0.05;

function Barra({ titulo, datos }: { titulo: string; datos: Record<number, number> }) {
  const t = total(datos) || 1;
  return (
    <div className="hr-parecido-fila">
      <small>{titulo}</small>
      <div className="hr-graf-apilada" role="img" aria-label={`${titulo}: ${NSE.map(([n, l]) => `${l} ${pct((datos[n] ?? 0) / t)}`).join(", ")}`}>
        {NSE.map(([n, l, tk]) => ((datos[n] ?? 0) > 0 ? <i key={n} title={`${l}: ${pct((datos[n] ?? 0) / t)}`} style={{ flexGrow: datos[n], background: `var(${tk})` }} /> : null))}
      </div>
    </div>
  );
}

export function ParecidoAlMarco({ marco, muestra, causaV1 = false }: Props) {
  if (!marco || !muestra || !total(marco) || !total(muestra)) return null;
  const tm = total(marco), ts = total(muestra);
  const filas = NSE.map(([n, l, tk]) => {
    const a = (marco[n] ?? 0) / tm, b = (muestra[n] ?? 0) / ts;
    return { n, l, tk, a, b, brecha: b - a };
  }).filter((f) => f.a > 0 || f.b > 0);
  const lejos = filas.filter((f) => Math.abs(f.brecha) >= UMBRAL);
  return (
    <section className="hr-graf" aria-label="¿Se parece al marco?">
      <h3 className="hr-graf-titulo">¿Se parece al marco?</h3>
      <Barra titulo="Marco (viviendas)" datos={marco} />
      <Barra titulo="Muestra (UMP titulares)" datos={muestra} />
      <ul className="hr-parecido-tabla">
        {filas.map((f) => (
          <li key={f.n} data-lejos={Math.abs(f.brecha) >= UMBRAL || undefined}>
            <i style={{ background: `var(${f.tk})` }} />
            <span>{f.l}</span>
            <b>{pct(f.a)}</b>
            <b>{pct(f.b)}</b>
          </li>
        ))}
      </ul>
      <p className="hr-graf-nota">
        {lejos.length && causaV1
          ? `${lejos.map((f) => f.l).join(", ")} ${lejos.length === 1 ? "se aleja" : "se alejan"} 5 puntos o más del marco por el reparto anterior del sorteo, no por la semilla: sortea de nuevo.`
          : lejos.length
          ? `${lejos.map((f) => f.l).join(", ")} ${lejos.length === 1 ? "se aleja" : "se alejan"} 5 puntos o más del marco: revisa la semilla o compara con otra.`
          : "Ningún nivel se aleja 5 puntos o más del marco."}
      </p>
    </section>
  );
}
