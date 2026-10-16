// Mapa de una variable numérica por rangos (una edad, un año, una fórmula).
// Reemplaza a la tabla valor por valor: la persona escribe «18 a 20 → 18 a 20
// años» y ve cuántos casos caen en cada rango. Los cambios se aplican al
// escribir. Debajo, sólo lo que queda fuera: un valor que ningún rango cubre y
// los códigos con etiqueta propia («88 Otro»), cada uno con su categoría. El
// detalle valor por valor queda plegado. La lógica vive en `mapaPorRangosModel`.

import { useId, useState, type ReactNode } from "react";
import { PulsoButton } from "../../components/PulsoButton";
import { Plus, Trash2 } from "../../vendor/lucide-react";
import { formatoConteo, formatoConteoDe } from "../../lib/formatoNumero";
import type { Tramo } from "./segmentos/segmentosModel";
import {
  asignacionDesdeTramos,
  avisoTramos,
  casosPorTramo,
  numericosSinRango,
  tramosDesdeMapa,
  valoresAparte,
  type CategoriaDestino,
  type ValorConCasos,
} from "./mapaPorRangosModel";
import "./MapaPorRangos.css";

export type MapaPorRangosProps = {
  base: string;
  origen: string;
  valores: readonly ValorConCasos[];
  escala: readonly CategoriaDestino[];
  mapa: Readonly<Record<string, string>>;
  /** Cambios de asignación: `codigo -> destino`; `null` lo deja sin mapa. */
  onAsignar: (cambios: Record<string, string | null>) => void;
  /** Destinos además de la escala para un valor aparte (los segmentos ofrecen «Sin dato»). */
  opcionesExtra?: readonly { valor: string; rotulo: string }[];
  /** El detalle valor por valor, plegado. */
  detalle?: ReactNode;
  nValores?: number;
};

export function MapaPorRangos({
  base,
  origen,
  valores,
  escala,
  mapa,
  onAsignar,
  opcionesExtra = [],
  detalle,
  nValores,
}: MapaPorRangosProps) {
  const id = useId();
  const [tramos, setTramos] = useState<Tramo[]>(() => tramosDesdeMapa(valores, mapa, escala));
  const aviso = avisoTramos(tramos);
  const casos = casosPorTramo(valores, tramos);
  const fuera = numericosSinRango(valores, tramos);
  const aparte = valoresAparte(valores);
  const categorias = escala.filter((c) => c.codigo);

  const aplicar = (siguientes: Tramo[]) => {
    setTramos(siguientes);
    const asignacion = asignacionDesdeTramos(valores, siguientes);
    const cambios: Record<string, string | null> = {};
    for (const [codigo, destino] of Object.entries(asignacion)) {
      if ((mapa[codigo] ?? null) !== destino) cambios[codigo] = destino;
    }
    if (Object.keys(cambios).length) onAsignar(cambios);
  };
  const cambiar = (clave: string, campo: "desde" | "hasta" | "destino", valor: string) =>
    aplicar(tramos.map((t) => (t.clave === clave ? { ...t, [campo]: valor } : t)));
  const nuevaClave = () => `t${tramos.reduce((m, t) => Math.max(m, Number(t.clave.slice(1)) || 0), 0) + 1}`;

  return (
    <div className="pulso-rangos" role="group" aria-labelledby={`${id}-titulo`}>
      <div className="pulso-rangos-head">
        <h5 id={`${id}-titulo`}>Rangos de {origen}</h5>
        <span className="pulso-armon-ayuda">Ambos extremos incluidos. «Hasta» vacío es «o más».</span>
      </div>

      <ol className="pulso-rangos-lista">
        {tramos.map((t, i) => (
          <li key={t.clave}>
            <input
              value={t.desde}
              inputMode="decimal"
              placeholder="Desde"
              aria-label={`Desde, rango ${i + 1}`}
              onChange={(e) => cambiar(t.clave, "desde", e.target.value)}
            />
            <span aria-hidden="true">a</span>
            <input
              value={t.hasta}
              inputMode="decimal"
              placeholder="o más"
              aria-label={`Hasta, rango ${i + 1}`}
              onChange={(e) => cambiar(t.clave, "hasta", e.target.value)}
            />
            <span aria-hidden="true" className="pulso-rangos-flecha">→</span>
            <select
              value={t.destino}
              aria-label={`Categoría del rango ${i + 1}`}
              onChange={(e) => cambiar(t.clave, "destino", e.target.value)}
            >
              <option value="">Elige una categoría</option>
              {categorias.map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta || c.codigo}</option>)}
            </select>
            <span className="pulso-rangos-casos">
              {casos[t.clave] === null || casos[t.clave] === undefined ? "" : formatoConteoDe(casos[t.clave] ?? 0, "caso", "casos")}
            </span>
            <button
              type="button"
              className="pulso-icon pulso-icon-danger"
              aria-label={`Quitar el rango ${i + 1}`}
              title="Quitar el rango"
              onClick={() => aplicar(tramos.filter((x) => x.clave !== t.clave))}
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <div className="pulso-rangos-pie">
        <PulsoButton
          variant="ghost"
          size="sm"
          className="pulso-armon-btn"
          onClick={() => setTramos([...tramos, { clave: nuevaClave(), desde: "", hasta: "", destino: "" }])}
        >
          <Plus size={13} aria-hidden="true" />
          Agregar rango
        </PulsoButton>
        {aviso && <span className="pulso-armon-error" role="alert">{aviso}</span>}
      </div>

      {fuera.length > 0 && (
        <p className="pulso-armon-aviso" role="status">
          Sin rango: {fuera.slice(0, 8).map((v) => v.codigo).join(", ")}{fuera.length > 8 ? "…" : ""}
          {" "}({formatoConteoDe(fuera.reduce((s, v) => s + (v.n ?? 0), 0), "caso", "casos")}). Amplía un rango para incluirlos.
        </p>
      )}

      {aparte.length > 0 && (
        <div className="pulso-rangos-aparte">
          <h6>Otros valores</h6>
          <ul>
            {aparte.map((v) => (
              <li key={v.codigo}>
                <span className="pulso-rangos-aparte-valor">
                  <span>{(v.etiqueta ?? "").trim() || v.codigo}</span>
                  <code>{v.codigo}</code>
                </span>
                <span className="pulso-rangos-casos">{v.n === null || v.n === undefined ? "" : formatoConteoDe(v.n, "caso", "casos")}</span>
                <select
                  value={mapa[v.codigo] ?? "__sin_mapa"}
                  aria-label={`Categoría de ${(v.etiqueta ?? "").trim() || v.codigo}`}
                  onChange={(e) => onAsignar({ [v.codigo]: e.target.value === "__sin_mapa" ? null : e.target.value })}
                >
                  <option value="__sin_mapa">Sin mapa</option>
                  {categorias.map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta || c.codigo}</option>)}
                  {opcionesExtra.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detalle && (
        <details className="pulso-rangos-detalle">
          <summary>Ver valor por valor{nValores ? ` (${formatoConteo(nValores)})` : ""} en {base}</summary>
          {detalle}
        </details>
      )}
    </div>
  );
}
