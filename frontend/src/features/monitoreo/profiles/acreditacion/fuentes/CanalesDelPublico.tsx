import { useState } from "react";
import { Mail, Plus, X } from "lucide-react";

import { EstadoVacio } from "../../../../../components/EstadoVacio";

import { PulsoSelect } from "../../../../../components/PulsoSelect";
import {
  ROTULO_DEL_CANAL,
  TIPOS_DE_CANAL,
  quitarRonda,
  sumarRonda,
  type Canal,
  type TipoDeCanal,
} from "./canalesDelPublicoModelo";
import "./canalesDelPublico.css";

const OPCIONES = TIPOS_DE_CANAL.map((t) => ({ value: t, label: ROTULO_DEL_CANAL[t] }));

/**
 * Los canales de un público, por ronda (ADR 0125 §5). Es una lista que crece:
 * se suma la ronda siguiente cuando se decide abrirla, sin tocar las anteriores.
 * Material abre una campaña por cada canal declarado.
 */
export function CanalesDelPublico({ publico, canales, onCambio, deshabilitado = false }: {
  publico: string;
  canales: Canal[];
  onCambio: (canales: Canal[]) => void;
  deshabilitado?: boolean;
}) {
  const [nuevo, setNuevo] = useState<TipoDeCanal>("correo");
  return (
    <div className="mon-acr-canales" role="group" aria-label={`Canales de ${publico || "este público"}, por ronda`}>
      {canales.length ? (
        <ol className="mon-acr-canales-rondas">
          {canales.map((c) => (
            <li key={c.ronda} className="mon-acr-canales-ronda">
              <span className="mon-acr-canales-numero">Ronda {c.ronda}</span>
              <span>{ROTULO_DEL_CANAL[c.canal]}</span>
              <button
                type="button"
                className="mon-acr-canales-quitar"
                onClick={() => onCambio(quitarRonda(canales, c.ronda))}
                disabled={deshabilitado}
                aria-label={`Quitar la ronda ${c.ronda} (${ROTULO_DEL_CANAL[c.canal]})`}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <EstadoVacio icono={<Mail size={16} />} titulo="Sin canales declarados" descripcion="Material abre sólo correo." />
      )}
      <div className="mon-acr-canales-sumar">
        <PulsoSelect
          value={nuevo}
          onValueChange={(v) => setNuevo(v as TipoDeCanal)}
          options={OPCIONES}
          size="sm"
          disabled={deshabilitado}
          ariaLabel={`Canal de la próxima ronda de ${publico || "este público"}`}
        />
        <button
          type="button"
          className="pulso-button pulso-button--secondary pulso-button--sm"
          onClick={() => onCambio(sumarRonda(canales, nuevo))}
          disabled={deshabilitado}
        >
          <Plus size={13} aria-hidden="true" /> Sumar ronda
        </button>
      </div>
    </div>
  );
}
