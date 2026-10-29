import { useState } from "react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { apiHojasRutaIcc, apiHojasRutaIccAplicar, type HojasRutaIccAplicable, type HojasRutaIccEntrada, type HojasRutaIntegratedConfig, type HojasRutaSampleSizeConfig } from "../../../../api/hojasRuta";

/**
 * «Desde un estudio previo» (U12d, ADR 0116 §2): la biblioteca local de ICC. Solo se
 * aplica un ICC medido con la ruta como conglomerado y sobre una proporción; el DEFF
 * se recalcula con el k de este estudio. Aplicar cambia el borrador, no guarda.
 */

type Entrada = HojasRutaIccEntrada & { aplicable: HojasRutaIccAplicable };
const num = (n: number | undefined, d = 3) => (n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("es-PE", { maximumFractionDigits: d }));

export function IccPanel({ config, deshabilitado, onAplicar }: { config: HojasRutaIntegratedConfig; deshabilitado: boolean; onAplicar: (ss: HojasRutaSampleSizeConfig) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [error, setError] = useState("");
  const [aplicando, setAplicando] = useState<string | null>(null);
  const k = config.entrevistas_por_manzana;
  const abrir = () => {
    setAbierto(true);
    setError("");
    apiHojasRutaIcc()
      .then(setEntradas)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo leer la biblioteca de ICC"));
  };
  if (!abierto) {
    return (
      <PulsoButton variant="secondary" size="sm" disabled={deshabilitado} onClick={abrir}>
        Desde un estudio previo
      </PulsoButton>
    );
  }
  const aplicables = (entradas ?? []).filter((e) => e.aplicable.ok);
  const mayor = aplicables.reduce<Entrada | null>((a, e) => (!a || e.icc > a.icc ? e : a), null);
  return (
    <div className="hr-icc">
      <div className="hr-icc-cab">
        <small>ICC medidos en estudios anteriores</small>
        <PulsoButton variant="icon" size="sm" aria-label="Cerrar la biblioteca de ICC" onClick={() => setAbierto(false)}>×</PulsoButton>
      </div>
      {error ? <p className="hr-mapa-aviso">{error}</p> : null}
      {entradas == null && !error ? <p className="hr-mapa-nota">Leyendo la biblioteca…</p> : null}
      {entradas && !entradas.length ? <p className="hr-mapa-nota">La biblioteca está vacía. Cuando un estudio cierre su campo, su ICC por ruta se puede guardar aquí.</p> : null}
      <ul className="hr-icc-lista">
        {(entradas ?? []).map((e) => (
          <li key={e.id} data-aplicable={e.aplicable.ok || undefined}>
            <span>
              <strong>{e.estudio || e.id} · {e.indicador || "indicador"}</strong>
              <small>
                ICC {num(e.icc)} · {num(e.conglomerados, 0)} conglomerados
                {e.aplicable.ok ? ` · DEFF con ${k} por ruta: ${num(1 + (k - 1) * e.icc, 2)}` : ""}
                {e.id === mayor?.id && aplicables.length > 1 ? " · el mayor (conservador)" : ""}
              </small>
              {!e.aplicable.ok ? <small className="hr-icc-motivo">{e.aplicable.motivo}</small> : null}
              {(e.aplicable.avisos ?? []).map((a) => <small key={a.code} className="hr-icc-motivo">{a.message}</small>)}
            </span>
            {e.aplicable.ok ? (
              <PulsoButton
                variant="secondary"
                size="sm"
                disabled={deshabilitado || aplicando != null}
                onClick={() => {
                  setAplicando(e.id);
                  apiHojasRutaIccAplicar(config, e.id)
                    .then((r) => {
                      onAplicar(r.sample_size);
                      setAbierto(false);
                    })
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudo aplicar el ICC"))
                    .finally(() => setAplicando(null));
                }}
              >
                {aplicando === e.id ? "Aplicando…" : "Usar"}
              </PulsoButton>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
