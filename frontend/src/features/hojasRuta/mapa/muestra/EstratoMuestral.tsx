import type { HojasRutaEstratoModo, HojasRutaEstratoMuestral, HojasRutaIntegratedConfig, HojasRutaSampleSizeConfig, HojasRutaSampleSizeDistrictRow } from "../../../../api/hojasRuta";
import type { ResultadoTamano } from "./motorTamano";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { formatoConteo } from "../../../../lib/formatoNumero";

/**
 * ADR 0131 §1: estrato explícito del sorteo. Por distrito (defecto) cada distrito es su
 * estrato; por provincia el estrato es la provincia (o, con Lima en 5 áreas, cada área
 * interdistrital de Lima Metropolitana, con Callao aparte), con un mínimo de 2 rutas por
 * estrato y distrito y zona como estratos implícitos. Las rutas por estrato salen del
 * último tamaño calculado en R: el espejo del navegador no reparte por estrato.
 */

export const ESTRATO_MIN_RUTAS = 2;

export const ESTRATOS: ReadonlyArray<readonly [HojasRutaEstratoModo, string]> = [
  ["distrito", "Por distrito"],
  ["provincia", "Por provincia"],
  ["provincia_lima_areas", "Por provincia, Lima en 5 áreas"],
];

export const estratoDe = (s: Pick<HojasRutaSampleSizeConfig, "estrato"> | undefined): HojasRutaEstratoModo => s?.estrato ?? "distrito";

/** Al pasar a un estrato provincia el reemplazo por defecto es el pareado de la misma zona, que hereda la π (ADR 0131 §5). */
export const politicaAlCambiar = (modo: HojasRutaEstratoModo): Pick<HojasRutaIntegratedConfig, "replacement_policy"> | null =>
  modo === "distrito" ? null : { replacement_policy: "paired_by_titular_zone" };

/**
 * Con estrato provincia las rutas por distrito salen del redondeo dentro del estrato, que
 * sólo hace R. Si el último tamaño guardado es de ese mismo estrato y no hay borrador, el
 * reparto por distrito se lee de él (vista previa = cuota); si no, queda el del espejo.
 */
export function conRepartoDelEstrato(
  r: ResultadoTamano,
  filasServidor: readonly HojasRutaSampleSizeDistrictRow[] | undefined,
  modo: HojasRutaEstratoModo,
  servidor: HojasRutaEstratoMuestral | null,
  hayBorrador: boolean,
): ResultadoTamano {
  if (modo === "distrito" || hayBorrador || !servidor || servidor.modo !== modo || !filasServidor?.length) return r;
  const porUbigeo = new Map(filasServidor.map((f) => [f.ubigeo, f]));
  return {
    ...r,
    filas: r.filas.map((f) => {
      const s = porUbigeo.get(f.ubigeo);
      return s && Number.isFinite(s.n_used) ? { ...f, nUsado: s.n_used, margen: s.margin_estimated ?? f.margen } : f;
    }),
  };
}

type Props = {
  sampleSize: HojasRutaSampleSizeConfig;
  rowVar: HojasRutaIntegratedConfig["row_var"];
  /** Con N por distrito las rutas las fija el usuario: el estrato provincia no rige. */
  nPorDistrito: boolean;
  /** `estrato_muestral` del último tamaño guardado, ya normalizado. */
  servidor: HojasRutaEstratoMuestral | null;
  deshabilitado: boolean;
  onCambio: (estrato: HojasRutaEstratoModo) => void;
};

export function EstratoMuestral({ sampleSize, rowVar, nPorDistrito, servidor, deshabilitado, onCambio }: Props) {
  const modo = nPorDistrito ? "distrito" : estratoDe(sampleSize);
  const porZona = rowVar === "zona";
  const vigente = servidor && servidor.modo === modo ? servidor : null;
  const totalRutas = vigente ? vigente.estratos.reduce((a, e) => a + e.rutas, 0) : 0;

  return (
    <section className="hr-muestra-grupo" aria-label="Estrato del sorteo" data-estrato={modo}>
      <h3>Estrato del sorteo</h3>
      <PulsoSelect
        size="sm"
        ariaLabel="Estrato del sorteo"
        value={modo}
        disabled={deshabilitado || nPorDistrito}
        options={ESTRATOS.map(([v, l]) => ({ value: v, label: l, disabled: v !== "distrito" && porZona }))}
        onValueChange={(v) => onCambio(v as HojasRutaEstratoModo)}
      />
      {nPorDistrito ? <p className="hr-mapa-nota">Con el N escrito por distrito, cada distrito es su propio estrato.</p> : null}
      {porZona ? <p className="hr-mapa-nota">Con la cuota por zona el estrato es el distrito: la provincia necesita la cuota por distrito.</p> : null}
      {modo === "distrito" ? (
        <p className="hr-mapa-nota">Cada distrito es su propio estrato y recibe las rutas del reparto.</p>
      ) : (
        <>
          <p className="hr-mapa-nota">
            Mínimo {ESTRATO_MIN_RUTAS} rutas por estrato y el resto según su población. Dentro del estrato, las rutas se reparten entre distritos según las viviendas del marco elegible; distrito y zona quedan como estratos implícitos. Los reemplazos son de la misma zona.
          </p>
          {vigente ? (
            <dl className="hr-mapa-filas hr-muestra-estratos" aria-label="Rutas por estrato">
              {vigente.estratos.map((e) => (
                <div key={e.estrato} data-bajo-minimo={e.rutas < vigente.minimo_rutas || undefined}>
                  <dt>{e.etiqueta}</dt>
                  <dd>
                    {formatoConteo(e.rutas)} rutas ({formatoConteo(e.n_distritos)} {e.n_distritos === 1 ? "distrito" : "distritos"})
                  </dd>
                </div>
              ))}
              <div>
                <dt>Total</dt>
                <dd><strong>{formatoConteo(totalRutas)} rutas</strong></dd>
              </div>
            </dl>
          ) : (
            <p className="hr-mapa-nota">Las rutas por estrato se calculan al guardar.</p>
          )}
        </>
      )}
    </section>
  );
}
