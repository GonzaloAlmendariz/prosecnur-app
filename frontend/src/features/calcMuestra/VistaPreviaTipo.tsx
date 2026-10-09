import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Eye } from "lucide-react";

import { cambiarReinicia, seccionesDelTipo } from "./modeloVistaPreviaTipo";
import type { ActiveDesk } from "./sharedCore";
import "./vistaPreviaTipo.css";

/**
 * Mirar otro tipo de estudio sin perder el actual. Dos pasos a propósito:
 * mirar es gratis; cambiar se confirma aparte, diciendo qué se pierde.
 */
export function VistaPreviaTipo({
  destino,
  destinoTitulo,
  destinoCopy,
  actualTitulo,
  perdidas,
  onVolver,
  onConfirmar,
  confirmandoInicial = false,
}: {
  destino: ActiveDesk;
  destinoTitulo: string;
  destinoCopy: string;
  actualTitulo: string;
  perdidas: readonly string[];
  onVolver: () => void;
  onConfirmar: () => void;
  /** Sólo para pruebas sin DOM: abrir directamente en el paso que borra. */
  confirmandoInicial?: boolean;
}) {
  const [confirmando, setConfirmando] = useState(confirmandoInicial);
  const raizRef = useRef<HTMLElement>(null);
  const secciones = seccionesDelTipo(destino);
  const reinicia = cambiarReinicia(destino);

  // Cambiar de tarjeta vuelve al paso de mirar: la confirmación era de otro tipo.
  useEffect(() => {
    setConfirmando(false);
    raizRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [destino]);

  return (
    <section
      ref={raizRef}
      className="cmv2-vista-previa"
      aria-labelledby="cmv2-vista-previa-titulo"
      data-audit-ready="true"
    >
      <header className="cmv2-vista-previa-head">
        <span className="cmv2-vista-previa-icon" aria-hidden="true"><Eye size={16} /></span>
        <div>
          <small>Vista previa. Tu estudio de {actualTitulo} sigue intacto</small>
          <h3 id="cmv2-vista-previa-titulo">{destinoTitulo}</h3>
          <p>{destinoCopy}</p>
        </div>
      </header>

      {secciones.length > 0 && (
        <ol className="cmv2-vista-previa-secciones" aria-label={`Secciones de ${destinoTitulo}`}>
          {secciones.map((seccion, i) => (
            <li key={seccion.id}>
              <strong><span aria-hidden="true">{i + 1}</span> {seccion.label}</strong>
              {seccion.pasos.length > 0 && (
                <ul aria-label={`Pestañas de ${seccion.label}`}>
                  {seccion.pasos.map((paso) => (
                    <li key={paso.id} title={paso.detalle ?? undefined}>{paso.label}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}

      {confirmando ? (
        <div className="cmv2-vista-previa-confirmar" role="alertdialog" aria-labelledby="cmv2-vista-previa-aviso" aria-describedby="cmv2-vista-previa-perdidas">
          <span className="cmv2-vista-previa-alerta" aria-hidden="true"><AlertTriangle size={16} /></span>
          <div>
            <strong id="cmv2-vista-previa-aviso">El cambio es definitivo: no se puede deshacer</strong>
            <p>Al cambiar a {destinoTitulo} se borra el estudio de {actualTitulo}{perdidas.length > 0 ? ":" : "."}</p>
            {perdidas.length > 0 && (
              <ul id="cmv2-vista-previa-perdidas">
                {perdidas.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
            <p className="cmv2-vista-previa-guardado">Si quieres conservarlo, primero guarda una copia del proyecto con «Guardar como…».</p>
          </div>
          <div className="cmv2-vista-previa-acciones">
            <button type="button" className="cmv2-ghost" onClick={() => setConfirmando(false)}>No, seguir mirando</button>
            <button type="button" className="cmv2-primary cmv2-vista-previa-borrar" onClick={onConfirmar}>
              Borrar y empezar con {destinoTitulo}
            </button>
          </div>
        </div>
      ) : (
        <div className="cmv2-vista-previa-acciones">
          <button type="button" className="cmv2-ghost" onClick={onVolver}>
            <ArrowLeft size={14} aria-hidden="true" /> Volver a {actualTitulo}
          </button>
          <button
            type="button"
            className="cmv2-primary"
            onClick={() => (reinicia ? setConfirmando(true) : onConfirmar())}
          >
            {reinicia ? `Cambiar a ${destinoTitulo}…` : "Ir a Hojas de ruta"}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
