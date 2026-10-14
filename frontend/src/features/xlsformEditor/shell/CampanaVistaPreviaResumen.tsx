// Lectura de la vista previa de una campaña complementaria (ADR 0101).
//
// Decide «¿esta encuesta es una campaña de mi instrumento?» y lo dice primero:
// veredicto con su color semántico + medidor de cobertura con el umbral del
// 80 % marcado. Las diferencias se resumen en tres contadores pares y su
// detalle se pliega, agrupado por sección, en filas de una línea.
//
// Geometría (Contrato de Superficie):
// - C1: `xlsform-campana-veredicto` (intrinsic: estado + medidor) y
//   `xlsform-campana-contadores` (equal: los tres contadores).
// - C2: los tres contadores existen siempre, también en cero («ninguna»).
// - C4: el detalle no tiene scroll propio; lo desplaza el dueño del contenedor.

import { useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FilePlus2,
  XCircle,
} from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import type { CampanaVistaPrevia } from "../../../api/xlsformCampanas";
import {
  leerVistaPrevia,
  UMBRAL_CAMPANA,
  type ContadorDiferencia,
  type IdDiferencia,
} from "./campanaComplementariaModel";
import "../styles/xf-campana.css";

export type CampanaVistaPreviaResumenProps = {
  vista: CampanaVistaPrevia;
  /** `false` cuando la encuesta ya se nombra encima (selector plegado). */
  mostrarEncuesta?: boolean;
  /**
   * Salida directa del bloqueo: cerrar y abrir la importación. Sin ella la
   * indicación queda como texto.
   */
  onImportarComoFormulario?: () => void;
  /**
   * Por qué la salida no está disponible ahora (p. ej. el proyecto llegó al
   * tope de formularios). La acción se muestra deshabilitada con la razón
   * visible, en vez de desaparecer.
   */
  importarBloqueadoPor?: string | null;
  /** Lleva el foco al veredicto al aparecer (el analista acaba de comparar). */
  enfocarVeredicto?: boolean;
};

const ICONO_VEREDICTO = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
} as const;

function accionContador(contador: ContadorDiferencia, abierto: boolean): string {
  if (abierto) return "Ocultar";
  return contador.n === 1 ? "Ver cuál" : `Ver las ${contador.n}`;
}

export function CampanaVistaPreviaResumen({
  vista,
  mostrarEncuesta = true,
  onImportarComoFormulario,
  importarBloqueadoPor = null,
  enfocarVeredicto = false,
}: CampanaVistaPreviaResumenProps) {
  const lectura = leerVistaPrevia(vista);
  const baseId = useId();
  const veredictoRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (enfocarVeredicto) veredictoRef.current?.focus();
    // Sólo al montar: cada comparación remonta el resumen (`key`).
  }, []);
  const [abiertos, setAbiertos] = useState<ReadonlySet<IdDiferencia>>(
    () => new Set(lectura.contadores.filter((c) => c.abiertoPorDefecto).map((c) => c.id)),
  );
  const Icono = ICONO_VEREDICTO[lectura.tono];
  const umbral = `${Math.round(UMBRAL_CAMPANA * 100)} %`;
  const relleno = Math.max(0, Math.min(100, lectura.porcentaje ?? 0));

  function alternar(id: IdDiferencia) {
    setAbiertos((previos) => {
      const siguientes = new Set(previos);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  }

  const detalleId = (id: IdDiferencia) => `${baseId}-detalle-${id}`;

  return (
    <div className="pulso-xf-campana-vista">
      <div
        className={`pulso-xf-campana-veredicto is-${lectura.tono}`}
        data-qa-geometry-group="xlsform-campana-veredicto"
        data-qa-geometry-contract="intrinsic"
      >
        <h4
          ref={veredictoRef}
          tabIndex={-1}
          className="pulso-xf-campana-veredicto-estado"
          data-qa-geometry-member
        >
          <Icono size={18} aria-hidden="true" />
          <strong>{lectura.titular}</strong>
        </h4>
        <div className="pulso-xf-campana-medidor" data-qa-geometry-member>
          <div className="pulso-xf-campana-medidor-cifras">
            <span className="pulso-xf-campana-medidor-calce">
              {lectura.calce}
              <span className="pulso-xf-campana-medidor-minimo">
                <span className="pulso-xf-campana-medidor-marca" aria-hidden="true" /> mínimo {umbral}
              </span>
            </span>
            {lectura.cobertura ? (
              <span className="pulso-xf-campana-medidor-porcentaje">{lectura.cobertura}</span>
            ) : null}
          </div>
          <div
            className="pulso-xf-campana-medidor-pista"
            role="meter"
            aria-label="Campos del instrumento que calzan"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={relleno}
            aria-valuetext={`${lectura.cobertura || `${relleno} %`}; el mínimo para ser campaña es ${umbral}`}
          >
            <span className="pulso-xf-campana-medidor-relleno" style={{ inlineSize: `${relleno}%` }} />
            <span
              className="pulso-xf-campana-medidor-umbral"
              style={{ insetInlineStart: `${UMBRAL_CAMPANA * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
        {mostrarEncuesta ? (
          <p className="pulso-xf-campana-encuesta-elegida">
            {vista.titulo || "Encuesta sin título"} · ID {vista.survey_id}
          </p>
        ) : null}
      </div>

      {lectura.bloqueo ? (
        <div className="pulso-xf-campana-indicacion" role="alert">
          <p>{lectura.bloqueo}</p>
          {onImportarComoFormulario ? (
            <span className="pulso-xf-campana-indicacion-accion">
              <PulsoButton
                variant="secondary"
                size="sm"
                onClick={onImportarComoFormulario}
                disabled={Boolean(importarBloqueadoPor)}
                aria-describedby={importarBloqueadoPor ? `${baseId}-importar-razon` : undefined}
              >
                <FilePlus2 size={14} aria-hidden="true" /> Importar como formulario propio
              </PulsoButton>
              {importarBloqueadoPor ? (
                <small id={`${baseId}-importar-razon`}>{importarBloqueadoPor}</small>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className="pulso-xf-campana-contadores"
        role="group"
        aria-label="Diferencias con el instrumento"
        data-qa-geometry-group="xlsform-campana-contadores"
        data-qa-geometry-contract="equal"
      >
        {lectura.contadores.map((contador) => {
          if (contador.n === 0) {
            return (
              <div key={contador.id} className="pulso-xf-campana-contador is-vacio" data-qa-geometry-member>
                <span className="pulso-xf-campana-contador-rotulo">{contador.titulo}</span>
                <span className="pulso-xf-campana-contador-valor">ninguna</span>
              </div>
            );
          }
          const abierto = abiertos.has(contador.id);
          return (
            <button
              key={contador.id}
              type="button"
              className={`pulso-xf-campana-contador is-${contador.id}`}
              aria-expanded={abierto}
              aria-controls={abierto ? detalleId(contador.id) : undefined}
              onClick={() => alternar(contador.id)}
              data-qa-geometry-member
            >
              <span className="pulso-xf-campana-contador-rotulo">{contador.titulo}</span>
              <span className="pulso-xf-campana-contador-valor">{contador.n}</span>
              <span className="pulso-xf-campana-contador-accion">
                {accionContador(contador, abierto)}
                <ChevronDown size={13} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>

      {lectura.contadores.filter((c) => c.n > 0 && abiertos.has(c.id)).map((contador) => (
        <section
          key={contador.id}
          id={detalleId(contador.id)}
          className={`pulso-xf-campana-detalle is-${contador.id}`}
          aria-label={`${contador.titulo}: ${contador.n} ${contador.n === 1 ? "campo" : "campos"}`}
        >
          <p className="pulso-xf-campana-detalle-ayuda">
            <strong>{contador.titulo}.</strong> {contador.ayuda}
          </p>
          {contador.secciones.map((seccion) => (
            <div key={seccion.clave} className="pulso-xf-campana-detalle-seccion">
              {seccion.titulo ? (
                <h4 className="pulso-xf-campana-detalle-titulo">
                  {seccion.titulo}
                  <span>{seccion.preguntas.length}</span>
                </h4>
              ) : null}
              <ul>
                {seccion.preguntas.map((pregunta, index) => (
                  <li key={`${pregunta.variable}-${index}`} title={pregunta.etiqueta || undefined}>
                    {pregunta.variable ? (
                      <code className="pulso-xf-campana-codigo">{pregunta.variable}</code>
                    ) : null}
                    <span className="pulso-xf-campana-enunciado">
                      {pregunta.etiqueta || "Sin enunciado"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
