// "Lectura de la lista" (prototipo, Analítica › Categorías): si la lista es
// ordinal y si sus especiales van al final, como interruptores, y los códigos
// especiales que trae el estudio. "Es ordinal" parte de la detección del motor;
// al moverlo queda como decisión propia, que "Usar la detección" deshace.

import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteoDe } from "../../../lib/formatoNumero";
import { InterruptorOpcion } from "../InterruptorOpcion";
import type { CodigoEspecialDelEstudio } from "./modeloDeCategorias";

export function LecturaDeLaLista({
  listName,
  ordinal,
  ordinalAuto,
  ordinalPropio,
  conEspeciales,
  especialesAlFinal,
  especiales,
  onOrdinal,
  onUsarDeteccion,
  onEspecialesAlFinal,
}: {
  listName: string | null;
  ordinal: boolean;
  ordinalAuto: boolean;
  /** Hay una decisión guardada sobre si es ordinal. */
  ordinalPropio: boolean;
  /** La lista trae alguno de los códigos especiales. */
  conEspeciales: boolean;
  especialesAlFinal: boolean;
  especiales: readonly CodigoEspecialDelEstudio[];
  onOrdinal: (ordinal: boolean) => void;
  onUsarDeteccion: () => void;
  onEspecialesAlFinal: (alFinal: boolean) => void;
}) {
  return (
    <PanelDeMesa zona="lectura" titulo="Lectura de la lista">
      <div className="categorias-lectura" data-qa-geometry-group="analitica/categorias-lectura" data-qa-geometry-contract="intrinsic">
        {listName ? (
          <div className="categorias-interruptores">
            <InterruptorOpcion
              variante="linea"
              checked={ordinal}
              onToggle={() => onOrdinal(!ordinal)}
              titulo="Es ordinal"
              descripcion={ordinal
                ? "Conserva este orden en tablas y gráficos aunque se ordenen por frecuencia"
                : "Las tablas pueden ordenarla por frecuencia"}
            />
            {ordinalPropio ? (
              <div className="categorias-deteccion">
                <span>La detección la lee {ordinalAuto ? "ordinal" : "sin orden"}.</span>
                <PulsoButton variant="ghost" size="sm" onClick={onUsarDeteccion}>Usar la detección</PulsoButton>
              </div>
            ) : null}
            <InterruptorOpcion
              variante="linea"
              checked={especialesAlFinal}
              disabled={!conEspeciales}
              onToggle={() => onEspecialesAlFinal(!especialesAlFinal)}
              titulo="Especiales al final"
              descripcion={conEspeciales ? "No sabe, No responde y los demás especiales van después" : "Esta lista no trae códigos especiales"}
            />
          </div>
        ) : null}
        <div className="categorias-especiales">
          <h3 className="categorias-subtitulo">Códigos especiales del estudio</h3>
          {especiales.length > 0 ? (
            // C1: cada código mide lo que su etiqueta.
            <ul
              className="categorias-fichas"
              aria-label="Códigos especiales del estudio"
              data-qa-geometry-group="analitica/categorias-especiales"
              data-qa-geometry-contract="intrinsic"
            >
              {especiales.map((e) => (
                <li
                  key={e.code}
                  className="categorias-ficha"
                  title={e.casos > 0 ? `${formatoConteoDe(e.casos, "caso lo eligió", "casos lo eligieron")} en las preguntas del estudio` : "Nadie lo eligió en las preguntas del estudio"}
                  data-sin-casos={e.casos > 0 ? undefined : ""}
                >
                  <small>{e.code}</small>
                  {e.label || "Sin etiqueta"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="categorias-nota">Las preguntas del estudio no usan los códigos 90 a 99.</p>
          )}
        </div>
      </div>
    </PanelDeMesa>
  );
}
