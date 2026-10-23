// «En el Word» de la tarjeta de un gráfico (F6.2, F-d): cómo sale este gráfico en el documento Word, con lo que el
// motor ya lee por gráfico (`enElWord.ts`). Sección intrínseca con encabezado propio; nada se recorta (C4).

import { useId } from "react";
import { leerModoInforme, leerModoLamina, MODOS_MULTI_INFORME, MODOS_MULTI_LAMINA, rotuloModo } from "../../word/modeloMultiWord";
import { FileText } from "../../../../vendor/lucide-react";
import type { ArgMetadata, GraficadorRef } from "../../../../api/graficos";
import { Switch } from "../../../../components/Switch";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "../../store";
import { leerEtiquetaCorta } from "../argsDatosGrafico";
import {
  admiteTitulo,
  aplicaRotuloWord,
  patchRotuloWord,
  repiteRotuloWord,
  tituloDeFigura,
  tituloWordPorDefecto,
  type TituloDeFigura,
} from "./enElWordModel";
import "./tarjetaGrafico.css";

type Props = { slideId: string; slot: string; valor: GraficadorRef; argsDelRegistro: readonly ArgMetadata[] };

const COMO_SALE: Record<TituloDeFigura, string> = {
  propio: "Sale como figura Gráfico N, con su título en la línea siguiente y la base centrada debajo.",
  lamina: "Sale como figura Gráfico N con el título de la lámina (pestaña Lámina) y la base centrada debajo.",
  lamina_y_pregunta: "Cada pregunta o tema sale como su propia figura Gráfico N, con el título de la lámina seguido del de la pregunta, y la base centrada debajo.",
};

export function EnElWord({ slideId, slot, valor, argsDelRegistro }: Props) {
  const id = useId();
  const presets = usePlanStore((s) => s.presets);
  const wPresets = usePlanStore((s) => s.wPresets);
  const tipo = usePlanStore((s) => s.plan.slides.find((x) => x.id === slideId)?.tipo);
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const set = (patch: Record<string, unknown>) => updateSlotArgs(slideId, slot, patch);
  const variable = typeof args.var === "string" ? args.var : "";
  const titulo = tituloDeFigura(valor.graficador, tipo ? (SLIDE_GRAF_SLOTS[tipo] ?? []).length : 1);
  const conTitulo = titulo === "propio" && admiteTitulo(argsDelRegistro);
  const conRotulo = aplicaRotuloWord(valor.graficador, args);
  const repite = conRotulo && repiteRotuloWord(valor.graficador, args, presets, wPresets);
  const modoEfectivo = leerModoLamina(args) || leerModoInforme(wPresets as Record<string, Record<string, unknown>>);
  const porDefecto = tituloWordPorDefecto(variable ? leerEtiquetaCorta(args, variable) : "", "");

  return (
    <section className="pulso-f6-word" aria-labelledby={`${id}-cab`} data-qa-geometry-group="graficos/f6-word" data-qa-geometry-contract="intrinsic" data-qa="en-el-word">
      <h4 className="pulso-f6-word-cabeza" id={`${id}-cab`}>
        <FileText size={14} aria-hidden="true" /> En el Word
      </h4>
      {/* En las multiapiladas cómo sale depende de su forma (W6): lo explica la ayuda del control de abajo. */}
      {valor.graficador !== "p_barras_multiapiladas" && <p className="pulso-f6-dato-ayuda">{COMO_SALE[titulo]}</p>}
      {conTitulo && (
        <div className="pulso-f6-dato is-apilado">
          <label className="pulso-f6-dato-rotulo" htmlFor={`${id}-titulo`}>Título de la figura</label>
          <input
            id={`${id}-titulo`}
            className="pulso-f6-input"
            value={typeof args.titulo === "string" ? args.titulo : ""}
            placeholder={porDefecto || "El texto de la pregunta"}
            aria-describedby={`${id}-titulo-ayuda`}
            onChange={(e) => set({ titulo: e.target.value.trim() ? e.target.value : null })}
          />
          <span className="pulso-f6-dato-ayuda" id={`${id}-titulo-ayuda`}>
            También encabeza este gráfico en la lámina. Vacío usa la etiqueta corta o la pregunta.
          </span>
        </div>
      )}
      {/* W6: cómo sale la multiapilada en el Word; vacío sigue al informe (Word, Gráficos). */}
      {valor.graficador === "p_barras_multiapiladas" && (
        <div className="pulso-f6-dato is-apilado">
          <label className="pulso-f6-dato-rotulo" htmlFor={`${id}-multi`}>Cómo sale en el Word</label>
          <select id={`${id}-multi`} className="pulso-f6-input" value={leerModoLamina(args)}
            onChange={(e) => set({ word_multiapiladas: e.target.value || null })}>
            <option value="">Como el informe ({rotuloModo(leerModoInforme(wPresets as Record<string, Record<string, unknown>>)).toLowerCase()})</option>
            {MODOS_MULTI_LAMINA.map((m) => <option key={m.clave} value={m.clave}>{m.rotulo}</option>)}
          </select>
          <span className="pulso-f6-dato-ayuda">{MODOS_MULTI_INFORME.find((m) => m.clave === modoEfectivo)?.detalle} Solo cambia el Word; la lámina del PPT no se toca.</span>
          {(modoEfectivo === "un_grafico" || modoEfectivo === "mismo_actor_escala" || modoEfectivo === "un_grafico_mismo_publico") && (
            <>
              <label className="pulso-f6-dato-rotulo" htmlFor={`${id}-titfig`}>Título de la figura en el Word</label>
              <input id={`${id}-titfig`} className="pulso-f6-input" value={typeof args.word_titulo_figura === "string" ? args.word_titulo_figura : ""}
                placeholder="Sin título" aria-describedby={`${id}-titfig-ayuda`}
                onChange={(e) => set({ word_titulo_figura: e.target.value.trim() ? e.target.value : null })} />
              <span className="pulso-f6-dato-ayuda" id={`${id}-titfig-ayuda`}>Encabeza la figura que junta varias preguntas o temas. Vacío, sale sin título.</span>
            </>
          )}
        </div>
      )}
      {conRotulo && (
        <div className="pulso-f6-dato">
          <span className="pulso-f6-dato-rotulo" id={`${id}-rotulo`}>Repetir la pregunta junto a la barra</span>
          <Switch
            checked={repite}
            ariaLabel="Repetir la pregunta junto a la barra en el Word"
            onToggle={() => set(patchRotuloWord(valor.graficador, args, presets, wPresets, !repite))}
          />
        </div>
      )}
    </section>
  );
}
