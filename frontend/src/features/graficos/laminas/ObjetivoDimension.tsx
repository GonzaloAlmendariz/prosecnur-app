// «Objetivo» de los gráficos de dimensiones (heatmap, radar, radar + barras): antes un campo de texto que pedía la
// clave o la etiqueta del índice del catálogo de dimensiones del proyecto (pasada final de la tarjeta, 2026-10-15: «no
// le pidas al analista escribir cosas que podrían ser botones»). Ahora la lista de índices generales o de indicadores,
// según el modo, del mismo catálogo que lee el motor (/api/dashboard/dimensiones/catalogo, ids `idx_*` o de bloque).
// Sin catálogo (dimensiones aún no armadas) queda el texto, con el aviso de dónde armarlas.

import { useEffect, useState, type ReactNode } from "react";
import { apiDashboardDimCatalogo, type DashboardDimCatalogo } from "../../../api/dashboard";

let cache: DashboardDimCatalogo | null = null;

type Props = { id: string; etiqueta: ReactNode; modo: unknown; valor: unknown; onCambio: (v: string) => void };

export function ObjetivoDimension({ id, etiqueta, modo, valor, onCambio }: Props) {
  const [catalogo, setCatalogo] = useState<DashboardDimCatalogo | null>(cache);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (cache) return;
    let vivo = true;
    apiDashboardDimCatalogo()
      .then((r) => { if (!vivo) return; cache = r.payload; setCatalogo(r.payload); })
      .catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, []);
  const actual = typeof valor === "string" ? valor : "";
  const lista = !catalogo?.ready ? [] : modo === "indicadores" ? catalogo.indicadores : catalogo.general;

  if (!lista.length) {
    return (
      <div className="pulso-f6-dato is-apilado">
        {etiqueta}
        {!catalogo && !error
          ? <span className="pulso-f6-dato-ayuda" role="status">Leyendo los índices del proyecto</span>
          : <>
              <input id={id} className="pulso-f6-input" value={actual} placeholder="Clave del índice" onChange={(e) => onCambio(e.target.value)} />
              <span className="pulso-f6-dato-ayuda">Cuando armes las dimensiones en Analítica, sus índices se eligen de una lista.</span>
            </>}
      </div>
    );
  }
  const conocido = lista.some((o) => o.id === actual);
  return (
    <div className="pulso-f6-dato is-apilado">
      {etiqueta}
      <select id={id} className="pulso-f6-input" value={actual} onChange={(e) => onCambio(e.target.value)}>
        {!actual && <option value="">Elige un índice</option>}
        {actual && !conocido && <option value={actual}>{actual} (no está en el catálogo)</option>}
        {lista.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}
