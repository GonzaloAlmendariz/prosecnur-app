import { useState } from "react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { apiHojasRutaCompararSemillas, type HojasRutaIntegratedConfig, type HojasRutaSemillaComparada } from "../../../../api/hojasRuta";

import { formatoDecimal } from "../../../../lib/formatoNumero";
/**
 * Comparar semillas (U13): sorteos en seco con otras semillas, sin guardar nada.
 * Todas son sorteos válidos del mismo marco; elegir una no cambia el diseño, sólo
 * evita una muestra con problemas operativos visibles. «Usar» pone la semilla en el
 * borrador del sorteo: sortear sigue siendo un paso explícito.
 */

const fmt = (n: number | null, d = 0) => (n == null ? "—" : formatoDecimal(n, d));
const pct = (n: number | null) => (n == null ? "—" : `${formatoDecimal(n * 100, 0)} %`);

export function CompararSemillas({ config, deshabilitado, onUsar }: { config: HojasRutaIntegratedConfig; deshabilitado: boolean; onUsar: (semilla: number) => void }) {
  const [filas, setFilas] = useState<HojasRutaSemillaComparada[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const comparar = () => {
    setCargando(true);
    setError("");
    apiHojasRutaCompararSemillas(config, 2)
      .then(setFilas)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo comparar las semillas"))
      .finally(() => setCargando(false));
  };
  return (
    <div className="hr-semillas">
      {filas ? (
        <>
          {/* Lista y no tabla: en el ancho del inspector una tabla escondía «Usar» tras un desplazamiento lateral. */}
          <ul className="hr-semillas-lista" aria-label="Comparación de semillas">
            {filas.map((f) => (
              <li key={f.semilla} data-actual={f.actual || undefined}>
                <span>
                  <strong>
                    {f.semilla}
                    {f.actual ? <em>, la actual</em> : null}
                  </strong>
                  <small>
                    <b>{f.por_revisar}</b> por revisar, NSE {pct(f.nse_distancia)} del esperado, mediana {fmt(f.mediana_viviendas)} viv., vecina a {fmt(f.cercania_km, 2)} km
                  </small>
                </span>
                {f.actual ? null : (
                  <PulsoButton variant="secondary" size="sm" disabled={deshabilitado} onClick={() => onUsar(f.semilla)}>
                    Usar
                  </PulsoButton>
                )}
              </li>
            ))}
          </ul>
          <p className="hr-mapa-nota">Todas son sorteos válidos del mismo marco: elegir una no cambia el diseño, sólo evita una muestra con problemas operativos visibles. El NSE dice cuánto se aparta el de las titulares del esperado en el marco (0 % = igual).</p>
        </>
      ) : null}
      {error ? <p className="hr-mapa-aviso">{error}</p> : null}
      <PulsoButton variant="secondary" size="sm" disabled={deshabilitado || cargando} onClick={comparar}>
        {cargando ? "Sorteando en seco…" : filas ? "Probar otras semillas" : "Comparar con otras semillas"}
      </PulsoButton>
    </div>
  );
}
