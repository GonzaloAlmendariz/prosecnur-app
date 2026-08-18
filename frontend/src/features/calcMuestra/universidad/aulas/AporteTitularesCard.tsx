/**
 * «Cómo se reparte el aporte entre titulares» — histograma compacto (K3).
 * Responde si la muestra se sostiene pareja o si unas pocas aulas grandes
 * cargan con todo, con la concentración dicha en una frase.
 */
import { fmtInt } from "../../sharedCore";
import { construirAporteTitulares } from "./aporteTitularesModel";
import "./aporteTitulares.css";

export function AporteTitularesCard({
  filas,
}: {
  filas: ReadonlyArray<Record<string, unknown>> | null;
}) {
  const aporte = construirAporteTitulares(filas);
  if (!aporte) return null;
  const pctTop = Math.round(aporte.concentracionTop20 * 100);

  return (
    <section className="cmv2-aporte" aria-label="Distribución del aporte de los titulares">
      <header className="cmv2-aporte-head">
        <span className="cmv2-eyebrow">Cómo se reparte el aporte</span>
        <h4>Alumnos nuevos que trae cada titular</h4>
        <p>
          Cada barra cuenta titulares por tramo de aporte neto (alumnos
          elegibles nuevos, ya descontados los repetidos). El 20% de titulares
          que más aporta pone el <strong>{pctTop}%</strong> del total de{" "}
          {fmtInt(aporte.total)} alumnos; la mediana por titular es{" "}
          {fmtInt(Math.round(aporte.mediana))}.
          {aporte.scoreNegativo > 0 ? (
            <>
              {" "}
              <strong>{fmtInt(aporte.scoreNegativo)}</strong>{" "}
              {aporte.scoreNegativo === 1 ? "titular duplica" : "titulares duplican"}{" "}
              más de lo que aportan (score del sorteo negativo).
            </>
          ) : null}
        </p>
      </header>
      <div className="cmv2-aporte-hist" role="img" aria-label={`Histograma de aporte por titular, ${fmtInt(aporte.titulares)} titulares`}>
        {aporte.bins.map((bin, i) => (
          <div
            key={i}
            className="cmv2-aporte-bin"
            title={`${Math.round(bin.desde)}–${Math.round(bin.hasta)} alumnos: ${fmtInt(bin.n)} titulares`}
          >
            <span style={{ height: `${aporte.maxN ? (bin.n / aporte.maxN) * 100 : 0}%` }} />
            <small>{Math.round(bin.desde)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
