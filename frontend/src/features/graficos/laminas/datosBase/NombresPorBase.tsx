// Fila «Nombre de cada público» de la tarjeta de datos (C44): una caja por base del estudio, con el nombre técnico como
// rótulo y como placeholder. Mismo valor y formato que el Editor anterior (BaseLabelsField); el vacío lo contiene la fila.

import { useId, useMemo } from "react";
import { useVariables } from "../../useVariables";
import { parseBaseLabels, patchNombreDeBase } from "./nombresPorBase";
import "./datosBase.css";

type Props = {
  argName: string;
  rotulo: string;
  ayuda: string | null;
  valor: unknown;
  onCambio: (patch: Record<string, string>) => void;
};

export function NombresPorBase({ argName, rotulo, ayuda, valor, onCambio }: Props) {
  const id = useId();
  const { sources, loading } = useVariables();
  const bases = useMemo(() => sources.map((s) => s.name).filter(Boolean), [sources]);
  const mapa = useMemo(() => parseBaseLabels(valor), [valor]);

  return (
    <div role="group" aria-labelledby={id} className="pulso-f6-dato is-apilado pulso-f6-nombres-base" data-qa-geometry-group="graficos/f6-nombres-base" data-qa-geometry-contract="intrinsic">
      <span id={id} className="pulso-f6-dato-rotulo">{rotulo}</span>
      {loading ? (
        <span className="pulso-f6-dato-ayuda" role="status">Leyendo las bases del estudio…</span>
      ) : bases.length < 2 ? (
        <span className="pulso-f6-dato-ayuda">Este estudio no tiene bases separadas: la tabla no tiene una columna por público.</span>
      ) : (
        <>
          {bases.map((clave) => (
            <label key={clave} className="pulso-f6-nombres-base-fila" data-qa-geometry-member="nombre-base">
              <span className="pulso-f6-nombres-base-clave" title={clave}>{clave}</span>
              <input
                className="pulso-f6-input"
                value={mapa[clave] ?? ""}
                placeholder={clave}
                aria-label={`Nombre del público ${clave}`}
                onChange={(e) => onCambio(patchNombreDeBase(argName, valor, bases, clave, e.target.value))}
              />
            </label>
          ))}
          {ayuda && <span className="pulso-f6-dato-ayuda">{ayuda}</span>}
        </>
      )}
    </div>
  );
}
