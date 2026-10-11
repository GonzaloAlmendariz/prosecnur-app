// Top Two Box y Bottom Two Box en la tarjeta de un gráfico de escala (F6.2, F-d; dirección F6 §7 A6/A14). Dos chips
// por caja sobre las categorías de la escala (`Top2BoxSelector`), sin args de estilo; la Bottom Two Box va al lado del
// Top Two Box (en multilista y en láminas de varios gráficos, sólo para quitarla: aún no sale en la lámina nativa).
// Lo que se guarda y por qué: `twoBox.ts`. Superficie intrínseca: crece con sus chips, el scroll es del
// cuerpo del inspector (C4); el vacío (sin pregunta, sin escala, error) vive dentro de la sección (C3/C5).

import { useId } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, RefreshCw, Rows3 } from "../../../../vendor/lucide-react";
import type { GraficadorRef } from "../../../../api/graficos";
import { Switch } from "../../../../components/Switch";
import { useSession } from "../../../../lib/SessionContext";
import { useGraficosReportScope } from "../../reportScope";
import { usePlanStore } from "../../store";
import { varCalificada } from "../ordenCategorias";
import { useCategoriasGrafico } from "../useCategoriasGrafico";
import { ChipsTwoBox } from "./ChipsTwoBox";
import {
  bottomDisponible,
  categoriasElegibles,
  composicionDeLamina,
  formaTwoBox,
  leerTwoBox,
  patchTwoBox,
  preguntaDeEscala,
  type BottomDisponible,
  type Caja,
  type CambioTwoBox,
  type Composicion,
} from "./twoBox";
import { NOTA_TOP_EN_WORD, leerTopEnWord, patchTopEnWord } from "./twoBoxWord";
import "./tarjetaGrafico.css";

type Props = { slideId: string; slot: string; valor: GraficadorRef; onAbrirBloques: () => void };

export function TwoBoxGrafico({ slideId, slot, valor, onAbrirBloques }: Props) {
  const tipoLamina = usePlanStore((s) => s.plan.slides.find((x) => x.id === slideId)?.tipo);
  const presets = usePlanStore((s) => s.presets);
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const composicion = composicionDeLamina(tipoLamina);
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const forma = formaTwoBox(valor.graficador, args);
  if (!forma) return null;
  if (forma === "por_bloque") {
    const bottom = bottomDisponible(valor.graficador, args, presets, composicion);
    return (
      <div className="pulso-f6-twobox" data-qa-geometry-group="graficos/f6-twobox" data-qa-geometry-contract="intrinsic" data-qa="twobox-por-bloque">
        <div className="pulso-f6-dato">
          <span className="pulso-f6-dato-rotulo">Top Two Box</span>
          <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" onClick={onAbrirBloques}>
            <Rows3 size={14} aria-hidden="true" />
            Cada bloque el suyo · Editar…
          </button>
        </div>
        <FilaBottom
          bottom={bottom}
          onToggle={() => updateSlotArgs(slideId, slot, patchTwoBox(valor.graficador, args, presets, { caja: "bottom", activa: !bottom.activa }, composicion))}
        />
      </div>
    );
  }
  return <CajasDeEscala slideId={slideId} slot={slot} valor={valor} composicion={composicion} />;
}

/** «Bottom Two Box al lado»: el interruptor y, donde la lámina nativa aún no la dibuja, por qué no se enciende. */
function FilaBottom({ bottom, id, onToggle }: { bottom: BottomDisponible; id?: string; onToggle: () => void }) {
  return (
    <div className="pulso-f6-dato" data-qa="twobox-bottom">
      <span className="pulso-f6-dato-rotulo" id={id}>Bottom Two Box al lado</span>
      <Switch
        checked={bottom.activa}
        disabled={!bottom.editable}
        ariaLabel="Columna Bottom Two Box al lado del Top Two Box"
        onToggle={onToggle}
      />
      {bottom.nota && <span className="pulso-f6-dato-ayuda pulso-f6-twobox-nota">{bottom.nota}</span>}
    </div>
  );
}

function CajasDeEscala({ slideId, slot, valor, composicion }: Omit<Props, "onAbrirBloques"> & { composicion: Composicion }) {
  const id = useId();
  const presets = usePlanStore((s) => s.presets);
  const wPresets = usePlanStore((s) => s.wPresets);
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const pregunta = preguntaDeEscala(valor.graficador, args);
  const estado = leerTwoBox(valor.graficador, args, presets);
  const cats = useCategoriasGrafico(pregunta ? varCalificada(pregunta, baseActiva, scope) : "", scope);
  if (!estado) return null;
  const enWord = leerTopEnWord(valor.graficador, args, presets, wPresets);
  const bottom = bottomDisponible(valor.graficador, args, presets, composicion);

  const cambiar = (c: CambioTwoBox) => updateSlotArgs(slideId, slot, patchTwoBox(valor.graficador, args, presets, c, composicion));
  const categorias = cats.fase === "lista" ? categoriasElegibles(cats.datos.categorias, args.excluir_opciones) : [];

  const escala = (caja: Caja, nombre: "Top Two Box" | "Bottom Two Box", clave: "top" | "bottom") => {
    if (!pregunta) return <p className="pulso-f6-twobox-estado">Elige la pregunta para declarar su {nombre}.</p>;
    if (cats.fase === "cargando") {
      return (
        <p className="pulso-f6-twobox-estado" role="status">
          <Loader2 size={13} className="pulso-spin" aria-hidden="true" /> Leyendo la escala de la pregunta…
        </p>
      );
    }
    if (cats.fase === "error") {
      return (
        <p className="pulso-f6-twobox-estado is-error" role="alert">
          {cats.mensaje}{" "}
          <button type="button" className="pulso-f6-texto-boton" onClick={cats.reintentar}>
            <RefreshCw size={12} aria-hidden="true" /> Reintentar
          </button>
        </p>
      );
    }
    if (cats.fase === "sin_lista" || !categorias.length) {
      return <p className="pulso-f6-twobox-estado">La pregunta no tiene una escala con categorías: no hay {nombre} que sumar.</p>;
    }
    if (categorias.length <= 2) {
      // `.box_decidir` no dibuja un box que cubre la escala entera («cubre_escala»): sería 100 % en todas las filas.
      return <p className="pulso-f6-twobox-estado">Con {categorias.length === 1 ? "una categoría" : "dos categorías"} el {nombre} sumaría la escala entera: el motor no lo dibuja.</p>;
    }
    return (
      <ChipsTwoBox caja={caja} nombre={nombre} categorias={categorias} onChange={(etiquetas) => cambiar({ caja: clave, etiquetas })} />
    );
  };

  return (
    <div className="pulso-f6-twobox" data-qa-geometry-group="graficos/f6-twobox" data-qa-geometry-contract="intrinsic" data-qa="twobox">
      <div className="pulso-f6-dato">
        <span className="pulso-f6-dato-rotulo" id={`${id}-top`}>Top Two Box</span>
        <Switch
          checked={estado.top.activa}
          ariaLabel="Columna Top Two Box"
          onToggle={() => cambiar({ caja: "top", activa: !estado.top.activa })}
        />
      </div>
      {estado.top.activa ? (
        <div className="pulso-f6-twobox-caja" role="group" aria-labelledby={`${id}-top`}>{escala(estado.top, "Top Two Box", "top")}</div>
      ) : (
        <p className="pulso-f6-twobox-estado">Sin columna Top Two Box: la lámina y el Word salen sólo con las barras.</p>
      )}
      {enWord.aplica && (
        <div className="pulso-f6-dato">
          <span className="pulso-f6-dato-rotulo">
            También en el Word
          </span>
          <Switch
            checked={enWord.sale}
            disabled={!enWord.editable}
            ariaLabel="Top Two Box también en el Word"
            onToggle={() => updateSlotArgs(slideId, slot, patchTopEnWord(valor.graficador, args, presets, wPresets, !enWord.sale))}
          />
          {enWord.motivo && (
            <span className="pulso-f6-dato-ayuda pulso-f6-twobox-nota">{NOTA_TOP_EN_WORD[enWord.motivo]}</span>
          )}
        </div>
      )}
      {bottom.ofrecer && (
        <>
          <FilaBottom bottom={bottom} id={`${id}-bottom`} onToggle={() => cambiar({ caja: "bottom", activa: !estado.bottom.activa })} />
          {estado.bottom.activa && (
            <div className="pulso-f6-twobox-caja" role="group" aria-labelledby={`${id}-bottom`}>{escala(estado.bottom, "Bottom Two Box", "bottom")}</div>
          )}
        </>
      )}
    </div>
  );
}
