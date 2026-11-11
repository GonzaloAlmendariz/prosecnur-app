// Panel "Ajustes" de la calibración: escala de los pesos, casos sin dato y
// recorte de pesos extremos. Cada ajuste es una fila con su rótulo y su control
// a la vista; la consecuencia que no se ve va en una línea bajo el rótulo.

import { useId } from "react";

import { Panel } from "../../../components/Panel";
import { PulsoInput } from "../../../components/PulsoInput";
import { Switch } from "../../../components/Switch";
import { SlidersHorizontal } from "../../../vendor/lucide-react";
import { Segmentado } from "../ponderacion/Segmentado";
import type { PonderacionConfig, PonderRake, PonderTrim } from "../store";

const UMBRAL_DEFECTO = 0.05;
const TOPE_DEFECTO = 5;

export function PonderacionAjustes({ pond, onEscala, onTotal, onRake, onTrim }: {
  pond: PonderacionConfig;
  onEscala: (e: "media1" | "expansion") => void;
  onTotal: (t: number | null) => void;
  onRake: (p: Partial<Omit<PonderRake, "margins">>) => void;
  onTrim: (p: Partial<PonderTrim> | null) => void;
}) {
  const ids = useId();
  const escala = pond.escala === "expansion" ? "expansion" : "media1";
  const faltantes = pond.rake?.faltantes === "imputar" ? "imputar" : "excluir";
  const umbral = pond.rake?.imputacion?.umbral ?? UMBRAL_DEFECTO;
  const cap = pond.trim?.cap ?? 0;
  const recorte = cap > 1;
  const recalibrar = !!pond.trim?.recalibrar;
  return (
    <Panel
      noPadding
      data-entra="sube"
      className="pond-panel pond-panel-ajustes"
      title={<><SlidersHorizontal size={16} aria-hidden="true" /><span>Ajustes</span></>}
    >
      {/* C1: cada ajuste mide lo que su control necesita; no son marcos pares. */}
      <div
        className="pond-ajustes"
        data-qa-geometry-group="analitica/ponderacion-ajustes"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="pond-ajuste-bloque">
          <span className="pond-ajuste-rotulo" id={`${ids}-escala`}>Escala de los pesos</span>
          <Segmentado
            etiquetadoPor={`${ids}-escala`}
            valor={escala}
            onCambio={onEscala}
            opciones={[
              { valor: "media1", rotulo: "Media 1", ayuda: "Los pesos promedian 1: las tablas muestran el número de casos de la muestra." },
              { valor: "expansion", rotulo: "Expansión", ayuda: "Los pesos suman la población: el total de las metas en conteos, el del estrato o el del peso base." },
            ]}
          />
          {escala === "expansion" ? (
            <label className="pond-ajuste-campo">
              <span>Población total</span>
              <PulsoInput
                size="sm"
                inputMode="numeric"
                placeholder="La de las metas"
                value={pond.total_poblacion ?? ""}
                title="Opcional. Sin valor, sale de las metas en conteos, del estrato o de la suma del peso base."
                onChange={(e) => {
                  const n = Number.parseFloat(e.target.value.replace(/[^\d.]/g, ""));
                  onTotal(Number.isFinite(n) && n > 0 ? n : null);
                }}
              />
            </label>
          ) : null}
        </div>

        <div className="pond-ajuste-bloque">
          <span className="pond-ajuste-rotulo" id={`${ids}-faltantes`}>Casos sin dato (NA, 98 y 99)</span>
          <Segmentado
            etiquetadoPor={`${ids}-faltantes`}
            valor={faltantes}
            onCambio={(v) => onRake({ faltantes: v })}
            opciones={[
              { valor: "excluir", rotulo: "Dejar fuera del margen", ayuda: "Los casos sin dato conservan su peso en ese margen; la meta se ajusta entre los casos con dato." },
              { valor: "imputar", rotulo: "Imputar", ayuda: "Cada caso sin dato toma el valor de un caso parecido en las otras variables (hot-deck), con semilla fija y solo para el peso: la base no cambia." },
            ]}
          />
          {faltantes === "imputar" ? (
            <label className="pond-ajuste-campo">
              <span>Hasta</span>
              <PulsoInput
                size="sm"
                numeric
                inputMode="decimal"
                value={+(umbral * 100).toFixed(2)}
                aria-label="Porcentaje máximo de casos sin dato para imputar"
                title="Si en alguna variable faltan más casos que este porcentaje, la imputación se rechaza."
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value.replace(",", "."));
                  onRake({ imputacion: { ...(pond.rake?.imputacion ?? {}), umbral: Number.isFinite(v) && v > 0 && v <= 100 ? v / 100 : UMBRAL_DEFECTO } });
                }}
              />
              <span>% de casos sin dato</span>
            </label>
          ) : null}
        </div>

        <div className="pond-ajuste-bloque">
          <div className="pond-ajuste-interruptor">
            <span className="pond-ajuste-texto">
              <span className="pond-ajuste-rotulo">Recortar pesos extremos</span>
              {recorte ? <small>Ningún peso queda por encima de {cap} veces la media ni por debajo de 1/{cap} de ella.</small> : null}
            </span>
            <Switch
              className="analitica-interruptor"
              checked={recorte}
              ariaLabel="Recortar pesos extremos"
              onToggle={() => onTrim(recorte ? null : { cap: TOPE_DEFECTO })}
            />
          </div>
          {recorte ? (
            <label className="pond-ajuste-campo pond-ajuste-tope">
              <span>Tope</span>
              <input
                type="range"
                min={2}
                max={8}
                step={1}
                value={cap}
                className="pond-recorte-rango"
                aria-label="Tope del recorte, en veces la media"
                onChange={(e) => onTrim({ cap: Number.parseInt(e.target.value, 10) })}
              />
              <span className="pond-recorte-valor">{cap} veces</span>
            </label>
          ) : null}
        </div>

        {recorte ? (
          <div className="pond-ajuste-bloque">
            <div className="pond-ajuste-interruptor">
              <span className="pond-ajuste-texto">
                <span className="pond-ajuste-rotulo">Recalibrar después del recorte</span>
                <small title="Recorte y calibración se alternan hasta que el tope y los márgenes se cumplen a la vez.">
                  {recalibrar ? "Los márgenes se vuelven a ajustar después del recorte." : "El recorte puede mover los márgenes."}
                </small>
              </span>
              <Switch
                className="analitica-interruptor"
                checked={recalibrar}
                ariaLabel="Recalibrar después del recorte"
                onToggle={() => onTrim({ recalibrar: !recalibrar })}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
