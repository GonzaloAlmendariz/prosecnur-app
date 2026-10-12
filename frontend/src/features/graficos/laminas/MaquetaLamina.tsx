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
import { Plus } from "../../../vendor/lucide-react";
import { graficadorDisplayName } from "../graficadorDisplay";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../store";
import { useGraficosRegistry } from "../useGraficosRegistry";
import { useVariables } from "../useVariables";
import type { LaminaEnEstructura } from "./modeloEstructura";
import { baseAutomatica, ranurasDeMaqueta } from "./modeloMaqueta";
import { varianteDe } from "./selectores/tiposLamina";
import { camposTextoDe, type CampoTextoLamina } from "./ZonasTextoLamina";
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
  const { graficadoresById, slidesById } = useGraficosRegistry();
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const estructura = composicionDe(slide.tipo, slots).fuente === "estructura";
  const presets = usePlanStore((s) => s.presets);
  const paletas = usePlanStore((s) => s.paletas);
  const vinculos = usePlanStore((s) => s.paletasVinculos);
  const ranuras = useMemo(() => ranurasDeMaqueta(slide, variables, presets, { paletas, vinculos }), [slide, variables, presets, paletas, vinculos]);
  const antetitulo = lamina.antetituloHeredado;
  // El pie dice lo que saldrá: la base escrita por el usuario o, si no hay, la que arma el motor.
  const baseEscrita = typeof (slide.payload as Record<string, unknown>).base === "string" ? ((slide.payload as Record<string, unknown>).base as string).trim() : "";
  const formatoBase = typeof (presets.base as Record<string, unknown> | undefined)?.formato === "string" ? ((presets.base as Record<string, unknown>).formato as string) : undefined;
  const baseAuto = useMemo(() => baseAutomatica(slide, variables, formatoBase), [slide, variables, formatoBase]);
  const campos = camposTextoDe(slide.tipo, slidesById[slide.tipo]?.args, !estructura);

  if (estructura) {
    // Portada, índice, separadores: su dibujo de estructura; el título sigue siendo editable con un clic.
    return (
      <div className="pulso-f6-maqueta is-estructura" data-maqueta-tipo={slide.tipo}>
        <ComposicionLamina tipo={slide.tipo} slots={slots} variante={varianteDe(slide)} />
        {campos.has("titulo") && (
          <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-titulo-estructura" onClick={() => onTexto("titulo")} aria-label="Editar título">
            <span className="pulso-f6-maqueta-titulo">{lamina.titulo}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="pulso-f6-maqueta" data-maqueta-tipo={slide.tipo}>
      <div className="pulso-f6-maqueta-cabecera">
        {campos.has("antetitulo") && (
          <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-ante" onClick={() => onTexto("antetitulo")} aria-label="Editar antetítulo">
            {antetitulo || <span className="is-vacio">Antetítulo</span>}
          </button>
        )}
        {campos.has("titulo") ? (
          <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-titulo" onClick={() => onTexto("titulo")} aria-label="Editar título">
            {lamina.titulo}
          </button>
        ) : (
          <span className="pulso-f6-maqueta-titulo">{lamina.titulo}</span>
        )}
      </div>

      {ranuras.map((r, i) => {
        const nombreTipo = r.graficador ? graficadorDisplayName(r.graficador, graficadoresById[r.graficador]) : null;
        const activa = r.k !== null && r.k === ranuraActiva;
        const contenido = (
          <>
            {r.graficador && <GlifoGrafico tipo={r.graficador} className="pulso-f6-maqueta-glifo" opciones={r.twoBox} />}
            <span className="pulso-f6-maqueta-info">
            {r.k !== null && !r.graficador ? (
              <span className="pulso-f6-maqueta-elegir"><Plus size={16} aria-hidden="true" /> Elegir gráfico</span>
            ) : (
            <span className="pulso-f6-maqueta-tipo">
              {r.graficador && <IconoTipo clase="grafico" tipo={r.graficador} size={16} />}
              <span>{nombreTipo ?? "Cifra"}</span>
              {r.k !== null && slots.length > 1 && <span className="pulso-f6-maqueta-num">{r.k}</span>}
            </span>
            )}
            {r.graficador && !r.pregunta && <span className="pulso-f6-maqueta-falta">Falta elegir la pregunta</span>}
            <span className="pulso-f6-maqueta-preguntas">
              {r.preguntas.map((q, j) => (
                <span key={j} className="pulso-f6-maqueta-pregunta-caja">
                  <span className="pulso-f6-maqueta-pregunta-item">{q.titulo}</span>
                  <EscalaMaqueta opciones={q.opciones} />
                </span>
              ))}
            </span>
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
            // Una ranura vacía va directo a «¿Qué gráfico?»; una con gráfico abre su tarjeta.
            onClick={() => (r.graficador ? onRanura(r.k as number) : onCambiar(r.k as number))}
            onDoubleClick={() => onCambiar(r.k as number)}
          >
            {contenido}
          </button>
        ) : (
          <span key={i} className="pulso-f6-maqueta-ranura is-cifra" style={estilo} aria-hidden="true">{contenido}</span>
        );
      })}

      {campos.has("base") && (
        <button type="button" className="pulso-f6-maqueta-zona pulso-f6-maqueta-pie" onClick={() => onTexto("base")} aria-label="Editar base">
          {baseEscrita || baseAuto || "Base del gráfico"}
        </button>
      )}
    </div>
  );
}

/** La escala de una pregunta con los colores que le tocan; una opción sin color se marca, para que se note que falta. */
function EscalaMaqueta({ opciones }: { opciones: readonly { rotulo: string; color: string | null }[] }) {
  if (!opciones.length) return null;
  return (
    <span className="pulso-f6-maqueta-escala">
      {opciones.map((o) => (
        <span key={o.rotulo} className="pulso-f6-maqueta-opcion" title={o.color ? o.rotulo : `${o.rotulo}: sin color definido`}>
          <i className={o.color ? undefined : "is-sin-color"} style={o.color ? { background: o.color } : undefined} />
          {o.rotulo}
        </span>
      ))}
    </span>
  );
}
