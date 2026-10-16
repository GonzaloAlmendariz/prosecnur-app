// Barra de «asignar en masa» del mapa de una base (F2). Los códigos se marcan
// en la tabla; aquí se elige la categoría y se aplica a todos a la vez.
//
// La lógica vive en `armonizacionMasaModel`; aquí sólo hay render y eventos.

import { useState } from "react";
import type { CategoriaEscalaComun } from "../../api/equivalencias";
import { PulsoButton } from "../../components/PulsoButton";
import { DESTINO_SIN_MAPA, textoMarcados } from "./armonizacionMasaModel";

export type ArmonizacionAsignarEnMasaProps = {
  base: string;
  escala: readonly CategoriaEscalaComun[];
  nMarcados: number;
  nSinMapa: number;
  onAsignar: (eleccion: string) => void;
  onMarcarSinMapa: () => void;
  onLimpiar: () => void;
  /** Destinos además de la escala y «Sin mapa» (los segmentos de cruce ofrecen «Sin dato»). */
  opcionesExtra?: readonly { valor: string; rotulo: string }[];
};

export function ArmonizacionAsignarEnMasa({
  base,
  escala,
  nMarcados,
  nSinMapa,
  onAsignar,
  onMarcarSinMapa,
  onLimpiar,
  opcionesExtra = [],
}: ArmonizacionAsignarEnMasaProps) {
  const [eleccion, setEleccion] = useState("");
  const idSelector = `pulso-armon-masa-${base.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  return (
    // C1: miembro de la sección de la base; la barra mantiene su marco con 0
    // o con todos los códigos marcados (C2), sólo cambian los habilitados.
    <div className="pulso-armon-masa" role="group" aria-label={`Asignar varios códigos de ${base}`}>
      <span className="pulso-armon-masa-cuenta" aria-live="polite">{textoMarcados(nMarcados)}</span>
      <span aria-hidden="true" className="pulso-armon-masa-flecha">→</span>
      <label className="pulso-armon-masa-destino" htmlFor={idSelector}>
        <span className="pulso-sr-only">Categoría para los códigos marcados de {base}</span>
        <select id={idSelector} value={eleccion} onChange={(e) => setEleccion(e.target.value)}>
          <option value="">Elige una categoría</option>
          {escala.filter((c) => c.codigo).map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.codigo} {c.etiqueta}
            </option>
          ))}
          {opcionesExtra.map((o) => (
            <option key={o.valor} value={o.valor}>{o.rotulo}</option>
          ))}
          <option value={DESTINO_SIN_MAPA}>Sin mapa</option>
        </select>
      </label>
      <PulsoButton
        variant="secondary"
        size="sm"
        className="pulso-armon-btn"
        disabled={nMarcados === 0 || !eleccion}
        onClick={() => onAsignar(eleccion)}
      >
        Asignar
      </PulsoButton>
      <span className="pulso-armon-masa-sep" aria-hidden="true" />
      <PulsoButton
        variant="ghost"
        size="sm"
        className="pulso-armon-btn"
        disabled={nSinMapa === 0}
        onClick={onMarcarSinMapa}
      >
        Marcar todos los sin mapa
      </PulsoButton>
      <PulsoButton
        variant="ghost"
        size="sm"
        className="pulso-armon-btn"
        disabled={nMarcados === 0}
        onClick={onLimpiar}
      >
        Limpiar
      </PulsoButton>
    </div>
  );
}
