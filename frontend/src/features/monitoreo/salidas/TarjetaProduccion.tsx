// La tarjeta del PDF de producción de Salidas (ADR 0133, fase 5): el título de
// la portada, el disparador y el contenedor del kit en bloque, que sigue el job
// con su avance real y «Cancelar». El título sólo cambia la portada, no el
// nombre del archivo (lo pone el motor).

import { useState } from "react";

import { AlertTriangle, UsersRound } from "../../../vendor/lucide-react";
import { EntregaEnBloque } from "../entregas/EntregaEnBloque";
import type { EntregaMonitoreo } from "../entregas/useEntrega";

export type TextosDeProduccion = { eyebrow: string; title: string; detail: string; button: string };

export function TarjetaProduccion({ textos, tituloSugerido, entrega, hayCorte, habilitado, generar }: {
  textos: TextosDeProduccion;
  /** El título con que arranca el campo; quien monta la tarjeta la remonta (`key`) si cambia. */
  tituloSugerido: string;
  entrega: EntregaMonitoreo;
  hayCorte: boolean;
  habilitado: boolean;
  generar: (titulo: string) => Promise<unknown>;
}) {
  const [titulo, setTitulo] = useState(tituloSugerido);
  return (
    <article className="mon-outputs-card mon-outputs-card--production">
      <div className="mon-outputs-card__head">
        <span><UsersRound size={14} aria-hidden="true" /> {textos.eyebrow}</span>
        <strong>{textos.title}</strong>
        <small>{textos.detail}</small>
      </div>
      <div className="mon-outputs-production-tags" aria-label="Contenido del reporte de producción">
        <span>Orden por apellido</span>
        <span>Detalle por responsable</span>
      </div>
      <label className="mon-outputs-field mon-outputs-production-title" title="Va en la portada y en el encabezado del reporte">
        <span>Título del PDF</span>
        <input
          type="text"
          value={titulo}
          maxLength={140}
          placeholder={tituloSugerido}
          disabled={entrega.enCurso}
          onChange={(event) => setTitulo(event.target.value)}
        />
      </label>
      {!hayCorte ? (
        <div className="mon-outputs-alert is-error"><AlertTriangle size={14} aria-hidden="true" /> Sincroniza un corte antes de generar producción.</div>
      ) : null}
      <button
        type="button"
        className="mon-outputs-primary"
        onClick={() => { void entrega.ejecutar(() => generar(titulo.trim() || tituloSugerido)); }}
        disabled={!habilitado || entrega.enCurso}
      >
        <UsersRound size={14} aria-hidden="true" />
        {textos.button}
      </button>
      <EntregaEnBloque entrega={entrega} />
    </article>
  );
}
