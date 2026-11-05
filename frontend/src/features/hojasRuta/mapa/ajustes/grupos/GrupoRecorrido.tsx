import type { HojasRutaIntegratedConfig } from "../../../../../api/hojasRuta";
import { PulsoButton } from "../../../../../components/PulsoButton";
import { formatoDecimal } from "../../../../../lib/formatoNumero";
import { ESQUINAS, Opciones, POLITICAS, SALTOS } from "../../manzanas/ManzanasPaneles";
import { acotarReemplazos, saltoVistaPrevia, type BorradorSorteo } from "../../manzanas/sorteo";
import { useLienzoHojasRuta } from "../../store";

type Props = { config: HojasRutaIntegratedConfig; viviendas: number; manzanas: number; deshabilitado: boolean; onIrASortear: () => void };

/**
 * Grupo 7 de «Ajustes del diseño», Recorrido y reemplazos (M6): esquina inicial, salto entre viviendas y
 * reemplazos por titular, mudados del inspector de Manzanas. Escriben el borrador del sorteo y se aplican al
 * sortear. El salto automático se muestra en contenedor formal, no como texto con «=».
 */
export function GrupoRecorrido({ config, viviendas, manzanas, deshabilitado: ed, onIrASortear }: Props) {
  const { sorteoBorrador, setSorteoBorrador } = useLienzoHojasRuta();
  const cambiar = (b: BorradorSorteo) => setSorteoBorrador({ ...sorteoBorrador, ...b });
  const ruta = Math.max(1, config.entrevistas_por_manzana || 1);
  const reemplazos = acotarReemplazos(config.replacements_per_titular);
  const salto = saltoVistaPrevia(viviendas, manzanas, ruta);
  return (
    <div className="hr-ajustes-grupo-cuerpo">
      {sorteoBorrador ? (
        <div className="hr-ajustes-pendiente">
          <span>Estos cambios se aplican al sortear.</span>
          <PulsoButton variant="secondary" size="sm" onClick={onIrASortear}>Ir a sortear</PulsoButton>
        </div>
      ) : null}
      <section className="hr-ajustes-bloque" aria-label="Recorrido en campo">
        <h4>Recorrido en campo</h4>
        <Opciones etiqueta="Esquina inicial" valor={config.route_start_corner} opciones={ESQUINAS} onCambio={(route_start_corner) => cambiar({ route_start_corner })} deshabilitado={ed} />
        <Opciones etiqueta="Salto entre viviendas" valor={config.route_jump_mode} opciones={SALTOS} onCambio={(route_jump_mode) => cambiar({ route_jump_mode })} deshabilitado={ed} />
        {config.route_jump_mode === "manual" ? (
          <label className="hr-muestra-campo">
            <small>Salto manual</small>
            <span className="hr-muestra-numero">
              <input type="number" min={1} step={1} value={config.route_jump_manual} disabled={ed} onChange={(e) => e.target.value !== "" && cambiar({ route_jump_manual: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
              <span>viviendas</span>
            </span>
          </label>
        ) : null}
        {config.route_jump_mode === "off" ? (
          <p className="hr-mapa-nota">Se visita cada vivienda desde la esquina.</p>
        ) : config.route_jump_mode === "manual" ? (
          <p className="hr-mapa-nota">Una de cada {config.route_jump_manual} viviendas en todas las manzanas.</p>
        ) : (
          <dl className="hr-ajustes-formula" aria-label="Salto automático">
            <div><dt>Viviendas por manzana</dt><dd>{manzanas ? formatoDecimal(viviendas / manzanas, 1) : "—"}</dd></div>
            <div><dt>Encuestas por ruta</dt><dd>{ruta}</dd></div>
            <div><dt>Salto K</dt><dd>{salto ? <>{formatoDecimal(salto.k, 1)} <small>una de cada {salto.operativo} en el PDF</small></> : <small>por manzana</small>}</dd></div>
          </dl>
        )}
      </section>
      <section className="hr-ajustes-bloque" aria-label="Reemplazos">
        <h4>Reemplazos</h4>
        <div className="hr-muestra-campo">
          <small>Por cada titular</small>
          <span className="hr-muestra-pasos">
            <PulsoButton variant="icon" size="sm" aria-label="Un reemplazo menos" disabled={ed || reemplazos <= 0} onClick={() => cambiar({ replacements_per_titular: acotarReemplazos(reemplazos - 1) })}>−</PulsoButton>
            <input type="number" min={0} max={10} aria-label="Reemplazos por titular" value={reemplazos} disabled={ed} onChange={(e) => cambiar({ replacements_per_titular: acotarReemplazos(Number(e.target.value)) })} />
            <PulsoButton variant="icon" size="sm" aria-label="Un reemplazo más" disabled={ed || reemplazos >= 10} onClick={() => cambiar({ replacements_per_titular: acotarReemplazos(reemplazos + 1) })}>+</PulsoButton>
          </span>
          <span className="hr-mapa-nota">{reemplazos === 0 ? "Sin reemplazos: si una manzana falla, no hay respaldo sorteado." : "De 0 a 10."}</span>
        </div>
        <Opciones etiqueta="Dónde buscar el reemplazo" valor={config.replacement_policy} opciones={POLITICAS} onCambio={(replacement_policy) => cambiar({ replacement_policy })} deshabilitado={ed || reemplazos === 0} />
      </section>
    </div>
  );
}
