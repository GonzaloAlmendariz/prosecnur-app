// Sección Composición del inspector (F6.2; dirección F6 §4.1 «Inspector» y §4.3b): la composición de la lámina dibujada
// desde el estándar con sus gráficos en sus ranuras, sus variantes cuando el tipo las tiene (portada, índice,
// separador, cierre) y la puerta a «¿Qué lámina?». El reparto lo fija el recetario: no hay deslizadores.

import { useId } from "react";
import { Lock } from "../../../vendor/lucide-react";
import type { Slide } from "../../../api/graficos";
import { ComposicionLamina } from "../iconos/ComposicionLamina";
import { ESTANDAR_LAMINAS } from "../iconos/estandarLaminas.generated";
import { composicionDe } from "../iconos/composicion";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../store";
import { useGraficosRegistry } from "../useGraficosRegistry";
import type { LaminaEnEstructura } from "./modeloEstructura";
import { opcionesDeComposicion } from "./opcionesComposicion";
import { rolSinGraficos } from "./rolEstructura";
import { DisposicionLamina } from "./disposicion/DisposicionLamina";
import { disposicionDe } from "./disposicion/modeloDisposicion";
import { graficosDeLamina } from "./selectores/cambioTipoLamina";
import { conVariante, defectoEfectivoDe, rotuloRanuras, varianteDe, variantesDe } from "./selectores/tiposLamina";
import "./selectores/selectores.css";
import "../indice/editorIndice.css";
import "./seccionComposicion.css";

type Props = {
  slide: Slide;
  lamina: LaminaEnEstructura;
  ranura: number | null;
};

export function SeccionComposicion({ slide, lamina, ranura }: Props) {
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
  const disposicion = disposicionDe(slide);
  const comp = composicionDe(slide.tipo, slots, disposicion);
  const uso = comp.base ? ESTANDAR_LAMINAS[comp.base]?.uso : undefined;

  return (
    <div className="pulso-f6-pila" data-qa-geometry-group="graficos/f6-composicion" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-composicion-actual">
        <ComposicionLamina
          tipo={slide.tipo}
          slots={slots}
          graficos={graficos}
          opciones={opcionesDeComposicion(slide)}
          variante={variante}
          disposicion={disposicion}
          ranuraActiva={ranura}
          numerar
          titulo={`Composición de la lámina ${lamina.posicion}: ${lamina.tipoLabel}`}
        />
      </div>
      <div className="pulso-f6-composicion-texto">
        <strong>{lamina.tipoLabel}</strong>
        <span>
          {slots.length > 0
            ? `${rotuloRanuras(slide.tipo)}, ${lamina.ranurasLlenas} con contenido`
            : rolSinGraficos(slide.tipo)}
        </span>
        {uso && <span>{uso}.</span>}
        {comp.fuente === "derivada" && <span>Composición antigua: ya no se ofrece al insertar, pero sigue saliendo así.</span>}
      </div>

      <DisposicionLamina slide={slide} />

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
                <span className="pulso-f6-chip pulso-f6-sello-recetario" title="La que se usa si no eliges otra">Por defecto</span>
              )}
            </label>
          ))}
          {fueraDeOpciones && (
            <p className="pulso-f6-candado pulso-f6-variantes-fuera" role="note">
              <Lock size={14} aria-hidden="true" />
              <span>
                {variante === "focos"
                  ? "Usa un estilo antiguo. Elige una de estas composiciones."
                  : "Usa una composición que ya no está disponible. Elige una de estas."}
              </span>
            </p>
          )}
        </fieldset>
      )}

      {/* R9-16: sin «Cambiar de lámina…» aquí; la acción vive una sola vez, en «Cambiar lámina» de la cabecera. */}
    </div>
  );
}
