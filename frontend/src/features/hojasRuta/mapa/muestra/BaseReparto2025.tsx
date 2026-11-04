import type { HojasRutaSampleSizeConfig, HojasRutaTerritory } from "../../../../api/hojasRuta";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";
import { nombreDistrito } from "../nombres";
import { usaBase2025 } from "./desdeConfig";

/**
 * ADR 0131 §2: repartir la muestra entre distritos con los adultos urbanos estimados 2025
 * (P̂25 = población 2025 × u17 × a17) en vez de la población del marco 2017. Apagado por
 * defecto. Encendido, declara la fuente y los supuestos por distrito, que es lo que la
 * memoria de cálculo tiene que poder repetir.
 */

export const FUENTE_REPARTO_2025 = "CPV 2025 (supuestos u17, a17 de 2017)";
export const FUENTE_REPARTO_2017 = "CPV 2017 (población del marco de manzanas)";

/** Rótulo de la población con que se reparte, para la memoria de cálculo. */
export const fuenteDelReparto = (s: Pick<HojasRutaSampleSizeConfig, "base_reparto"> | undefined) =>
  usaBase2025(s) ? FUENTE_REPARTO_2025 : FUENTE_REPARTO_2017;

/** Distritos confirmados a los que les falta algún dato de la base 2025. */
export const sinBase2025 = (territorios: readonly HojasRutaTerritory[]) =>
  territorios.filter((t) => !(typeof t.p25 === "number" && Number.isFinite(t.p25) && t.p25 > 0));

const pct = (v: number | null | undefined, d = 1) => (typeof v === "number" && Number.isFinite(v) ? `${formatoDecimal(v * 100, d)} %` : "—");

type Props = {
  sampleSize: HojasRutaSampleSizeConfig;
  territorios: readonly HojasRutaTerritory[];
  deshabilitado: boolean;
  onCambio: (base: NonNullable<HojasRutaSampleSizeConfig["base_reparto"]>) => void;
};

export function BaseReparto2025({ sampleSize, territorios, deshabilitado, onCambio }: Props) {
  const activa = usaBase2025(sampleSize);
  const faltan = sinBase2025(territorios);

  return (
    <section className="hr-muestra-grupo" aria-label="Población del reparto" data-base-reparto={activa ? "cpv2025" : "cpv2017"}>
      <h3>Población del reparto</h3>
      <PulsoSwitch
        size="sm"
        label="Repartir con la población 2025"
        description={activa ? FUENTE_REPARTO_2025 : FUENTE_REPARTO_2017}
        checked={activa}
        disabled={deshabilitado || (!activa && faltan.length > 0) || !territorios.length}
        onCheckedChange={(v) => onCambio(v ? "cpv2025_adultos_urbanos" : "cpv2017")}
      />
      {faltan.length && !activa ? (
        <p className="hr-mapa-nota">Sin población 2025 en el registro: {faltan.map((t) => nombreDistrito(t.distrito)).join(", ")}.</p>
      ) : null}
      {activa ? (
        <>
          <p className="hr-mapa-nota">
            Adultos urbanos 2025 = población 2025 × u17 × a17. u17 es la parte del distrito que en 2017 caía en manzanas del marco; a17, la proporción de 18 a más en 2017. Las manzanas se siguen sorteando sobre el marco 2017.
          </p>
          {faltan.length ? <p className="hr-mapa-aviso">Falta la población 2025 de {faltan.map((t) => nombreDistrito(t.distrito)).join(", ")}: el cálculo no se podrá guardar.</p> : null}
          {/* Lista y no tabla: el inspector mide ~310 px y cinco columnas recortaban u17 y a17 (C4). */}
          <dl className="hr-mapa-filas hr-muestra-base25" aria-label="Supuestos de la población 2025 por distrito">
            {territorios.map((t) => (
              <div key={t.ubigeo}>
                <dt>{nombreDistrito(t.distrito)}</dt>
                <dd>
                  {formatoConteo(t.p25 == null ? null : Math.round(t.p25))} adultos (u17 {pct(t.u17, 0)}, a17 {pct(t.a17, 0)}, captación {typeof t.captacion === "number" ? `${formatoDecimal(t.captacion, 0)} %` : "—"})
                </dd>
              </div>
            ))}
          </dl>
          <p className="hr-mapa-nota">Captación: población del marco 2017 frente a la censada en 2025.</p>
        </>
      ) : null}
    </section>
  );
}
