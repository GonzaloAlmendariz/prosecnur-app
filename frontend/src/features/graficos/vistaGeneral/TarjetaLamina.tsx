// Tarjeta de una lámina en el Informe (F6.3; I1 del rediseño, 2026-10-14): su MAQUETA 16:9 (`MaquetaTarjeta`, la del
// editor reducida; ya no la miniatura del motor, que se queda en Láminas con «Previsualizar»), su número, el ícono de su
// tipo, su título y un ícono por gráfico configurado (inventario A0 C29). Marco fijo (C2): la maqueta llena la misma caja. Es una opción de la lista del
// capítulo: se elige, se arrastra y con doble clic (o Enter) se abre en Láminas.

import { memo, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { Slide } from "../../../api/graficos";
import { IconoTipo } from "../iconos/IconoTipo";
import { MaquetaTarjeta } from "./MaquetaTarjeta";
import type { TarjetaVistaGeneral } from "./modeloVistaGeneral";
import type { EstadoTarjeta } from "./estadoTarjetas";

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
  /** I3: lo más urgente de la lámina (aviso, colores, ranura vacía) o «Lista». */
  estado: EstadoTarjeta | undefined;
  /** I3: el resumen filtra por otro estado; la tarjeta se atenúa y no recibe el puntero. */
  fuera: boolean;
  slide: Slide | undefined;
  /** Nombre humano de cada gráfico configurado (mismo orden que `tarjeta.graficos`). */
  nombresGraficos: string[];
  seleccionada: boolean;
  /** Es la parada de Tab del clasificador (foco itinerante). */
  itinerante: boolean;
  arrastrada: boolean;
  soltar: "antes" | "despues" | null;
  manejadores: ManejadoresTarjeta;
};

const ROL: Record<TarjetaVistaGeneral["rol"], string> = { separador: "Capítulo", subcapitulo: "Subcapítulo", lamina: "" };

function TarjetaLaminaBase({ tarjeta, estado, fuera, slide, nombresGraficos, seleccionada, itinerante, arrastrada, soltar, manejadores }: Props) {
  const { lamina, rol, numero } = tarjeta;
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
    fuera ? "is-fuera" : "",
  ].filter(Boolean).join(" ");
  return (
    <li
      role="option"
      aria-selected={seleccionada}
      aria-label={`Lámina ${lamina.posicion}: ${lamina.titulo}. ${rotuloRol}${lamina.tipoLabel}.${detalleGraficos}${estado && estado.clave !== "lista" ? ` ${estado.texto}.` : ""}`}
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
      {/* I2 (2026-10-14): arriba el tipo de lámina con su ícono y el número; los glifos de cada gráfico van DENTRO de su
          ranura en la maqueta (I1), junto a su pregunta, y ya no en una fila de íconos al pie. */}
      <span className="pulso-f6-vg-cabeza" aria-hidden="true">
        <IconoTipo clase="lamina" tipo={lamina.tipo} size={16} className="pulso-f6-vg-tipo" />
        <span className="pulso-f6-vg-tipo-nombre">{ROL[rol] ? [ROL[rol], numero].filter(Boolean).join(" ") : lamina.tipoLabel}</span>
        <span className="pulso-f6-vg-pos">{lamina.posicion}</span>
        <span className="pulso-f6-vg-check" aria-hidden="true" />
      </span>
      <span className="pulso-f6-miniatura pulso-f6-vg-lienzo is-maqueta">
        {slide && <MaquetaTarjeta slide={slide} tipoLabel={lamina.tipoLabel} antetitulo={lamina.antetituloHeredado} />}
      </span>
      <span className="pulso-f6-vg-pie" aria-hidden="true">
        <span className="pulso-f6-vg-titulo" title={lamina.titulo}>{lamina.titulo}</span>
        {estado && <span className={`pulso-f6-vg-pill is-${estado.clave}`}><i aria-hidden="true" />{estado.texto}</span>}
      </span>
    </li>
  );
}

export const TarjetaLamina = memo(TarjetaLaminaBase);
