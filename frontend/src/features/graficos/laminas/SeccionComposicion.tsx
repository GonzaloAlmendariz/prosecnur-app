// Sección Composición del inspector (F6.2; dirección F6 §4.1 «Inspector» y §4.3b): la composición de la lámina dibujada
// desde el estándar con sus gráficos en sus ranuras, sus variantes cuando el tipo las tiene (portada, índice,
// separador, cierre) y la puerta a «¿Qué lámina?». El reparto lo fija el recetario: no hay deslizadores.

import { useId } from "react";
import { LayoutTemplate, Lock } from "../../../vendor/lucide-react";
import type { Slide } from "../../../api/graficos";
import { ComposicionLamina } from "../iconos/ComposicionLamina";
import { ESTANDAR_LAMINAS } from "../iconos/estandarLaminas.generated";
import { composicionDe } from "../iconos/composicion";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../store";
import { useGraficosRegistry } from "../useGraficosRegistry";
import type { LaminaEnEstructura } from "./modeloEstructura";
import { graficosDeLamina } from "./selectores/cambioTipoLamina";
import { conVariante, defectoEfectivoDe, rotuloRanuras, varianteDe, variantesDe } from "./selectores/tiposLamina";
import "./selectores/selectores.css";
import "../indice/editorIndice.css";
import "./seccionComposicion.css";

type Props = {
  slide: Slide;
  lamina: LaminaEnEstructura;
  ranura: number | null;
  onCambiarLamina: () => void;
};

export function SeccionComposicion({ slide, lamina, ranura, onCambiarLamina }: Props) {
  const setSlideTipo = usePlanStore((s) => s.setSlideTipo);
  const { slidesById } = useGraficosRegistry();
  const id = useId();
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const graficos = Object.fromEntries(graficosDeLamina(slide).map((g) => [g.slot, g.grafico.graficador]));
  // E2: la opción por defecto es la que el motor usaría para ESTA lámina (en el índice con focos, «círculos») y la
  // marcada es la que se exporta; nunca otra (`composicionIndiceEfectiva`, hecho 4 del contrato 2b).
  const defecto = defectoEfectivoDe(slide);
  const variantes = variantesDe(slide.tipo, slidesById[slide.tipo]?.args.find((a) => a.name === "variante")?.choices, defecto);
  const variante = varianteDe(slide, defecto);
  const fueraDeOpciones = variantes !== null && variante !== null && !variantes.opciones.some((o) => o.valor === variante);
  const comp = composicionDe(slide.tipo, slots);
  const uso = comp.base ? ESTANDAR_LAMINAS[comp.base]?.uso : undefined;

  return (
    <div className="pulso-f6-pila" data-qa-geometry-group="graficos/f6-composicion" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-composicion-actual">
        <ComposicionLamina
          tipo={slide.tipo}
          slots={slots}
          graficos={graficos}
          variante={variante}
          ranuraActiva={ranura}
          numerar
          titulo={`Composición de la lámina ${lamina.posicion}: ${lamina.tipoLabel}`}
        />
      </div>
      <div className="pulso-f6-composicion-texto">
        <strong>{lamina.tipoLabel}</strong>
        <span>
          {slots.length > 0
            ? `${rotuloRanuras(slide.tipo)} · ${lamina.ranurasLlenas} con contenido`
            : "Lámina de estructura, sin ranuras de gráfico"}
        </span>
        {uso && <span>{uso}.</span>}
        {comp.fuente === "derivada" && <span>Composición antigua: ya no se ofrece al insertar, pero sigue saliendo así.</span>}
      </div>

      {variantes && (
        <fieldset className="pulso-f6-variantes">
          <legend className="pulso-f6-selector-leyenda">{variantes.label}</legend>
          {variantes.opciones.map((o) => (
            <label key={o.valor} className="pulso-f6-variante">
              <input
                type="radio"
                className="pulso-f6-radio-oculto"
                name={`${id}-variante`}
                value={o.valor}
                checked={variante === o.valor}
                onChange={() => setSlideTipo(slide.id, slide.tipo, conVariante(slide, o.valor, defecto))}
              />
              <ComposicionLamina tipo={slide.tipo} slots={slots} variante={o.valor} />
              <span>{o.label}</span>
              {o.detalle && <small>{o.detalle}</small>}
              {o.valor === variantes.defecto && (
                <span className="pulso-f6-chip pulso-f6-sello-recetario" title="La que el motor usa si no eliges otra">Del recetario</span>
              )}
            </label>
          ))}
          {fueraDeOpciones && (
            <p className="pulso-f6-candado pulso-f6-variantes-fuera" role="note">
              <Lock size={14} aria-hidden="true" />
              <span>
                {variante === "focos"
                  ? "Sale con el estilo de focos de la ruta anterior, que el recetario no dibuja. Elige una composición para pasar al recetario."
                  : "Sale con una composición que el recetario no ofrece. Elige una para fijarla."}
              </span>
            </p>
          )}
        </fieldset>
      )}

      {comp.fuente !== "estructura" && (
        <p className="pulso-f6-candado">
          <Lock size={14} aria-hidden="true" />
          <span>Lo fija el recetario: dónde va cada ranura y lo que ocupa el gráfico adentro. Para otro reparto, cambia de lámina.</span>
        </p>
      )}

      <button type="button" className="pulso-f6-boton pulso-f6-composicion-cambiar" onClick={onCambiarLamina}>
        <LayoutTemplate size={15} aria-hidden="true" />
        Cambiar de lámina…
      </button>
    </div>
  );
}
