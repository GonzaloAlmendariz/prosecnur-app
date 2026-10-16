// Ayudas que arman el mapa de una base: «Años transcurridos» para una variable
// cuyos valores son años (tramos relativos al año de la medición: tiempo desde
// el ingreso, desde un evento, edad desde el año de nacimiento…) y «Rangos»
// para una numérica como la edad. Los nombres no suponen un estudio: la
// categoría la nombra la escala. Sólo asignan: lo ya asignado fuera de los
// tramos no se toca. Las usan Segmentos de cruce (ADR 0107) y Armonizar (ADR
// 0104). La lógica vive en `segmentosModel`.

import { useId, useState } from "react";
import type { OpcionBase } from "../../../api/baseVariables";
import type { CategoriaSegmento } from "../../../api/segmentos";
import { PulsoButton } from "../../../components/PulsoButton";
import { CalendarRange, Plus, Ruler, Trash2 } from "../../../vendor/lucide-react";
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
        <h5 id={`${id}-titulo`}>{esTramos ? "Años transcurridos" : "Rangos"}</h5>
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
          ? `Años transcurridos = ${anioNum ?? "año de la medición"} − ${origen}. Cada tramo va a una categoría de la escala. Deja «hasta» vacío para «o más».`
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

/** Los botones que abren cada ayuda; la misma pareja en Segmentos y en Armonizar. */
export function BotonesAyudaMapa({
  ayudas,
  abierta,
  onAlternar,
}: {
  ayudas: readonly TipoAyuda[];
  abierta: TipoAyuda | null;
  onAlternar: (ayuda: TipoAyuda) => void;
}) {
  return (
    <>
      {ayudas.includes("tramos") && (
        <PulsoButton
          variant="secondary"
          size="sm"
          className="pulso-armon-btn"
          aria-expanded={abierta === "tramos"}
          title="Agrupa los años en tramos de tiempo transcurrido hasta el año de esta medición."
          onClick={() => onAlternar("tramos")}
        >
          <CalendarRange size={13} aria-hidden="true" />
          Años transcurridos
        </PulsoButton>
      )}
      {ayudas.includes("rangos") && (
        <PulsoButton
          variant="secondary"
          size="sm"
          className="pulso-armon-btn"
          aria-expanded={abierta === "rangos"}
          title="Agrupa los valores en rangos."
          onClick={() => onAlternar("rangos")}
        >
          <Ruler size={13} aria-hidden="true" />
          Rangos
        </PulsoButton>
      )}
    </>
  );
}
