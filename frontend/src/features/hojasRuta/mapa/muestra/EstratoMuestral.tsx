import type { HojasRutaEstratoModo, HojasRutaEstratoMuestral, HojasRutaIntegratedConfig, HojasRutaSampleSizeConfig, HojasRutaSampleSizeDistrictRow } from "../../../../api/hojasRuta";
import type { ResultadoTamano } from "./motorTamano";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";

/**
 * ADR 0131 §1: estrato explícito del sorteo. Por distrito (defecto) cada distrito es su
 * estrato; por provincia el estrato es la provincia (o, con Lima en 5 áreas, cada área
 * interdistrital de Lima Metropolitana, con Callao aparte), con distrito y zona como
 * estratos implícitos. §1b: toda ciudad visitada lleva al menos `rutas_minimas_ciudad`
 * rutas (6 por defecto); entran con certeza las que llegan al mínimo, y siempre Lima y
 * Callao, y las demás se sortean por macrorregión. La selección sale del último tamaño
 * calculado en R: el espejo del navegador no reparte por ciudad.
 */

export const RUTAS_MINIMAS_CIUDAD = 6;

const MACRORREGIONES: Record<string, string> = { norte: "Norte", centro: "Centro", sur: "Sur", oriente: "Oriente" };
const fmtPi = (v: number) => formatoDecimal(v, 2);

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
  onCambioMinimo: (rutas: number) => void;
};

export function EstratoMuestral({ sampleSize, rowVar, nPorDistrito, servidor, deshabilitado, onCambio, onCambioMinimo }: Props) {
  const modo = nPorDistrito ? "distrito" : estratoDe(sampleSize);
  const porZona = rowVar === "zona";
  const minimo = sampleSize.rutas_minimas_ciudad ?? RUTAS_MINIMAS_CIUDAD;
  // Las cifras del servidor sólo valen para el mismo estrato y el mismo mínimo.
  const vigente = servidor && servidor.modo === modo && servidor.rutas_minimas_ciudad === minimo ? servidor : null;
  const forzosas = vigente ? [...vigente.ciudades.filter((c) => c.condicion === "forzosa")].sort((a, b) => b.rutas - a.rutas) : [];
  const areasLima = vigente && vigente.modo === "provincia_lima_areas" ? vigente.estratos.filter((e) => e.estrato.startsWith("1501-")) : [];
  const totalRutas = vigente ? vigente.ciudades.reduce((a, c) => a + c.rutas, 0) : 0;

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
          <label className="hr-muestra-campo">
            <small>Rutas mínimas por ciudad visitada</small>
            <span className="hr-muestra-pasos">
              <PulsoButton variant="secondary" size="sm" disabled={deshabilitado || minimo <= 1} aria-label="Una ruta mínima menos" onClick={() => onCambioMinimo(Math.max(1, minimo - 1))}>−</PulsoButton>
              <input type="number" value={minimo} min={1} step={1} disabled={deshabilitado} aria-label="Rutas mínimas por ciudad visitada" onChange={(e) => e.target.value !== "" && Number(e.target.value) >= 1 && onCambioMinimo(Math.round(Number(e.target.value)))} />
              <PulsoButton variant="secondary" size="sm" disabled={deshabilitado} aria-label="Una ruta mínima más" onClick={() => onCambioMinimo(minimo + 1)}>+</PulsoButton>
            </span>
          </label>
          <p className="hr-mapa-nota">
            Entra con certeza toda ciudad cuyo reparto llega a {minimo} rutas, y siempre Lima y Callao. Las demás se sortean por macrorregión según su tamaño y cada ciudad sorteada recibe al menos {minimo} rutas. Dentro de la ciudad, distrito y zona quedan como estratos implícitos; los reemplazos son de la misma zona.
          </p>
          {vigente ? (
            <>
              <dl className="hr-mapa-filas hr-muestra-estratos" aria-label="Ciudades con certeza">
                {forzosas.map((c) => (
                  <div key={c.ciudad} data-bajo-minimo={c.rutas < minimo || undefined}>
                    <dt>{c.etiqueta}</dt>
                    <dd>{formatoConteo(c.rutas)} rutas</dd>
                  </div>
                ))}
              </dl>
              {areasLima.length ? (
                <p className="hr-mapa-nota">Lima por áreas: {areasLima.map((e) => `${e.etiqueta.replace(/^Lima /, "")} ${formatoConteo(e.rutas)}`).join(", ")} rutas.</p>
              ) : null}
              {vigente.grupos.map((g) => {
                const ciudades = vigente.ciudades.filter((c) => c.grupo === g.grupo).sort((a, b) => b.pi_ciudad - a.pi_ciudad);
                return (
                  <div key={g.grupo} className="hr-muestra-grupo-ciudades" data-grupo={g.grupo}>
                    <p className="hr-muestra-grupo-cab">
                      <strong>{MACRORREGIONES[g.grupo] ?? g.grupo}</strong>
                      <span>{formatoConteo(g.rutas)} rutas en {formatoConteo(g.h)} de {formatoConteo(g.n_ciudades)} ciudades</span>
                    </p>
                    <dl className="hr-mapa-filas hr-muestra-estratos" aria-label={`Sorteo de ciudades en ${MACRORREGIONES[g.grupo] ?? g.grupo}`}>
                    {ciudades.map((c) => (
                      <div key={c.ciudad} data-condicion={c.condicion} data-bajo-minimo={(c.condicion === "sorteada" && c.rutas < minimo) || undefined}>
                        <dt>{c.etiqueta}</dt>
                        <dd>{c.condicion === "sorteada" ? `sorteada, ${formatoConteo(c.rutas)} rutas` : "no sale"} (π {fmtPi(c.pi_ciudad)})</dd>
                      </div>
                    ))}
                    </dl>
                  </div>
                );
              })}
              <dl className="hr-mapa-filas hr-muestra-estratos" aria-label="Total de rutas">
                <div>
                  <dt>Total</dt>
                  <dd><strong>{formatoConteo(totalRutas)} rutas</strong></dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="hr-mapa-nota">Las ciudades y sus rutas se calculan al guardar.</p>
          )}
        </>
      )}
    </section>
  );
}
