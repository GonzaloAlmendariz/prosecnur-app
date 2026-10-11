// Maqueta de la lámina: lo que el visor muestra sin pedir la vista previa del motor. Cada gráfico ocupa su ranura real
// (la composición del tipo de lámina) y dice qué muestra —tipo, pregunta y, si cruza más de una, las bases—; los textos
// son los de la lámina. Todo es seleccionable, igual que sobre la imagen: un gráfico abre su tarjeta y un texto, su
// campo. No necesita LibreOffice, así que abrir una lámina nunca obliga a esperar.

import { useMemo } from "react";
import type { Slide } from "../../../api/graficos";
import { ComposicionLamina } from "../iconos/ComposicionLamina";
import { composicionDe } from "../iconos/composicion";
import { GlifoGrafico } from "../iconos/GlifoGrafico";
import { IconoTipo } from "../iconos/IconoTipo";
import { graficadorDisplayName } from "../graficadorDisplay";
import { SLIDE_GRAF_SLOTS } from "../store";
import { useGraficosRegistry } from "../useGraficosRegistry";
import { useVariables } from "../useVariables";
import type { LaminaEnEstructura } from "./modeloEstructura";
import { ranurasDeMaqueta } from "./modeloMaqueta";
import { varianteDe } from "./selectores/tiposLamina";
import type { CampoTextoLamina } from "./ZonasTextoLamina";
import "./maquetaLamina.css";

type Props = {
  slide: Slide;
  lamina: LaminaEnEstructura;
  ranuraActiva: number | null;
  onRanura: (k: number) => void;
  onCambiar: (k: number) => void;
  onTexto: (campo: CampoTextoLamina) => void;
};

export function MaquetaLamina({ slide, lamina, ranuraActiva, onRanura, onCambiar, onTexto }: Props) {
  const { variables } = useVariables();
  const { graficadoresById } = useGraficosRegistry();
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const estructura = composicionDe(slide.tipo, slots).fuente === "estructura";
  const ranuras = useMemo(() => ranurasDeMaqueta(slide, variables), [slide, variables]);
  const antetitulo = lamina.antetituloHeredado;

  if (estructura) {
    // Portada, índice, separadores: su dibujo de estructura; el título sigue siendo editable con un clic.
    return (
      <div className="pulso-f6-maqueta is-estructura" data-maqueta-tipo={slide.tipo}>
        <ComposicionLamina tipo={slide.tipo} slots={slots} variante={varianteDe(slide)} />
        <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-titulo-estructura" onClick={() => onTexto("titulo")}>
          <span className="pulso-f6-maqueta-titulo">{lamina.titulo}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pulso-f6-maqueta" data-maqueta-tipo={slide.tipo}>
      <div className="pulso-f6-maqueta-cabecera">
        {slide.tipo !== "p_slide_seccion" && (
          <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-ante" onClick={() => onTexto("antetitulo")} aria-label="Editar antetítulo">
            {antetitulo || <span className="is-vacio">Antetítulo</span>}
          </button>
        )}
        <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-titulo" onClick={() => onTexto("titulo")} aria-label="Editar título">
          {lamina.titulo}
        </button>
      </div>

      {ranuras.map((r, i) => {
        const nombreTipo = r.graficador ? graficadorDisplayName(r.graficador, graficadoresById[r.graficador]) : null;
        const activa = r.k !== null && r.k === ranuraActiva;
        const contenido = (
          <>
            {r.graficador && <GlifoGrafico tipo={r.graficador} className="pulso-f6-maqueta-glifo" />}
            <span className="pulso-f6-maqueta-info">
            <span className="pulso-f6-maqueta-tipo">
              {r.graficador && <IconoTipo clase="grafico" tipo={r.graficador} size={16} />}
              <span>{nombreTipo ?? (r.k === null ? "Cifra" : "Sin gráfico")}</span>
              {r.k !== null && slots.length > 1 && <span className="pulso-f6-maqueta-num">{r.k}</span>}
            </span>
            {r.pregunta && (
              <span className="pulso-f6-maqueta-pregunta">
                {r.pregunta}
                {r.masPreguntas > 0 && <span className="pulso-f6-maqueta-mas"> y {r.masPreguntas} más</span>}
              </span>
            )}
            {r.bases.length > 0 && (
              <span className="pulso-f6-maqueta-bases">
                {r.bases.map((b) => <span key={b} className="pulso-f6-maqueta-base">{b}</span>)}
              </span>
            )}
            </span>
          </>
        );
        const estilo = { left: `${r.rect.x * 100}%`, top: `${r.rect.y * 100}%`, width: `${r.rect.w * 100}%`, height: `${r.rect.h * 100}%` };
        return r.k !== null ? (
          <button
            key={r.slot ?? i}
            type="button"
            className={`pulso-f6-maqueta-ranura${activa ? " is-activa" : ""}${r.graficador ? "" : " is-vacia"}${r.rect.w < 0.4 ? " is-angosta" : ""}`}
            style={estilo}
            aria-pressed={activa}
            aria-label={`Gráfico ${r.k}: ${nombreTipo ?? "sin gráfico"}${r.pregunta ? `, ${r.pregunta}` : ""}${r.bases.length ? `, ${r.bases.join(", ")}` : ""}`}
            onClick={() => onRanura(r.k as number)}
            onDoubleClick={() => onCambiar(r.k as number)}
          >
            {contenido}
          </button>
        ) : (
          <span key={i} className="pulso-f6-maqueta-ranura is-cifra" style={estilo} aria-hidden="true">{contenido}</span>
        );
      })}

      <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-pie" onClick={() => onTexto("base")} aria-label="Editar base">
        Base y nota al pie
      </button>
    </div>
  );
}
