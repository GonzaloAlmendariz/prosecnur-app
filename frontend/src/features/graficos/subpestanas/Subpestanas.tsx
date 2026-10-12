// Subpestañas de Identidad y Estilo del informe (I9): un tema a la vez en vez de secciones apiladas. La subpestaña vive
// en el nivel `foco` de la dirección canónica (enlazable, sobrevive al recargar); una desconocida abre la primera.

import { GlidingTabList } from "../../../components/GlidingTabList";
import { useLocation, useNavigate } from "react-router-dom";
import { conNivel } from "../../../lib/navegacion/direccion";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import "./subpestanas.css";

export type Subpestana<K extends string> = { key: K; label: string };

export function useSubpestana<K extends string>(opciones: readonly Subpestana<K>[]): [K, (k: K) => void] {
  const { foco } = useSeccion("procesamiento");
  const location = useLocation();
  const navigate = useNavigate();
  const actual = (opciones.find((o) => o.key === foco)?.key ?? opciones[0].key) as K;
  return [actual, (k: K) => navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", k) }, { replace: true })];
}

export function Subpestanas<K extends string>({ opciones, actual, onCambiar, etiqueta }: {
  opciones: readonly Subpestana<K>[];
  actual: K;
  onCambiar: (k: K) => void;
  etiqueta: string;
}) {
  return (
    <GlidingTabList activeKey={actual} className="pulso-f6-subpestanas" role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.key} type="button" role="tab" data-gliding-key={o.key} aria-selected={actual === o.key}
          tabIndex={actual === o.key ? 0 : -1}
          className={`pulso-f6-subpestana${actual === o.key ? " is-activa" : ""}`} onClick={() => onCambiar(o.key)}>
          {o.label}
        </button>
      ))}
    </GlidingTabList>
  );
}
