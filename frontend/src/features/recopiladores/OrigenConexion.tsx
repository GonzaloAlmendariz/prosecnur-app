import { Link } from "react-router-dom";

import type { CollectionOrigen } from "../../api/recopiladores";
import { PulsoButton } from "../../components/PulsoButton";
import { ArrowRight } from "../../vendor/lucide-react";
import {
  accionActualizar,
  delOtroLado,
  enlacesDeLaFuente,
  huellaCorta,
  huellaYVigencia,
  nombreDelModulo,
  queEntrega,
  SI_LA_FUENTE_CAMBIA,
  vigenciaDelOrigen,
} from "./origen";

type Props = {
  origen: CollectionOrigen;
  /** Abre `?panel=rehacer-plan`: el diálogo previsualiza antes de escribir. */
  onActualizar: () => void;
  dialogoAbierto: boolean;
};

const ID_MOTIVO = "rec-origen-motivo";

/**
 * El panel de la conexión: qué entrega la fuente, con qué huella, si sigue al
 * día y qué pasa si cambia. La acción vive aquí y sólo aquí (E1e).
 */
export function OrigenConexion({ origen, onActualizar, dialogoAbierto }: Props) {
  const vigencia = vigenciaDelOrigen(origen);
  const accion = accionActualizar(origen);
  const { seleccion } = enlacesDeLaFuente(origen);
  const { huella, cuando } = huellaYVigencia(origen);
  const huellaFuente = huellaCorta(origen.fingerprint_actual);
  const modulo = origen.fuente.modulo ? nombreDelModulo(origen.fuente.modulo) : "Sin fuente";

  return (
    <aside className="rec-origen-conexion" aria-labelledby="rec-origen-conexion-titulo">
      <header className="rec-origen-conexion-cabeza">
        <span className="xfk-over">Conexión</span>
        <h3 id="rec-origen-conexion-titulo">{modulo}</h3>
        {origen.plan.existe ? (
          <span className="rec-origen-suave">
            El plan tiene {origen.plan.unidades.toLocaleString("es-PE")}{" "}
            {origen.plan.unidades === 1 ? "unidad" : "unidades"}
          </span>
        ) : null}
      </header>
      <div
        className="rec-origen-conexion-cuerpo"
        data-qa-geometry-group="material-campo/unidades/origen-conexion"
        data-qa-geometry-contract="intrinsic"
      >
        <section className="rec-origen-bloque" aria-labelledby="rec-origen-entrega">
          <h4 id="rec-origen-entrega" className="rec-origen-k">Qué entrega</h4>
          <ul className="rec-origen-entrega">
            {queEntrega(origen).map((linea) => (
              <li key={linea}><ArrowRight size={14} aria-hidden /> <span>{linea}</span></li>
            ))}
          </ul>
        </section>
        {origen.plan.existe ? (
          <section className="rec-origen-bloque" aria-labelledby="rec-origen-huella">
            <h4 id="rec-origen-huella" className="rec-origen-k">Huella y vigencia</h4>
            <p className="rec-origen-huella-linea">
              {huella ? <span className="rec-origen-mono" title={origen.fingerprint_plan ?? undefined}>{huella}</span> : null}
              {huella && cuando ? " · " : null}
              {cuando}
              {origen.stale && huellaFuente && huellaFuente !== huella ? (
                <>
                  <br />
                  <span className="rec-origen-suave">
                    La fuente hoy: <span className="rec-origen-mono" title={origen.fingerprint_actual ?? undefined}>{huellaFuente}</span>
                  </span>
                </>
              ) : null}
            </p>
          </section>
        ) : null}
        <div className="rec-origen-vigencia" data-tono={vigencia.tono} role="status">
          <strong><span className="rec-origen-punto" aria-hidden /> {vigencia.titulo}</strong>
          {vigencia.frases.map((frase) => <span key={frase}>{frase}</span>)}
        </div>
        <section className="rec-origen-bloque" aria-labelledby="rec-origen-si-cambia">
          <h4 id="rec-origen-si-cambia" className="rec-origen-k">Si la fuente cambia</h4>
          <p>{SI_LA_FUENTE_CAMBIA}</p>
        </section>
        <section className="rec-origen-bloque" aria-labelledby="rec-origen-otro-lado">
          <h4 id="rec-origen-otro-lado" className="rec-origen-k">Y del otro lado</h4>
          <p>{delOtroLado(origen)}</p>
        </section>
      </div>
      {accion || seleccion ? (
        <footer className="rec-origen-conexion-pie">
          {accion?.motivo ? (
            <p id={ID_MOTIVO} className="rec-origen-motivo">
              {accion.motivo}
              {accion.resolver ? <> <Link to={accion.resolver.to}>{accion.resolver.label}</Link></> : null}
            </p>
          ) : null}
          <div className="rec-origen-acciones">
            {accion ? (
              <PulsoButton
                variant={accion.primaria ? "primary" : "secondary"}
                size="sm"
                disabled={accion.deshabilitada}
                aria-describedby={accion.motivo ? ID_MOTIVO : undefined}
                aria-haspopup="dialog"
                aria-expanded={dialogoAbierto}
                onClick={onActualizar}
              >
                {/* Sin ícono, como en el artboard: así cabe junto a «Abrir la selección»
                    en el panel de 340 px, en la misma fila. */}
                Actualizar desde la fuente
              </PulsoButton>
            ) : null}
            {seleccion ? (
              <Link className="pulso-button pulso-button--secondary pulso-button--sm rec-origen-boton" to={seleccion.to}>
                {seleccion.label}
              </Link>
            ) : null}
          </div>
        </footer>
      ) : null}
    </aside>
  );
}
