// «Colores por serie» en la tarjeta de un gráfico (C45, A10 W-D): una fila por serie con su muestra de color, el nombre
// legible del color y su procedencia. Por defecto, el del recetario; elegir otro lo guarda como «Propio» y «Volver al
// recetario» borra la clave (ADR 0094). Sólo en gráficos cuya lámina nativa lee el color (`coloresGraficoModel.ts`).
// Superficie intrínseca: crece con sus series y el scroll es del cuerpo del inspector (C4); su vacío vive dentro (C3).

import { useId } from "react";
import { RotateCcw } from "../../../../vendor/lucide-react";
import type { ArgMetadata, GraficadorRef } from "../../../../api/graficos";
import { SelloProcedencia } from "../../estilo/SelloProcedencia";
import { graficadorToPresetType } from "../../graficadorPresetMap";
import { usePlanStore } from "../../store";
import { coloresDelGrafico, coloresEfectivos, leerColores, nombreDeColor, patchColor, type ColorDeSerie } from "./coloresGraficoModel";
import "../../estilo/estilo.css";
import "./coloresGrafico.css";

type Props = { slideId: string; slot: string; valor: GraficadorRef; argsDelRegistro: readonly ArgMetadata[] };

export function ColoresGrafico({ slideId, slot, valor, argsDelRegistro }: Props) {
  const presets = usePlanStore((s) => s.presets);
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  const config = coloresDelGrafico(valor.graficador, argsDelRegistro);
  if (!config) return null;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const nombres = config.nombres(args);
  const familia = graficadorToPresetType(valor.graficador);
  const heredados = leerColores(familia ? presets[familia]?.[config.arg] : undefined, nombres);
  const filas = coloresEfectivos(nombres, leerColores(args[config.arg], nombres), heredados);
  const elegir = (nombre: string, hex: string | null) =>
    updateSlotArgs(slideId, slot, patchColor(config.arg, args[config.arg], nombres, heredados, nombre, hex));
  return <ListaColores rotulo={config.rotulo} filas={filas} onElegir={elegir} />;
}

type ListaProps = { rotulo: string; filas: readonly ColorDeSerie[]; onElegir: (nombre: string, hex: string | null) => void };

/** La lista pintada, sin store: lo que prueban los tests de render. */
export function ListaColores({ rotulo, filas, onElegir }: ListaProps) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={`${id}-rot`} className="pulso-f6-dato is-apilado pulso-f6-colores" data-qa-geometry-group="graficos/f6-colores" data-qa-geometry-contract="intrinsic" data-qa="colores-grafico">
      <span id={`${id}-rot`} className="pulso-f6-dato-rotulo">{rotulo}</span>
      {filas.length === 0 ? (
        <span className="pulso-f6-dato-ayuda">Este gráfico aún no tiene series: salen de los temas que declara el plan.</span>
      ) : (
        <>
          <ul className="pulso-f6-colores-lista">
            {filas.map((f, i) => (
              <FilaColor key={f.nombre} fila={f} idDesc={`${id}-c${i}`} onElegir={onElegir} />
            ))}
          </ul>
          <span className="pulso-f6-dato-ayuda">
            Cambia la línea en la lámina y en el Word. Las series sin color propio toman, en orden, los colores libres del recetario.
          </span>
        </>
      )}
    </div>
  );
}

function FilaColor({ fila, idDesc, onElegir }: { fila: ColorDeSerie; idDesc: string; onElegir: (nombre: string, hex: string | null) => void }) {
  const { nombre, hex, origen } = fila;
  const legible = nombreDeColor(hex);
  return (
    <li className="pulso-f6-colores-fila" data-qa-geometry-member="color-serie">
      <input
        type="color"
        className={`pulso-f6-colores-muestra${hex ? "" : " is-automatico"}`}
        value={(hex ?? "#FFFFFF").toLowerCase()}
        aria-label={`Color de la serie «${nombre}»`}
        aria-describedby={idDesc}
        onChange={(e) => onElegir(nombre, e.target.value)}
      />
      <span className="pulso-f6-colores-nombre">{nombre}</span>
      <span className="pulso-f6-colores-valor" id={idDesc}>{legible}{hex && legible !== hex ? ` · ${hex}` : ""}</span>
      {origen === "informe" ? (
        <span className="pulso-f6-estilo-sello is-recetario">Del informe</span>
      ) : (
        <SelloProcedencia procedencia={origen} />
      )}
      {origen === "propio" ? (
        <button
          type="button"
          className="pulso-f6-icono-boton"
          aria-label={`Volver al color por defecto en «${nombre}»`}
          title="Volver al valor por defecto"
          onClick={() => onElegir(nombre, null)}
        >
          <RotateCcw size={14} aria-hidden="true" />
        </button>
      ) : (
        <span className="pulso-f6-colores-hueco" aria-hidden="true" />
      )}
    </li>
  );
}
