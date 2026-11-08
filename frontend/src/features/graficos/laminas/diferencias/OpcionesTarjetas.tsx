// Cómo salen las tarjetas de diferencias (checklist UI del mazo, U1 y U2): con qué preguntas se compara y con qué nombre,
// el nombre corto de los grupos largos, cómo se nombran los casos y cuántas tarjetas como máximo. Escribe en la opción de la lámina o de
// su ranura (`modeloTarjetas.ts`); el motor la lee en `.tarjetas_opcion` (api/R/graficos_tarjetas_diferencias.R).

import { useId } from "react";
import { Plus, X } from "../../../../vendor/lucide-react";
import VariablePicker from "../../VariablePicker";
import { parseVarRef, useVariables } from "../../useVariables";
import { RadioSegmentado } from "../../subpestanas/RadioSegmentado";
import { CortosGrupos } from "./CortosGrupos";
import { CasosNombrados } from "./CasosNombrados";
import { AyudaGlobo } from "../AyudaGlobo";
import {
  crucesDe,
  dondeTarjetas,
  modoAGuardar,
  maxAGuardar,
  maxEfectivo,
  maxPorDefecto,
  opcionesMax,
  rotuloDeCruce,
  rotulosCon,
  type CambiosOpcion,
  type DondeTarjetas,
  type RanuraTarjetas,
  type ValorTarjetas,
} from "./modeloTarjetas";

type Props = {
  valor: ValorTarjetas;
  ranura: RanuraTarjetas | null;
  scope: "active" | "consolidated";
  baseActiva: string | null | undefined;
  onCambio: (cambios: CambiosOpcion) => void;
  /** U13: el gráfico admite el desglose bajo cada barra (`admiteEnLinea`). */
  enLinea?: boolean;
};

const DONDE: readonly { clave: DondeTarjetas; rotulo: string }[] = [
  { clave: "panel", rotulo: "Al lado del gráfico" },
  { clave: "en_linea", rotulo: "Bajo cada barra" },
];

export function OpcionesTarjetas({ valor, ranura, scope, baseActiva, onCambio, enLinea = false }: Props) {
  const cruces = crucesDe(valor);
  const publico = valor && typeof valor === "object" && typeof valor.publico === "string" ? valor.publico : "";
  const max = maxEfectivo(valor, ranura);
  const porDefecto = maxPorDefecto(ranura);
  const donde = dondeTarjetas(valor);
  return (
    <>
      {enLinea && (
        <div className="pulso-f6-dato" data-qa="tarjetas-donde" data-qa-geometry-member="">
          <span className="pulso-f6-dato-rotulo">
            Dónde van
            <AyudaGlobo rotulo="Dónde van" detalle={donde === "en_linea"
              ? "Bajo la barra de la respuesta, sus grupos con su cifra. Hasta dos respuestas, sin panel aparte."
              : "En un panel junto al gráfico, una tarjeta por diferencia."} />
          </span>
          <RadioSegmentado etiqueta="Dónde van las diferencias" valor={donde} opciones={DONDE}
            onCambiar={(k) => onCambio({ modo: modoAGuardar(k) })} />
        </div>
      )}
      <CrucesTarjetas valor={valor} cruces={cruces} onCambio={onCambio} />
      <CortosGrupos valor={valor} cruces={cruces} scope={scope} baseActiva={baseActiva} onCambio={(cortos) => onCambio({ cortos })} />
      <CasosNombrados valor={publico} onCambio={(p) => onCambio({ publico: p })} />
      <div className="pulso-f6-dato" data-qa-geometry-member="">
        <span className="pulso-f6-dato-rotulo">Máximo de tarjetas</span>
        <RadioSegmentado etiqueta="Máximo de tarjetas" valor={String(max)}
          opciones={opcionesMax(ranura).map((n) => ({ clave: String(n), rotulo: n === porDefecto ? `${n} (por defecto)` : String(n) }))}
          onCambiar={(k) => onCambio({ max: maxAGuardar(Number(k), ranura) })} />
      </div>
    </>
  );
}

/**
 * Los cruces de las tarjetas, cada uno con el nombre que lleva en ellas; vacío, los del estudio. La lámina de resumen y
 * la de hallazgos lo usan con sus `cruces` y `rotulos` (CrucesLamina), con su propia ayuda. U15: el motor lee cada cruce
 * en la base del gráfico (`.sig_var_local`), así que un cruce sin base no es un error y el selector no avisa «falta la base».
 */
export function CrucesTarjetas({ valor, cruces, onCambio, ayudaVacia = "Sin elegir, compara por los cruces del estudio.", ayudaLlena = "En este orden. El nombre vacío usa el de la pregunta." }: {
  valor: ValorTarjetas;
  cruces: string[];
  onCambio: (c: CambiosOpcion) => void;
  ayudaVacia?: string;
  ayudaLlena?: string;
}) {
  const id = useId();
  const { variables } = useVariables();
  const etiquetaDe = (ref: string) => {
    const r = parseVarRef(ref);
    const v = variables.find((x) => x.name === r.name && (!r.source || x.source === r.source));
    return v?.label?.trim() || r.name;
  };
  const reemplazar = (i: number, ref: string | null) => {
    const siguiente = [...cruces];
    if (ref && !cruces.includes(ref)) siguiente[i] = ref;
    else if (!ref) siguiente.splice(i, 1);
    onCambio({ cruces: siguiente });
  };
  return (
    <div className="pulso-f6-dato is-apilado" data-qa="tarjetas-cruces" data-qa-geometry-member="">
      <span className="pulso-f6-dato-rotulo" id={`${id}-rotulo`}>
        Comparar por
        <AyudaGlobo id={`${id}-ayuda`} rotulo="Comparar por" detalle={cruces.length ? ayudaLlena : ayudaVacia} />
      </span>
      <div className="pulso-f6-criterios" role="group" aria-labelledby={`${id}-rotulo`} aria-describedby={`${id}-ayuda`}
        data-qa-geometry-group="graficos/f6-tarjetas-cruces" data-qa-geometry-contract="intrinsic">
        {cruces.map((ref, i) => {
          const etiqueta = etiquetaDe(ref);
          return (
            <div key={`${ref}-${i}`} className="pulso-f6-criterio" role="group" aria-label={`Comparación ${i + 1}: ${etiqueta}`}>
              <div className="pulso-f6-criterio-cabecera">
                <VariablePicker value={ref} onChange={(v) => reemplazar(i, v)} placeholder="Elige la pregunta…" sinAvisoDeBase />
                <button type="button" className="pulso-f6-boton pulso-f6-preguntas-quitar" aria-label={`Dejar de comparar por ${etiqueta}`}
                  onClick={() => reemplazar(i, null)}>
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              <input className="pulso-f6-input" value={rotuloDeCruce(valor, ref)} placeholder={etiqueta}
                aria-label={`Nombre de ${etiqueta} en la lámina`}
                onChange={(e) => onCambio({ rotulos: rotulosCon(valor, ref, e.target.value) })} />
            </div>
          );
        })}
        <div className="pulso-f6-preguntas-fila is-nueva">
          <Plus size={14} aria-hidden="true" />
          <VariablePicker value={null} placeholder="Agregar otra pregunta…" sinAvisoDeBase
            onChange={(v) => { if (v && !cruces.includes(v)) onCambio({ cruces: [...cruces, v] }); }} />
        </div>
      </div>
    </div>
  );
}
