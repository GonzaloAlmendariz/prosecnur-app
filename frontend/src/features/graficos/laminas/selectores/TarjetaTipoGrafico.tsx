// Tarjeta de un tipo de gráfico en «Tipo de gráfico» (F6.2; dirección F6 §4.4): el glifo propio con la paleta vigente,
// el nombre, para qué sirve y la marca de cómo sale cuando no es nativa. Si el tipo tiene variantes del catálogo, la
// tarjeta ofrece sus versiones con un control segmentado (ADR 0139, enmienda 2026-11-09: la variante es una versión del
// tipo, no una tarjeta aparte); con más de dos versiones van en columna, para no cortar sus nombres dentro de una
// palabra en el ancho de la tarjeta. El control es hermano del radio de la tarjeta, no va dentro de su etiqueta: Tab llega a
// él después de la tarjeta y su nombre accesible no se mezcla con el de ella. Si el tipo no se puede usar aquí, la línea
// de la tarjeta dice por qué. Radio: flechas recorren, Enter o doble clic usan.

import type { KeyboardEvent } from "react";
import { GlifoGrafico } from "../../iconos/GlifoGrafico";
import type { SalidaGrafico } from "../../iconos/catalogoTipos.generated";
import { RadioSegmentado } from "../../subpestanas/RadioSegmentado";
import { ETIQUETA_SALIDA } from "./tiposGrafico";
import type { VersionGrafico } from "./versionesGrafico";

type Props = {
  nombreGrupo: string;
  /** El graficador: valor del radio y glifo. */
  tipo: string;
  nombre: string;
  descripcion: string;
  salida: SalidaGrafico;
  /** Motivo por el que no se puede usar aquí (no disponible, no cabe en la ranura…). */
  bloqueo: string | null;
  elegida: boolean;
  /** La ranura ya tiene un gráfico de este tipo (en cualquiera de sus versiones). */
  actual: boolean;
  /** Las versiones del tipo (vacías si no tiene variantes), la que se muestra elegida y la actual de la ranura. */
  versiones?: readonly VersionGrafico[];
  version?: string;
  versionActual?: string | null;
  onElegirVersion?: (version: string) => void;
  onElegir: () => void;
  onAplicar: () => void;
};

export function TarjetaTipoGrafico({
  nombreGrupo, tipo, nombre, descripcion, salida, bloqueo, elegida, actual, versiones = [], version, versionActual, onElegirVersion, onElegir, onAplicar,
}: Props) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    onAplicar();
  };
  const conVersiones = versiones.length > 1 && !!onElegirVersion;
  return (
    <div
      className={`pulso-f6-tarjeta-tipo${conVersiones ? " is-con-versiones" : ""}`}
      title={bloqueo ?? (descripcion || undefined)}
      data-tipo-grafico={tipo}
      data-entrada-catalogo={version ?? tipo}
      data-bloqueo={bloqueo ? "" : undefined}
    >
      <label className="pulso-f6-tarjeta-elegir" onDoubleClick={onAplicar}>
        <input
          type="radio"
          className="pulso-f6-radio-oculto"
          name={nombreGrupo}
          value={tipo}
          checked={elegida}
          onChange={onElegir}
          onKeyDown={onKeyDown}
        />
        <span className="pulso-f6-tarjeta-lienzo is-grafico">
          <GlifoGrafico tipo={tipo} />
        </span>
        <span className="pulso-f6-tarjeta-nombre">{nombre}</span>
        <span className={`pulso-f6-tarjeta-meta${bloqueo ? " is-bloqueo" : ""}`}>{bloqueo ?? descripcion}</span>
        {(actual || salida !== "nativa" || bloqueo) && (
          <span className="pulso-f6-tarjeta-chips">
            {actual && <span className="pulso-f6-chip is-actual">Actual</span>}
            {salida !== "nativa" && <span className="pulso-f6-chip is-aviso">{ETIQUETA_SALIDA[salida].corto}</span>}
          </span>
        )}
      </label>
      {conVersiones && onElegirVersion && (
        <div className="pulso-f6-tarjeta-versiones">
          <RadioSegmentado
            etiqueta={`Versión de "${nombre}"`}
            opciones={versiones.map((v) => ({
              clave: v.id,
              rotulo: v.nombre,
              titulo: v.id === versionActual ? `${v.nombre} (versión actual)` : undefined,
            }))}
            valor={version ?? versiones[0].id}
            onCambiar={onElegirVersion}
            ancho
            multilinea
            vertical={versiones.length > 2}
          />
        </div>
      )}
    </div>
  );
}
