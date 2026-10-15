// Tarjeta de una lámina en la Vista general (F6.3): miniatura 16:9 real (176 × 99, mismo lote y caché que la tira), su
// número, el ícono de su tipo, su título y un ícono por gráfico configurado (inventario A0 C29). Marco fijo (C2): toda
// variante de la miniatura —esqueleto, imagen, composición, error— ocupa la misma caja. Es una opción de la lista del
// capítulo: se elige, se arrastra y con doble clic (o Enter) se abre en Láminas.

import { memo, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { Slide } from "../../../api/graficos";
import { IconoTipo } from "../iconos/IconoTipo";
import { ContenidoMiniatura } from "../laminas/miniaturas/ContenidoMiniatura";
import type { EntradaMiniatura } from "../laminas/miniaturas/loteMiniaturas";
import { rotuloEstado, vistaDeMiniatura } from "../laminas/miniaturas/vistaMiniatura";
import type { TarjetaVistaGeneral } from "./modeloVistaGeneral";

export type ManejadoresTarjeta = {
  onClic: (id: string, e: MouseEvent<HTMLElement>) => void;
  onAbrir: (id: string) => void;
  onTecla: (id: string, e: KeyboardEvent<HTMLElement>) => void;
  onArrastrar: (id: string, e: DragEvent<HTMLElement>) => void;
  onSobre: (id: string, e: DragEvent<HTMLElement>) => void;
  onSoltar: (e: DragEvent<HTMLElement>) => void;
  onFinArrastre: () => void;
  onFoco: (id: string) => void;
};

type Props = {
  tarjeta: TarjetaVistaGeneral;
  slide: Slide | undefined;
  entrada: EntradaMiniatura | undefined;
  imagenPrevia: string | undefined;
  /** Nombre humano de cada gráfico configurado (mismo orden que `tarjeta.graficos`). */
  nombresGraficos: string[];
  seleccionada: boolean;
  /** Es la parada de Tab del clasificador (foco itinerante). */
  itinerante: boolean;
  arrastrada: boolean;
  soltar: "antes" | "despues" | null;
  manejadores: ManejadoresTarjeta;
};

const MAX_ICONOS = 6;
const ROL: Record<TarjetaVistaGeneral["rol"], string> = { separador: "Capítulo", subcapitulo: "Subcapítulo", lamina: "" };

function TarjetaLaminaBase({ tarjeta, slide, entrada, imagenPrevia, nombresGraficos, seleccionada, itinerante, arrastrada, soltar, manejadores }: Props) {
  const { lamina, rol, numero, graficos } = tarjeta;
  const { vista, src } = vistaDeMiniatura(entrada, imagenPrevia);
  const detalleGraficos = lamina.ranuras === 0
    ? ""
    : lamina.ranurasLlenas === 0
      ? " Sin gráficos."
      : ` ${lamina.ranurasLlenas} de ${lamina.ranuras} con gráfico: ${nombresGraficos.join(", ")}.`;
  const rotuloRol = ROL[rol] ? `${[ROL[rol], numero].filter(Boolean).join(" ")}. ` : "";
  const clases = [
    "pulso-f6-vg-tarjeta",
    `is-${rol}`,
    seleccionada ? "is-seleccionada" : "",
    arrastrada ? "is-arrastrada" : "",
    soltar ? `is-soltar-${soltar}` : "",
  ].filter(Boolean).join(" ");
  return (
    <li
      role="option"
      aria-selected={seleccionada}
      aria-label={`Lámina ${lamina.posicion}: ${lamina.titulo}. ${rotuloRol}${lamina.tipoLabel}.${detalleGraficos}${rotuloEstado(vista)}`}
      tabIndex={itinerante ? 0 : -1}
      className={clases}
      data-vg-tarjeta={lamina.id}
      data-qa-geometry-member
      draggable
      onClick={(e) => manejadores.onClic(lamina.id, e)}
      onDoubleClick={() => manejadores.onAbrir(lamina.id)}
      onKeyDown={(e) => manejadores.onTecla(lamina.id, e)}
      onFocus={() => manejadores.onFoco(lamina.id)}
      onDragStart={(e) => manejadores.onArrastrar(lamina.id, e)}
      onDragOver={(e) => manejadores.onSobre(lamina.id, e)}
      onDrop={manejadores.onSoltar}
      onDragEnd={manejadores.onFinArrastre}
    >
      <span className={`pulso-f6-miniatura pulso-f6-vg-lienzo is-${vista}`}>
        <ContenidoMiniatura vista={vista} src={src} slide={slide} lamina={lamina} />
        {rol !== "lamina" && numero && (
          <span className="pulso-f6-vg-rol" aria-hidden="true">{ROL[rol]} {numero}</span>
        )}
        <span className="pulso-f6-miniatura-num" aria-hidden="true">{lamina.posicion}</span>
        <span className="pulso-f6-vg-check" aria-hidden="true" />
      </span>
      <span className="pulso-f6-vg-pie" aria-hidden="true">
        <IconoTipo clase="lamina" tipo={lamina.tipo} size={16} className="pulso-f6-vg-tipo" />
        <span className="pulso-f6-vg-titulo" title={lamina.titulo}>{lamina.titulo}</span>
        {lamina.ranuras > 0 && (
          <span className={`pulso-f6-vg-graficos${lamina.ranurasLlenas < lamina.ranuras ? " is-incompleta" : ""}`}>
            {/* Hasta seis, que es lo más que lleva una lámina («Seis gráficos»): con cuatro y «+2» la tarjeta escondía
                justo los gráficos de las láminas más cargadas (Gonzalo, 2026-10-14). */}
            {graficos.slice(0, MAX_ICONOS).map((g, i) => (
              <IconoTipo key={`${g}-${i}`} clase="grafico" tipo={g} size={16} />
            ))}
            {graficos.length > MAX_ICONOS && <span className="pulso-f6-vg-mas">+{graficos.length - MAX_ICONOS}</span>}
            {lamina.ranurasLlenas < lamina.ranuras && (
              <span className="pulso-f6-vg-vacias">{lamina.ranuras - lamina.ranurasLlenas} sin gráfico</span>
            )}
          </span>
        )}
      </span>
    </li>
  );
}

export const TarjetaLamina = memo(TarjetaLaminaBase);
