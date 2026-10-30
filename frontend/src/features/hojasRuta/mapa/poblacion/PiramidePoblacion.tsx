import type { HojasRutaAgeRange } from "../../../../api/hojasRuta";
import type { FilaMatriz } from "./matriz";
import { barrasDePiramide } from "./piramide";
import "./piramide.css";

const enMiles = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString("es-PE", { maximumFractionDigits: 2 })} M` : `${Math.round(n / 1000).toLocaleString("es-PE")} mil`);

/**
 * Pirámide de la población objetivo por sexo y edad (checklist F8), en el inspector de
 * Población: llena el espacio que quedaba vacío con lo que el analista necesita mirar antes
 * de fijar cuotas. Sólo con la matriz vigente y dividida por sexo.
 */
export function PiramidePoblacion({ filas, rangos }: { filas: readonly FilaMatriz[]; rangos: readonly HojasRutaAgeRange[] }) {
  const barras = barrasDePiramide(filas, rangos);
  const max = Math.max(1, ...barras.flatMap((b) => [b.H, b.M]));
  const totH = barras.reduce((a, b) => a + b.H, 0), totM = barras.reduce((a, b) => a + b.M, 0);
  if (!totH && !totM) return null;
  return (
    <section className="hr-graf hr-piramide" aria-label="Pirámide de la población objetivo">
      <h3 className="hr-graf-titulo">Población objetivo por sexo y edad</h3>
      <div className="hr-piramide-cab" aria-hidden="true">
        <span><i data-sexo="H" /> Hombres · {enMiles(totH)}</span>
        <span>Mujeres · {enMiles(totM)} <i data-sexo="M" /></span>
      </div>
      <ul>
        {barras.map((b) => (
          <li key={b.rango} aria-label={`${b.rango}: ${enMiles(b.H)} hombres y ${enMiles(b.M)} mujeres`}>
            <span className="hr-piramide-lado" data-sexo="H"><i style={{ width: `${(b.H / max) * 100}%` }} /><small>{enMiles(b.H)}</small></span>
            <b>{b.rango}</b>
            <span className="hr-piramide-lado" data-sexo="M"><i style={{ width: `${(b.M / max) * 100}%` }} /><small>{enMiles(b.M)}</small></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
