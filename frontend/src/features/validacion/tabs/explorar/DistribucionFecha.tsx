import { fmtN } from "./explorarModelo";

/** E6 — fecha: una columna por día; los días sin casos quedan en gris, no desaparecen. */
export default function DistribucionFecha({ dias }: { dias: readonly { fecha: string; n: number }[] }) {
  if (!dias.length) {
    // Un campo de hora (`time`) llega como fecha sin día legible: no hay eje que dibujar.
    return <p className="vx-pie">Sin fechas legibles que contar: si el campo registra sólo la hora, no hay días que dibujar.</p>;
  }
  const max = Math.max(0, ...dias.map((d) => d.n));
  return (
    <div className="vx-barras">
      <div className="vx-dias-caja">
        <div
          className="vx-dias"
          role="img"
          aria-label={`Casos por día, del ${dias[0].fecha} al ${dias[dias.length - 1].fecha}`}
          style={{ minWidth: `${dias.length * 6}px` }}
        >
          {dias.map((d) => (
            <span
              key={d.fecha}
              className={d.n === 0 ? "is-cero" : undefined}
              title={`${d.fecha} · ${fmtN(d.n)} casos`}
              style={{ height: `${d.n === 0 || max === 0 ? 3 : Math.max(3, (100 * d.n) / max)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="vx-eje" aria-hidden>
        <span>{dias[0].fecha}</span>
        <span>{dias[dias.length - 1].fecha}</span>
      </div>
    </div>
  );
}
