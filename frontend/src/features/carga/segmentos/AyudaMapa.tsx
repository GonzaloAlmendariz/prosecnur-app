// Ayudas que arman el mapa de una base (ADR 0107): «Tramos de antigüedad»
// para un origen que es un año (relativo al año de la medición) y «Rangos»
// para una numérica como la edad. Sólo asignan: lo ya asignado fuera de los
// tramos no se toca. La lógica vive en `segmentosModel`.

import { useId, useState } from "react";
import type { OpcionBase } from "../../../api/baseVariables";
import type { CategoriaSegmento } from "../../../api/segmentos";
import { PulsoButton } from "../../../components/PulsoButton";
import { Plus, Trash2 } from "../../../vendor/lucide-react";
import {
  aniosParaTramos,
  mapaPorRangos,
  mapaPorTramos,
  rangosPorDefecto,
  tramoNuevo,
  tramosPorDefecto,
  validarTramos,
  valoresParaRangos,
  type AyudaMapa as TipoAyuda,
  type Tramo,
} from "./segmentosModel";

export type AyudaMapaProps = {
  tipo: TipoAyuda;
  origen: string;
  /** El año de la medición, si el nombre de la base lo dice. */
  anio: number | null;
  escala: readonly CategoriaSegmento[];
  /** Los códigos observados del origen: las ayudas asignan sobre ellos. */
  codigos: readonly OpcionBase[];
  onAplicar: (mapa: Record<string, string>) => void;
  onCerrar: () => void;
};

export function AyudaMapa({ tipo, origen, anio, escala, codigos, onAplicar, onCerrar }: AyudaMapaProps) {
  const id = useId();
  const esTramos = tipo === "tramos";
  const [tramos, setTramos] = useState<Tramo[]>(() => (esTramos ? tramosPorDefecto(escala) : rangosPorDefecto(escala)));
  const [anioTexto, setAnioTexto] = useState(anio ? String(anio) : "");
  const [intento, setIntento] = useState(false);
  const anioNum = /^\d{4}$/.test(anioTexto.trim()) ? Number(anioTexto.trim()) : null;
  const errores = validarTramos(tramos, escala, esTramos ? anioNum : undefined);

  const cambiar = (clave: string, campo: "desde" | "hasta" | "destino", valor: string) =>
    setTramos((ts) => ts.map((t) => (t.clave === clave ? { ...t, [campo]: valor } : t)));

  const aplicar = () => {
    setIntento(true);
    if (errores.length) return;
    const mapa = esTramos && anioNum !== null
      ? mapaPorTramos(aniosParaTramos(codigos), anioNum, tramos)
      : mapaPorRangos(valoresParaRangos(codigos), tramos);
    onAplicar(mapa);
  };

  const unidad = esTramos ? "años" : "";
  return (
    <div className="pulso-seg-ayuda" role="group" aria-labelledby={`${id}-titulo`}>
      <div className="pulso-vb-subtitulo">
        <h5 id={`${id}-titulo`}>{esTramos ? "Tramos de antigüedad" : "Rangos"}</h5>
        {esTramos ? (
          <label className="pulso-seg-anio">
            <span>Año de la medición</span>
            <input
              value={anioTexto}
              inputMode="numeric"
              maxLength={4}
              aria-invalid={intento && anioNum === null ? true : undefined}
              onChange={(e) => setAnioTexto(e.target.value)}
            />
          </label>
        ) : null}
      </div>
      <p className="pulso-armon-ayuda">
        {esTramos
          ? `Antigüedad = ${anioNum ?? "año de la medición"} − ${origen}. Deja «hasta» vacío para «o más».`
          : `Valores de ${origen}, ambos extremos incluidos. Deja «hasta» vacío para «o más».`}
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
            {unidad && <span className="pulso-seg-unidad">{unidad}</span>}
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
