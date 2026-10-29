import { PulsoButton } from "../../../../components/PulsoButton";
import { Plus, X } from "../../../../vendor/lucide-react";
import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { useLienzoHojasRuta } from "../store";
import type { ResultadoTamano } from "./motorTamano";
import { escenarioDe, firmaEscenario } from "./repartos";

/**
 * Escenarios de tamaño (brecha B32): se guarda lo que hoy se ve —N, margen,
 * peor distrito, contactos— para compararlo con otros antes de decidir.
 * Aplicar uno lo deja como borrador; se confirma con «Guardar y calcular».
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
const pct = (v: number | null) => (v == null ? "—" : `±${(v * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %`);

export function EscenariosMuestra({ config, resultado, bloqueado }: { config: HojasRutaIntegratedConfig; resultado: ResultadoTamano; bloqueado: boolean }) {
  const { escenariosMuestra: escenarios, setEscenariosMuestra, setMuestraBorrador } = useLienzoHojasRuta();
  const actual = firmaEscenario(config);
  const yaEsta = escenarios.some((e) => e.firma === actual);
  const siguiente = escenarios.reduce((m, e) => Math.max(m, Number(/\d+$/.exec(e.nombre)?.[0] ?? 0)), 0) + 1;
  return (
    <section className="hr-muestra-escenarios" aria-label="Escenarios">
      <h3>
        Escenarios <small>{escenarios.length}</small>
      </h3>
      {escenarios.length ? (
        <ul>
          {escenarios.map((e, i) => (
            <li key={e.firma} data-actual={e.firma === actual || undefined}>
              <span>
                <strong>{e.nombre}</strong>
                <small>
                  N {fmt(e.n)} · {pct(e.margen)} · peor {pct(e.peor)} · {fmt(e.contactos)} contactos
                </small>
              </span>
              {e.firma === actual ? (
                <small className="hr-muestra-escenario-actual">En pantalla</small>
              ) : (
                <PulsoButton variant="secondary" size="sm" disabled={bloqueado} onClick={() => setMuestraBorrador(e.borrador)}>
                  Aplicar
                </PulsoButton>
              )}
              <PulsoButton variant="icon" size="sm" aria-label={`Quitar ${e.nombre}`} onClick={() => setEscenariosMuestra(escenarios.filter((_, k) => k !== i))}>
                <X size={13} aria-hidden />
              </PulsoButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hr-mapa-nota">Guarda el escenario que ves para compararlo con otros antes de decidir. Se conservan mientras el proyecto esté abierto.</p>
      )}
      <PulsoButton variant="secondary" size="sm" disabled={yaEsta || !resultado.filas.length} onClick={() => setEscenariosMuestra([...escenarios, escenarioDe(`Escenario ${siguiente}`, config, resultado)])}>
        <Plus size={13} aria-hidden /> {yaEsta ? "Este escenario ya está guardado" : "Guardar este escenario"}
      </PulsoButton>
    </section>
  );
}
