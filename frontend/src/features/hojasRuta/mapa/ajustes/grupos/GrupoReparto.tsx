import type { HojasRutaEstratoMuestral, HojasRutaIntegratedConfig, HojasRutaTerritory } from "../../../../../api/hojasRuta";
import { BaseReparto2025 } from "../../muestra/BaseReparto2025";
import { Opciones } from "../../muestra/controlesMuestra";
import { EstratoMuestral, politicaAlCambiar } from "../../muestra/EstratoMuestral";
import { useCambiarMuestra } from "./useCambiarMuestra";

type Props = { config: HojasRutaIntegratedConfig; territorios: readonly HojasRutaTerritory[]; estratoServidor: HojasRutaEstratoMuestral | null; deshabilitado: boolean };

/**
 * Grupo 2 de «Ajustes del diseño», Reparto y estrato (M3): asignación entre distritos, población del reparto
 * (CPV 2025 o 2017) y estrato del sorteo, mudados del inspector de Muestra. Mismo borrador, misma semántica.
 */
export function GrupoReparto({ config, territorios, estratoServidor, deshabilitado: ed }: Props) {
  const { cambiar, cambiarS } = useCambiarMuestra();
  const s = config.sample_size;
  const nPorDistrito = config.sample_size_mode === "external_district";
  return (
    <div className="hr-ajustes-grupo-cuerpo">
      {!nPorDistrito ? (
        <section className="hr-ajustes-bloque" aria-label="Asignación entre distritos">
          <h4>Asignación entre distritos</h4>
          <Opciones etiqueta="Cómo se reparten las rutas" valor={s.allocation_mode ?? "proportional"} deshabilitado={ed} opciones={[["proportional", "Por tamaño"], ["uniform", "Igualitaria"], ["compromise", "Intermedia"]] as const} onCambio={(v) => cambiarS({ allocation_mode: v })} />
        </section>
      ) : null}
      <section className="hr-ajustes-bloque" aria-label="Población del reparto">
        <BaseReparto2025 sampleSize={s} territorios={territorios} deshabilitado={ed} onCambio={(base_reparto) => cambiarS({ base_reparto })} />
      </section>
      <section className="hr-ajustes-bloque" aria-label="Estrato del sorteo">
        <EstratoMuestral parte="estrato" sampleSize={s} rowVar={config.row_var} nPorDistrito={nPorDistrito} servidor={estratoServidor} deshabilitado={ed} onCambio={(estrato) => cambiar({ sample_size: { estrato }, ...politicaAlCambiar(estrato) })} onCambioMinimo={(rutas_minimas_ciudad) => cambiarS({ rutas_minimas_ciudad })} />
      </section>
    </div>
  );
}
