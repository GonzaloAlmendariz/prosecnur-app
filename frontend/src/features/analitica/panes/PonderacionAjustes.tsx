// Panel "Ajustes" de Ponderación (prototipo: el panel bajo "Efecto de
// ponderar"). Reúne lo que se decide sobre el peso y no es una meta: de dónde
// sale el peso, el peso base, la escala, los casos sin dato y el recorte de
// pesos extremos; al final, los casos que cuentan y la versión de la base. Cada
// ajuste es un bloque con su rótulo y su control a la vista, separado por una
// línea; la consecuencia que no se ve va en una línea bajo el rótulo.
//
// Con la ponderación apagada quedan solo los dos últimos: siguen valiendo para
// el resto de Analítica.

import { useId, type ReactNode } from "react";

import type { VariableInstrumento } from "../../../api/client";
import { PulsoInput } from "../../../components/PulsoInput";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { Switch } from "../../../components/Switch";
import { SlidersHorizontal } from "../../../vendor/lucide-react";
import { conOrigenPesoBase, origenPesoBase } from "../ponderacionConfigModel";
import { AgregarVariable } from "../ponderacion/AgregarVariable";
import { Segmentado } from "../ponderacion/Segmentado";
import type { PonderacionConfig, PonderDesign, PonderRake, PonderTrim } from "../store";
import { UniversoAnalisis } from "../UniversoAnalisis";
import { PesoPorColumna } from "./PesoPorColumna";
import { PonderacionPesoBase } from "./PonderacionPesoBase";
import type { LecturaVariables } from "./variablesDeLaBase";

const UMBRAL_DEFECTO = 0.05;
const TOPE_DEFECTO = 5;

export function PonderacionAjustes({
  pond, lecturaVariables, variables, baseActiva, datos,
  onPonderacion, onDesign, onEscala, onTotal, onRake, onTrim,
}: {
  pond: PonderacionConfig;
  lecturaVariables: LecturaVariables;
  variables: readonly VariableInstrumento[];
  baseActiva: string | null;
  /** De qué datos sale el cálculo y la plantilla de Analítica (la barra de fuente del módulo). */
  datos?: ReactNode;
  onPonderacion: (patch: Partial<PonderacionConfig>) => void;
  onDesign: (patch: Partial<PonderDesign>) => void;
  onEscala: (e: "media1" | "expansion") => void;
  onTotal: (t: number | null) => void;
  onRake: (p: Partial<Omit<PonderRake, "margins">>) => void;
  onTrim: (p: Partial<PonderTrim> | null) => void;
}) {
  const ids = useId();
  const porColumna = pond.modo === "columna";
  const calibra = pond.enabled && !porColumna;
  const escala = pond.escala === "expansion" ? "expansion" : "media1";
  const faltantes = pond.rake?.faltantes === "imputar" ? "imputar" : "excluir";
  const umbral = pond.rake?.imputacion?.umbral ?? UMBRAL_DEFECTO;
  const cap = pond.trim?.cap ?? 0;
  const recorte = cap > 1;
  const recalibrar = !!pond.trim?.recalibrar;
  const origen = origenPesoBase(pond);
  const estrato = pond.design?.var ?? "";
  const margenes = pond.rake?.margins ?? [];
  return (
    <PanelDeMesa
      zona="ajustes"
      titulo="Ajustes"
      icono={<SlidersHorizontal size={16} aria-hidden="true" />}
    >
      {/* C1: cada ajuste mide lo que su control necesita; no son marcos pares. */}
      <div
        className="pond-ajustes"
        data-qa-geometry-group="analitica/ponderacion-ajustes"
        data-qa-geometry-contract="intrinsic"
      >
        {pond.enabled ? (
          <div className="pond-ajuste-bloque pond-ajuste-origen">
            <PesoPorColumna
              modo={porColumna ? "columna" : "calibracion"}
              pesoColumna={pond.peso_columna ?? ""}
              lectura={lecturaVariables}
              baseActiva={baseActiva}
              onModo={(modo) => onPonderacion(modo === "columna" ? { modo } : { modo: undefined, peso_columna: undefined })}
              onColumna={(peso_columna) => onPonderacion({ modo: "columna", peso_columna })}
            />
          </div>
        ) : null}

        {calibra ? (
          <div className="pond-ajuste-bloque">
            <PonderacionPesoBase
              origen={origen}
              columna={pond.design?.peso_columna ?? ""}
              variables={variables}
              variablesLeidas={lecturaVariables.tipo === "lista"}
              onOrigen={(o) => onPonderacion(conOrigenPesoBase(pond, o))}
              onColumna={(peso_columna) => onDesign({ peso_columna })}
            />
            {origen === "estrato" && !estrato ? (
              <AgregarVariable
                variables={variables.filter((v) => !!v.categorica && !margenes.some((m) => m.var === v.name))}
                rotulo="Elegir la variable del estrato"
                onElegir={(nombre) => onDesign({ var: nombre, pop_sizes: {} })}
              />
            ) : null}
          </div>
        ) : null}

        {calibra ? (
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
        ) : null}

        {calibra ? (
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
        ) : null}

        {calibra ? (
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
        ) : null}

        {calibra && recorte ? (
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

        {/* Sobre qué casos y qué versión de la base se calcula: valen también con la ponderación apagada. */}
        <div className="pond-ajuste-bloque pond-ajuste-universo">
          <span className="pond-ajuste-rotulo">Casos que cuentan</span>
          <UniversoAnalisis />
        </div>
        {datos ? (
          <div className="pond-ajuste-bloque">
            <span className="pond-ajuste-rotulo">Datos y plantilla</span>
            <div className="pond-datos">{datos}</div>
          </div>
        ) : null}
      </div>
    </PanelDeMesa>
  );
}
