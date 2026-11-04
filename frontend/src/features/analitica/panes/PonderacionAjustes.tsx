// Ajustes de la calibración: escala del peso, NA/98/99 y recorte. Rótulos
// cortos; el detalle va en el `title` de cada control.

import { PulsoInput } from "../../../components/PulsoInput";
import { Switch } from "../../../components/Switch";
import type { PonderacionConfig, PonderRake, PonderTrim } from "../store";

const UMBRAL_DEFECTO = 0.05;

function Segmentado<T extends string>({ etiqueta, valor, opciones, onCambio }: {
  etiqueta: string; valor: T; opciones: { valor: T; rotulo: string; ayuda: string }[]; onCambio: (v: T) => void;
}) {
  return (
    <div className="pond-ajuste">
      <span className="pond-ajuste-rotulo">{etiqueta}</span>
      <div className="analitica-segmented" role="radiogroup" aria-label={etiqueta}>
        {opciones.map((o) => (
          <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor}
            className={valor === o.valor ? "is-on" : ""} title={o.ayuda} onClick={() => onCambio(o.valor)}>
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PonderacionAjustes({ pond, onEscala, onTotal, onRake, onTrim }: {
  pond: PonderacionConfig;
  onEscala: (e: "media1" | "expansion") => void;
  onTotal: (t: number | null) => void;
  onRake: (p: Partial<Omit<PonderRake, "margins">>) => void;
  onTrim: (p: Partial<PonderTrim> | null) => void;
}) {
  const escala = pond.escala === "expansion" ? "expansion" : "media1";
  const faltantes = pond.rake?.faltantes === "imputar" ? "imputar" : "excluir";
  const umbral = pond.rake?.imputacion?.umbral ?? UMBRAL_DEFECTO;
  const cap = pond.trim?.cap ?? 0;
  const recorte = cap > 1;
  return (
    <div className="pond-card pond-ajustes" data-qa-geometry-group="analitica/ponderacion-ajustes" data-qa-geometry-contract="intrinsic">
      <div className="pond-ajuste-bloque">
        <Segmentado
          etiqueta="Escala"
          valor={escala}
          onCambio={onEscala}
          opciones={[
            { valor: "media1", rotulo: "Media 1", ayuda: "Los pesos promedian 1: los reportes muestran n de la muestra." },
            { valor: "expansion", rotulo: "Expansión", ayuda: "Los pesos suman la población (N̂): el total de las metas en conteos, el del estrato o el del peso base." },
          ]}
        />
        {escala === "expansion" && (
          <label className="pond-ajuste-campo">
            <span>N̂</span>
            <PulsoInput size="sm" inputMode="numeric" placeholder="de las metas" aria-label="Población total (N̂)" value={pond.total_poblacion ?? ""}
              title="Opcional. Sin valor, N̂ sale de las metas en conteos, del estrato o de la suma del peso base."
              onChange={(e) => {
                const n = Number.parseFloat(e.target.value.replace(/[^\d.]/g, ""));
                onTotal(Number.isFinite(n) && n > 0 ? n : null);
              }} />
          </label>
        )}
      </div>

      <div className="pond-ajuste-bloque">
        <Segmentado
          etiqueta="NA, 98 y 99"
          valor={faltantes}
          onCambio={(v) => onRake({ faltantes: v })}
          opciones={[
            { valor: "excluir", rotulo: "Dejar fuera del margen", ayuda: "Los casos sin dato conservan su peso en ese margen; la meta se ajusta entre los casos con dato." },
            { valor: "imputar", rotulo: "Imputar", ayuda: "Hot-deck dentro de celdas de las otras variables, con semilla fija, sólo para el peso: la base no cambia." },
          ]}
        />
        {faltantes === "imputar" && (
          <label className="pond-ajuste-campo">
            <span>Hasta</span>
            <PulsoInput size="sm" numeric inputMode="decimal" value={+(umbral * 100).toFixed(2)} aria-label="Umbral de imputación (%)"
              title="Si en alguna variable faltan más casos que este porcentaje, la imputación se rechaza."
              onChange={(e) => {
                const v = Number.parseFloat(e.target.value.replace(",", "."));
                onRake({ imputacion: { ...(pond.rake?.imputacion ?? {}), umbral: Number.isFinite(v) && v > 0 && v <= 100 ? v / 100 : UMBRAL_DEFECTO } });
              }} />
            <span>% sin dato</span>
          </label>
        )}
      </div>

      <div className="pond-ajuste-bloque">
        <div className="pond-ajuste">
          <span className="pond-ajuste-rotulo">Recorte</span>
          <Switch checked={recorte} ariaLabel="Recortar pesos extremos"
            onToggle={() => onTrim(recorte ? null : { cap: 5 })} />
          {recorte && (
            <>
              <input type="range" min={2} max={8} step={1} value={cap} className="pond-recorte-rango"
                aria-label="Tope del recorte (veces la media)" onChange={(e) => onTrim({ cap: Number.parseInt(e.target.value, 10) })} />
              <span className="pond-recorte-valor" title="Ningún caso pesa más de este múltiplo de la media ni menos de su inverso.">{cap}×</span>
            </>
          )}
        </div>
        {recorte && (
          <div className="pond-ajuste">
            <span className="pond-ajuste-rotulo">Recalibrar</span>
            <Switch checked={!!pond.trim?.recalibrar} ariaLabel="Recalibrar después del recorte"
              onToggle={() => onTrim({ recalibrar: !pond.trim?.recalibrar })} />
            <small className="pond-ajuste-nota" title="Recorte y raking se alternan hasta que el tope y los márgenes se cumplen a la vez.">
              {pond.trim?.recalibrar ? "los márgenes se conservan" : "el recorte puede mover los márgenes"}
            </small>
          </div>
        )}
      </div>
    </div>
  );
}
