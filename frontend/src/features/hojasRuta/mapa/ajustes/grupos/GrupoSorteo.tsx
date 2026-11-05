import type { HojasRutaIntegratedConfig } from "../../../../../api/hojasRuta";
import { GlidingRadioGroup } from "../../../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../../../components/PulsoButton";
import { CompararSemillas } from "../../manzanas/CompararSemillas";
import { Diagrama, METODOS, Opciones, PESOS } from "../../manzanas/ManzanasPaneles";
import { otraSemilla, type BorradorSorteo } from "../../manzanas/sorteo";
import { useLienzoHojasRuta } from "../../store";
import { useAbrirAjustes } from "../useAjustesDiseno";

type Props = { config: HojasRutaIntegratedConfig; listoParaSortear: boolean; deshabilitado: boolean; onIrASortear: () => void };

/**
 * Grupo 6 de «Ajustes del diseño», Sorteo de manzanas (M5): método, medida de tamaño y semilla, mudados del
 * inspector de Manzanas. Escriben el borrador del sorteo (`sorteoBorrador`), que se aplica AL SORTEAR: el
 * sorteo es una decisión y sigue siendo el botón de Manzanas, no el «Aplicar» de esta ventana.
 */
export function GrupoSorteo({ config, listoParaSortear, deshabilitado: ed, onIrASortear }: Props) {
  const { sorteoBorrador, setSorteoBorrador } = useLienzoHojasRuta();
  const { abrir } = useAbrirAjustes();
  const cambiar = (b: BorradorSorteo) => setSorteoBorrador({ ...sorteoBorrador, ...b });
  return (
    <div className="hr-ajustes-grupo-cuerpo">
      {sorteoBorrador ? (
        <div className="hr-ajustes-pendiente">
          <span>Estos cambios se aplican al sortear.</span>
          <PulsoButton variant="secondary" size="sm" onClick={onIrASortear}>Ir a sortear</PulsoButton>
        </div>
      ) : null}
      <section className="hr-ajustes-bloque" aria-label="Método">
        <h4>Método</h4>
        <GlidingRadioGroup value={config.sampling_method} options={METODOS} getOptionValue={(m) => m.id} onValueChange={(sampling_method) => cambiar({ sampling_method })} className="hr-sorteo-metodos" aria-label="Método de selección" getOptionProps={() => ({ disabled: ed })}>
          {(m) => (
            <>
              <Diagrama metodo={m.id} />
              <strong>{m.titulo}</strong>
              <small>{m.cuerpo}</small>
            </>
          )}
        </GlidingRadioGroup>
      </section>
      <section className="hr-ajustes-bloque" aria-label="Carga de la ruta">
        <h4>Carga de la ruta</h4>
        <Opciones etiqueta="Ponderar manzanas por" valor={config.measure_var} opciones={PESOS} onCambio={(measure_var) => cambiar({ measure_var })} deshabilitado={ed} />
        <div className="hr-sorteo-ruta">
          <span>
            <b>{config.entrevistas_por_manzana} encuestas por ruta</b>
            <small>Se define en Tamaño y precisión</small>
          </span>
          <PulsoButton variant="secondary" size="sm" onClick={() => abrir("tamano")}>Cambiar</PulsoButton>
        </div>
        <div className="hr-muestra-campo">
          <small>Semilla</small>
          <span className="hr-sorteo-semilla">
            <input type="number" min={0} step={1} aria-label="Semilla" value={config.seed} disabled={ed} onChange={(e) => e.target.value !== "" && Number.isFinite(Number(e.target.value)) && cambiar({ seed: Math.max(0, Math.round(Number(e.target.value))) })} />
            <PulsoButton variant="secondary" size="sm" disabled={ed} onClick={() => cambiar({ seed: otraSemilla(config.seed) })}>Otra</PulsoButton>
          </span>
          <span className="hr-mapa-nota">La misma semilla con los mismos parámetros repite el sorteo.</span>
        </div>
        {listoParaSortear ? <CompararSemillas config={config} deshabilitado={ed} onUsar={(seed) => cambiar({ seed })} /> : null}
      </section>
    </div>
  );
}
