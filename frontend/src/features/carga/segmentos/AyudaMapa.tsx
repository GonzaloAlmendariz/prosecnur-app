// Ayuda que arma el mapa de una base: «Rangos» agrupa los valores de una
// variable numérica (una edad, un conteo, el resultado de una fórmula) en las
// categorías de la escala. Es genérica a propósito: un caso como «años desde el
// ingreso» se construye con una variable calculada por fórmula (ADR 0106) y
// luego se agrupa aquí. Sólo asigna: lo ya asignado fuera de los rangos no se
// toca. La usan Segmentos de cruce (ADR 0107), Armonizar (ADR 0104) y
// Recodificar (ADR 0106). La lógica vive en `segmentosModel`.

import { useId, useState } from "react";
import type { OpcionBase } from "../../../api/baseVariables";
import type { CategoriaSegmento } from "../../../api/segmentos";
import { PulsoButton } from "../../../components/PulsoButton";
import { Plus, Ruler, Trash2 } from "../../../vendor/lucide-react";
import {
  mapaPorRangos,
  rangosPorDefecto,
  tramoNuevo,
  validarTramos,
  valoresParaRangos,
  type AyudaMapa as TipoAyuda,
  type Tramo,
} from "./segmentosModel";

export type AyudaMapaProps = {
  tipo: TipoAyuda;
  origen: string;
  escala: readonly CategoriaSegmento[];
  /** Los códigos observados del origen: la ayuda asigna sobre ellos. */
  codigos: readonly OpcionBase[];
  onAplicar: (mapa: Record<string, string>) => void;
  onCerrar: () => void;
};

export function AyudaMapa({ origen, escala, codigos, onAplicar, onCerrar }: AyudaMapaProps) {
  const id = useId();
  const [tramos, setTramos] = useState<Tramo[]>(() => rangosPorDefecto(escala));
  const [intento, setIntento] = useState(false);
  const errores = validarTramos(tramos, escala);

  const cambiar = (clave: string, campo: "desde" | "hasta" | "destino", valor: string) =>
    setTramos((ts) => ts.map((t) => (t.clave === clave ? { ...t, [campo]: valor } : t)));

  const aplicar = () => {
    setIntento(true);
    if (errores.length) return;
    onAplicar(mapaPorRangos(valoresParaRangos(codigos), tramos));
  };

  return (
    <div className="pulso-seg-ayuda" role="group" aria-labelledby={`${id}-titulo`}>
      <div className="pulso-vb-subtitulo">
        <h5 id={`${id}-titulo`}>Rangos</h5>
      </div>
      <p className="pulso-armon-ayuda">
        {`Valores de ${origen}, ambos extremos incluidos. Deja «hasta» vacío para «o más».`}
      </p>
      <ol className="pulso-seg-tramos">
        {tramos.map((t, i) => (
          <li key={t.clave}>
            <label>
              <span className="pulso-sr-only">Desde, tramo {i + 1}</span>
              <input value={t.desde} inputMode="numeric" placeholder="Desde" onChange={(e) => cambiar(t.clave, "desde", e.target.value)} />
            </label>
            <span aria-hidden="true">a</span>
            <label>
              <span className="pulso-sr-only">Hasta, tramo {i + 1}</span>
              <input value={t.hasta} inputMode="numeric" placeholder="o más" onChange={(e) => cambiar(t.clave, "hasta", e.target.value)} />
            </label>
            <span aria-hidden="true" className="pulso-armon-masa-flecha">→</span>
            <label className="pulso-seg-tramo-destino">
              <span className="pulso-sr-only">Categoría del tramo {i + 1}</span>
              <select value={t.destino} onChange={(e) => cambiar(t.clave, "destino", e.target.value)}>
                <option value="">Elige una categoría</option>
                {escala.map((c) => (
                  <option key={c.codigo} value={c.codigo}>{c.codigo} {c.etiqueta}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="pulso-icon pulso-icon-danger"
              aria-label={`Quitar el tramo ${i + 1}`}
              onClick={() => setTramos((ts) => ts.filter((x) => x.clave !== t.clave))}
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <div className="pulso-seg-ayuda-pie">
        <PulsoButton variant="ghost" size="sm" className="pulso-armon-btn" onClick={() => setTramos((ts) => [...ts, tramoNuevo(ts)])}>
          <Plus size={13} aria-hidden="true" />
          Agregar tramo
        </PulsoButton>
        <span className="pulso-vb-editor-estado" aria-live="polite">
          {intento && errores.length ? <span className="pulso-armon-error">{errores[0]}</span> : null}
        </span>
        <PulsoButton variant="secondary" size="sm" className="pulso-armon-btn" onClick={onCerrar}>
          Cancelar
        </PulsoButton>
        <PulsoButton variant="secondary" size="sm" className="pulso-armon-btn" disabled={escala.length === 0} onClick={aplicar}>
          Aplicar al mapa
        </PulsoButton>
      </div>
    </div>
  );
}

/** El botón que abre la ayuda; el mismo en Segmentos, Armonizar y Recodificar. */
export function BotonesAyudaMapa({
  ayudas,
  abierta,
  onAlternar,
}: {
  ayudas: readonly TipoAyuda[];
  abierta: TipoAyuda | null;
  onAlternar: (ayuda: TipoAyuda) => void;
}) {
  if (!ayudas.includes("rangos")) return null;
  return (
    <PulsoButton
      variant="secondary"
      size="sm"
      className="pulso-armon-btn"
      aria-expanded={abierta === "rangos"}
      title="Agrupa los valores en rangos, cada uno a una categoría de la escala."
      onClick={() => onAlternar("rangos")}
    >
      <Ruler size={13} aria-hidden="true" />
      Rangos
    </PulsoButton>
  );
}
