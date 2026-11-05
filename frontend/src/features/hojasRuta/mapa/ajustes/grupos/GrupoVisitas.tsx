import type { HojasRutaEstratoMuestral, HojasRutaIntegratedConfig } from "../../../../../api/hojasRuta";
import { EstratoMuestral, politicaAlCambiar } from "../../muestra/EstratoMuestral";
import { useCambiarMuestra } from "./useCambiarMuestra";

type Props = { config: HojasRutaIntegratedConfig; estratoServidor: HojasRutaEstratoMuestral | null; deshabilitado: boolean };

/**
 * Grupo 3 de «Ajustes del diseño», Visitas mínimas (M3): el mínimo de rutas por ciudad visitada y las
 * ciudades fijas y aleatorias que resultan (ADR 0131), mudados del inspector de Muestra.
 */
export function GrupoVisitas({ config, estratoServidor, deshabilitado: ed }: Props) {
  const { cambiar, cambiarS } = useCambiarMuestra();
  return (
    <div className="hr-ajustes-grupo-cuerpo">
      <section className="hr-ajustes-bloque" aria-label="Visitas mínimas">
        <EstratoMuestral parte="visitas" sampleSize={config.sample_size} rowVar={config.row_var} nPorDistrito={config.sample_size_mode === "external_district"} servidor={estratoServidor} deshabilitado={ed} onCambio={(estrato) => cambiar({ sample_size: { estrato }, ...politicaAlCambiar(estrato) })} onCambioMinimo={(rutas_minimas_ciudad) => cambiarS({ rutas_minimas_ciudad })} />
      </section>
    </div>
  );
}
