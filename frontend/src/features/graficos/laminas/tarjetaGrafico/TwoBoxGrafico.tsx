// Barra extra en la tarjeta de un gráfico de escala (F6.2, F-d; dirección F6 §7 A6/A14): UN control (`BarraExtraControl`)
// con el interruptor y los chips Top Two Box / Bottom Two Box / Conteos, sin args de estilo. Lo que se guarda y por qué:
// `twoBox.ts`. En multilista la decisión es de cada bloque: aquí se fija la de la lámina y se resume lo que cada bloque
// hace. Superficie intrínseca: crece con sus chips, el scroll es del cuerpo del inspector (C4); el vacío (sin pregunta,
// sin escala, error) vive dentro del control (C3/C5).

import { useLocation } from "react-router-dom";
import { Rows3 } from "../../../../vendor/lucide-react";
import type { GraficadorRef } from "../../../../api/graficos";
import { useSession } from "../../../../lib/SessionContext";
import { resumenDeBloques, type BarraExtra } from "../../barraExtra";
import { BarraExtraControl, type EscalaBarraExtra } from "../../BarraExtraControl";
import { useGraficosReportScope } from "../../reportScope";
import { usePlanStore } from "../../store";
import { varCalificada } from "../ordenCategorias";
import { useCategoriasGrafico } from "../useCategoriasGrafico";
import {
  bottomDisponible,
  categoriasElegibles,
  composicionDeLamina,
  formaTwoBox,
  leerTwoBox,
  patchTwoBox,
  preguntaDeEscala,
  valorHeredado,
  type CambioTwoBox,
  type Composicion,
} from "./twoBox";
import "./tarjetaGrafico.css";

type Props = { slideId: string; slot: string; valor: GraficadorRef; onAbrirBloques: () => void };

const NOTA_HEREDADA = "Viene del estilo del informe; cambiarla aquí solo afecta a este gráfico.";

export function TwoBoxGrafico({ slideId, slot, valor, onAbrirBloques }: Props) {
  const tipoLamina = usePlanStore((s) => s.plan.slides.find((x) => x.id === slideId)?.tipo);
  const composicion = composicionDeLamina(tipoLamina);
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const forma = formaTwoBox(valor.graficador, args);
  if (!forma) return null;
  if (forma === "por_bloque") return <BarraExtraPorBloque slideId={slideId} slot={slot} valor={valor} composicion={composicion} onAbrirBloques={onAbrirBloques} />;
  return <BarraExtraDeEscala slideId={slideId} slot={slot} valor={valor} composicion={composicion} />;
}

type PropsCuerpo = Omit<Props, "onAbrirBloques"> & { composicion: Composicion };

/** La barra extra a nivel de lámina de una multilista; los bloques con barra propia la sustituyen. */
function BarraExtraPorBloque({ slideId, slot, valor, composicion, onAbrirBloques }: PropsCuerpo & { onAbrirBloques: () => void }) {
  const presets = usePlanStore((s) => s.presets);
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const estado = leerTwoBox(valor.graficador, args, presets);
  if (!estado) return null;
  const bottom = bottomDisponible(valor.graficador, args, presets, composicion);
  const resumen = resumenDeBloques(args.bloques, estado.valor);
  const sinCategorias = resumen.sinCategorias + resumen.conBottomSinCategorias;
  const heredada = estado.origen === "lamina" ? undefined : NOTA_HEREDADA;
  return (
    <div className="pulso-f6-twobox" data-qa-geometry-group="graficos/f6-twobox" data-qa-geometry-contract="intrinsic" data-qa="twobox-por-bloque">
      <BarraExtraControl
        valor={estado.valor}
        onChange={(v: BarraExtra) => updateSlotArgs(slideId, slot, patchTwoBox(valor.graficador, args, presets, { valor: v }, composicion))}
        escala={{ fase: "externa", nota: "Las categorías de cada box se eligen en su bloque." }}
        etiquetas={{}}
        heredada={heredada}
        bottomBloqueado={bottom.editable ? undefined : bottom.nota}
        ariaLabel="Barra extra de todos los bloques"
        ayuda="Muestra una columna a la derecha de cada barra. Cada bloque puede tener la suya."
      />
      <p className="pulso-f6-dato-ayuda">
        {resumen.total === 0 ? "Aún no hay bloques." : `${resumen.conBarra} de ${resumen.total} ${resumen.total === 1 ? "bloque lleva" : "bloques llevan"} barra extra${resumen.propios > 0 ? `; ${resumen.propios} ${resumen.propios === 1 ? "tiene" : "tienen"} la suya propia` : ""}. `}
        {sinCategorias > 0 ? `Falta elegir categorías en ${sinCategorias} ${sinCategorias === 1 ? "bloque" : "bloques"}. ` : ""}
        <button type="button" className="pulso-f6-texto-boton" onClick={onAbrirBloques}>
          <Rows3 size={13} aria-hidden="true" /> Ajustar por bloque…
        </button>
      </p>
    </div>
  );
}

function BarraExtraDeEscala({ slideId, slot, valor, composicion }: PropsCuerpo) {
  const presets = usePlanStore((s) => s.presets);
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const pregunta = preguntaDeEscala(valor.graficador, args);
  const estado = leerTwoBox(valor.graficador, args, presets);
  const cats = useCategoriasGrafico(pregunta ? varCalificada(pregunta, baseActiva, scope) : "", scope);
  if (!estado) return null;
  const bottom = bottomDisponible(valor.graficador, args, presets, composicion);
  const cambiar = (c: CambioTwoBox) => updateSlotArgs(slideId, slot, patchTwoBox(valor.graficador, args, presets, c, composicion));
  const categorias = cats.fase === "lista" ? categoriasElegibles(cats.datos.categorias, args.excluir_opciones) : [];
  // Una pregunta cuyas respuestas no van de menos a más (género, carrera) no lleva Top ni Bottom Two Box. Si el estilo del
  // informe los pide, el motor no los dibuja y avisarlo en cada Sí/No es ruido: se muestra sin ellos (queda Conteos, que
  // sí vale en cualquier pregunta). Si esta lámina los encendió, se muestran para poder apagarlos.
  const noOrdenada = cats.fase === "lista" && !cats.datos.ordinal;
  const sinBoxes: BarraExtra = estado.conteos ? ["conteos"] : false;
  const mostrado: BarraExtra = noOrdenada && estado.origen !== "lamina" ? sinBoxes : estado.valor;

  let escala: EscalaBarraExtra;
  if (!pregunta) escala = { fase: "sin_escala", mensaje: "Elige la pregunta para declarar su Top Two Box." };
  else if (cats.fase === "cargando") escala = { fase: "cargando" };
  else if (cats.fase === "error") escala = { fase: "error", mensaje: cats.mensaje, reintentar: cats.reintentar };
  else if (noOrdenada) escala = { fase: "sin_escala", mensaje: "Sus respuestas no van de menos a más: no hay Top ni Bottom Two Box que sumar. Usa Conteos o apaga la barra." };
  else if (cats.fase === "sin_lista" || !categorias.length) escala = { fase: "sin_escala", mensaje: "La pregunta no tiene una escala con categorías: no hay Top ni Bottom Two Box que sumar. Usa Conteos." };
  else escala = { fase: "lista", categorias };

  const heredaDe = valorHeredado(valor.graficador, args, presets);
  const heredada = estado.origen === "lamina" ? undefined : NOTA_HEREDADA;
  return (
    <div className="pulso-f6-twobox" data-qa-geometry-group="graficos/f6-twobox" data-qa-geometry-contract="intrinsic" data-qa="twobox">
      <BarraExtraControl
        valor={mostrado}
        onChange={(v) => cambiar({ valor: v })}
        escala={escala}
        etiquetas={{ top2box: estado.top.etiquetas, bottom2box: estado.bottom.etiquetas }}
        onEtiquetas={(caja, etiquetas) => cambiar({ caja: caja === "top2box" ? "top" : "bottom", etiquetas })}
        categoriasDelInforme={{ top2box: estado.top.delInforme, bottom2box: estado.bottom.delInforme }}
        heredada={heredada}
        bottomBloqueado={bottom.editable ? undefined : bottom.nota}
        restablecer={estado.origen === "lamina" && heredaDe !== null
          ? { rotulo: "Volver a la del informe", onClick: () => cambiar({ valor: heredaDe }) }
          : undefined}
      />
    </div>
  );
}
