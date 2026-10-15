// Maqueta de la tarjeta del Informe (I1 del rediseño, 2026-10-14): «para la vista de informe el énfasis no es cómo se ve
// en PowerPoint sino las maquetas; cómo se ve en PowerPoint se queda en Láminas» (Gonzalo). Es la misma maqueta del
// editor (`MaquetaLamina`) reducida a lo que se lee a 220 px: cada gráfico en su ranura REAL de la composición, con su
// glifo y su pregunta; antetítulo y título arriba. Estática: la tarjeta entera es la opción del clasificador, así que
// aquí no hay botones. No pide la vista previa del motor (ni LibreOffice): pintar el informe es instantáneo.

import { memo, useMemo } from "react";
import type { Slide } from "../../../api/graficos";
import { ComposicionLamina } from "../iconos/ComposicionLamina";
import { composicionDe } from "../iconos/composicion";
import { GlifoGrafico } from "../iconos/GlifoGrafico";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../store";
import { useVariables } from "../useVariables";
import { ajustesDelGlifo, coloresDeEscala } from "../laminas/maqueta/fichaModelo";
import { datosEstructura } from "../laminas/maqueta/datosEstructura";
import { ranurasDeMaqueta } from "../laminas/modeloMaqueta";
import { varianteDe } from "../laminas/selectores/tiposLamina";
import { tituloQueSale } from "../laminas/tituloQueSale";
import "../iconos/glifoGrafico.css";

type Props = { slide: Slide; tipoLabel: string; antetitulo: string | null };

function MaquetaTarjetaBase({ slide, tipoLabel, antetitulo }: Props) {
  const { variables } = useVariables();
  const presets = usePlanStore((s) => s.presets);
  const paletas = usePlanStore((s) => s.paletas);
  const vinculos = usePlanStore((s) => s.paletasVinculos);
  const informe = usePlanStore((s) => s.plan.slides);
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const estructura = composicionDe(slide.tipo, slots).fuente === "estructura";
  const ranuras = useMemo(
    () => (estructura ? [] : ranurasDeMaqueta(slide, variables, presets, { paletas, vinculos })),
    [estructura, slide, variables, presets, paletas, vinculos],
  );

  if (estructura) {
    return (
      <span className="pulso-f6-vg-maqueta is-estructura" data-maqueta-tipo={slide.tipo}>
        <ComposicionLamina tipo={slide.tipo} slots={slots} variante={varianteDe(slide)} datos={datosEstructura(slide, informe)} />
      </span>
    );
  }

  const titulo = tituloQueSale(slide, variables, tipoLabel);
  return (
    <span className="pulso-f6-vg-maqueta" data-maqueta-tipo={slide.tipo}>
      <span className="pulso-f6-vg-maqueta-ante">{antetitulo || ""}</span>
      <span className={`pulso-f6-vg-maqueta-titulo${titulo ? "" : " is-vacio"}`}>{titulo || "Sin título"}</span>
      {ranuras.map((r, i) => {
        const estilo = { left: `${r.rect.x * 100}%`, top: `${r.rect.y * 100}%`, width: `${r.rect.w * 100}%`, height: `${r.rect.h * 100}%` };
        if (r.k === null) return <span key={i} className="pulso-f6-vg-ranura is-cifra" style={estilo} />;
        if (!r.graficador) return <span key={r.slot ?? i} className="pulso-f6-vg-ranura is-vacia" style={estilo}><span className="pulso-f6-vg-ranura-lb">Sin gráfico</span></span>;
        const { glifo } = ajustesDelGlifo(r.graficador, r.args, !!r.preguntas[0]?.cruce);
        // Los colores reales de la paleta de la pregunta, como en la maqueta del editor; sin paleta, los tonos del glifo.
        const colores = r.pinta === "categorias" && r.preguntas[0]?.opciones.length ? coloresDeEscala(r.preguntas[0].opciones) : undefined;
        const pregunta = r.pregunta ? `${r.pregunta}${r.masPreguntas ? ` +${r.masPreguntas}` : ""}` : "Sin pregunta";
        return (
          <span key={r.slot ?? i} className="pulso-f6-vg-ranura" style={estilo}>
            <GlifoGrafico tipo={r.graficador} opciones={glifo} colores={colores} className="pulso-f6-vg-ranura-gl" />
            <span className={`pulso-f6-vg-ranura-lb${r.pregunta ? "" : " is-vacio"}`}>{pregunta}</span>
          </span>
        );
      })}
    </span>
  );
}

export const MaquetaTarjeta = memo(MaquetaTarjetaBase);
