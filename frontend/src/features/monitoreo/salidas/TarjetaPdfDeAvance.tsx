// La tarjeta del PDF de avance de Salidas (ADR 0133, fase 5): la portada
// opcional, el disparador y el contenedor del kit en bloque, que sigue el job
// con su avance real y «Cancelar». El disparador sólo se deshabilita mientras
// se genera; la línea del contenedor es lo único que se mueve.

import { useState } from "react";

import type { MonitoreoPortadaPdf } from "../../../api/monitoreo";
import { formatoConteo } from "../../../lib/formatoNumero";
import { ChevronDown, Download } from "../../../vendor/lucide-react";
import { EntregaEnBloque } from "../entregas/EntregaEnBloque";
import type { EntregaMonitoreo } from "../entregas/useEntrega";

/**
 * **Los seis campos de la portada, declarados una vez.** El rótulo, el
 * placeholder —que dice lo que el motor pondrá si se deja en blanco— y el tope
 * de caracteres viven juntos, para que la tarjeta no tenga seis bloques casi
 * iguales que se desincronizan al primer retoque.
 */
const CAMPOS_DE_PORTADA: ReadonlyArray<{
  clave: keyof MonitoreoPortadaPdf;
  rotulo: string;
  ejemplo: string;
  tope: number;
  ancho?: "completo";
}> = [
  { clave: "titulo", rotulo: "Título", ejemplo: "Avance del trabajo de campo", tope: 140 },
  { clave: "subtitulo", rotulo: "Subtítulo", ejemplo: "El nombre del estudio", tope: 180 },
  { clave: "cliente", rotulo: "Preparado para", ejemplo: "Sin destinatario en la portada", tope: 140 },
  { clave: "periodo", rotulo: "Periodo de campo", ejemplo: "Del primer al último día con respuestas", tope: 90 },
  { clave: "corte", rotulo: "Datos al", ejemplo: "La fecha del corte sincronizado", tope: 90 },
  { clave: "nota", rotulo: "Nota al pie", ejemplo: "Sin nota", tope: 320, ancho: "completo" },
];

export type TextosDelPdf = { eyebrow: string; title: string; detail: string; button: string };

export function TarjetaPdfDeAvance({ textos, ofrecePortada, entrega, habilitado, motivo, generar }: {
  textos: TextosDelPdf;
  /** La portada existe en los renderizadores de aulas y telefónico; en otro perfil sería un control que no hace nada. */
  ofrecePortada: boolean;
  entrega: EntregaMonitoreo;
  /** El corte puede publicarse a cliente (gate de readiness). */
  habilitado: boolean;
  /** Por qué no se puede generar; va en el tooltip y para el lector de pantalla. */
  motivo?: string;
  generar: (portada: MonitoreoPortadaPdf | undefined) => Promise<unknown>;
}) {
  const [portada, setPortada] = useState<MonitoreoPortadaPdf>({});
  const [portadaAbierta, setPortadaAbierta] = useState(false);
  const portadaEscrita = Object.values(portada).filter((v) => (v ?? "").trim() !== "").length;

  return (
    <article className="mon-outputs-card mon-outputs-card--pdf">
      <div className="mon-outputs-card__head">
        <span>{textos.eyebrow}</span>
        <strong>{textos.title}</strong>
        <small>{textos.detail}</small>
      </div>
      {ofrecePortada ? (
        <div className="mon-outputs-portada">
          <button
            type="button"
            className="mon-outputs-portada__toggle"
            aria-expanded={portadaAbierta}
            onClick={() => setPortadaAbierta((v) => !v)}
          >
            <ChevronDown size={14} aria-hidden />
            <span>Portada del PDF</span>
            <small>
              {portadaEscrita
                ? `${formatoConteo(portadaEscrita)} de ${formatoConteo(CAMPOS_DE_PORTADA.length)} escritos`
                : "Se completa sola con los datos del corte"}
            </small>
          </button>
          {portadaAbierta ? (
            <div className="mon-outputs-portada__campos">
              {CAMPOS_DE_PORTADA.map((campo) => (
                <label key={campo.clave} className="mon-outputs-field" data-ancho={campo.ancho ?? "medio"}>
                  <span>{campo.rotulo}</span>
                  <input
                    type="text"
                    value={portada[campo.clave] ?? ""}
                    maxLength={campo.tope}
                    placeholder={campo.ejemplo}
                    disabled={entrega.enCurso}
                    onChange={(event) => setPortada((prev) => ({ ...prev, [campo.clave]: event.target.value }))}
                  />
                </label>
              ))}
              <small className="mon-outputs-portada__nota">
                Lo que dejes en blanco lo escribe el reporte con lo que ves en gris.
              </small>
            </div>
          ) : null}
        </div>
      ) : null}
      {/* El bloqueo se dice una sola vez, en el estado del corte de arriba.
          Aquí sólo queda el motivo en el tooltip del botón deshabilitado;
          el envoltorio lleva el `title` porque un botón deshabilitado no
          recibe el puntero en todos los motores. */}
      <span className="mon-outputs-action-motivo" title={motivo}>
        <button
          type="button"
          className="mon-outputs-primary"
          onClick={() => { void entrega.ejecutar(() => generar(ofrecePortada ? portada : undefined)); }}
          disabled={!habilitado || entrega.enCurso}
          aria-describedby={motivo ? "mon-outputs-pdf-motivo" : undefined}
        >
          <Download size={14} aria-hidden="true" />
          {textos.button}
        </button>
        {motivo ? <span id="mon-outputs-pdf-motivo" className="pulso-sr-only">{motivo}</span> : null}
      </span>
      <EntregaEnBloque entrega={entrega} />
    </article>
  );
}
