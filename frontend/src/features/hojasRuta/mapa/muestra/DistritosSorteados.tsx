import type { HojasRutaEstratoMuestral, HojasRutaSampleSizeConfig } from "../../../../api/hojasRuta";
import { RUTAS_MINIMAS_DISTRITO } from "../../../../api/hojasRutaDistritos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";

/**
 * ADR 0131 §1c: dentro de cada ciudad o área de Lima, todo distrito visitado lleva al menos
 * `rutas_minimas_distrito` rutas (3 por defecto). Entran con certeza los que llegan al mínimo;
 * los demás se sortean según su tamaño. Rige con estrato provincia y la base 2025. Las cifras
 * salen del último tamaño calculado en R.
 */

type SampleSizeDistritos = Pick<HojasRutaSampleSizeConfig, "estrato" | "base_reparto" | "rutas_minimas_distrito">;

type Props = {
  sampleSize: SampleSizeDistritos;
  /** Con N por distrito o estrato distrito no rige. */
  aplica: boolean;
  servidor: HojasRutaEstratoMuestral | null;
  deshabilitado: boolean;
  onCambioMinimo: (rutas: number) => void;
};

export const distritosAplica = (s: SampleSizeDistritos, nPorDistrito: boolean): boolean =>
  !nPorDistrito && (s.estrato ?? "distrito") !== "distrito" && s.base_reparto === "cpv2025_adultos_urbanos";

export function DistritosSorteados({ sampleSize, aplica, servidor, deshabilitado, onCambioMinimo }: Props) {
  if (!aplica) return null;
  const minimo = sampleSize.rutas_minimas_distrito || RUTAS_MINIMAS_DISTRITO;
  const d = servidor?.distritos;
  const vigente = d && d.rutas_minimas_distrito === minimo && servidor?.modo === sampleSize.estrato ? d : null;
  const grupos = vigente ? [...vigente.grupos].sort((a, b) => b.rutas - a.rutas) : [];
  const descontados = grupos.filter((g) => g.regla === "minimo_descontado_de_forzosos" || g.regla === "forzoso_al_grupo");

  return (
    <section className="hr-muestra-grupo" aria-label="Distritos del sorteo" data-distritos-sorteo>
      <h3>Distritos del sorteo</h3>
      <label className="hr-muestra-campo">
        <small>Rutas mínimas por distrito visitado</small>
        <span className="hr-muestra-pasos">
          <PulsoButton variant="secondary" size="sm" disabled={deshabilitado || minimo <= 1} aria-label="Una ruta mínima por distrito menos" onClick={() => onCambioMinimo(Math.max(1, minimo - 1))}>−</PulsoButton>
          <input type="number" value={minimo} min={1} step={1} disabled={deshabilitado} aria-label="Rutas mínimas por distrito visitado" onChange={(e) => e.target.value !== "" && Number(e.target.value) >= 1 && onCambioMinimo(Math.round(Number(e.target.value)))} />
          <PulsoButton variant="secondary" size="sm" disabled={deshabilitado} aria-label="Una ruta mínima por distrito más" onClick={() => onCambioMinimo(minimo + 1)}>+</PulsoButton>
        </span>
      </label>
      <p className="hr-mapa-nota">
        Entra con certeza todo distrito cuyo reparto llega a {minimo} rutas; los demás se sortean según su tamaño y cada distrito sorteado recibe al menos {minimo}. Cada ruta queda entera en su distrito.
      </p>
      {vigente ? (
        <>
          <dl className="hr-mapa-filas hr-muestra-estratos" aria-label="Distritos por ciudad">
            {grupos.map((g) => (
              <div key={g.estrato} data-estrato={g.estrato}>
                <dt>{g.etiqueta}</dt>
                <dd>
                  {formatoConteo(g.n_forzosos)} con certeza
                  {g.n_candidatos > 0 ? `, ${formatoConteo(g.h)} de ${formatoConteo(g.n_candidatos)} sorteados` : ""}
                </dd>
              </div>
            ))}
          </dl>
          {descontados.length ? (
            <p className="hr-mapa-nota">
              En {descontados.map((g) => g.etiqueta).join(", ")} el distrito sorteado recibe el mínimo descontado de los que entran con certeza.
            </p>
          ) : null}
        </>
      ) : (
        <p className="hr-mapa-nota">Los distritos se calculan al guardar.</p>
      )}
    </section>
  );
}
