// Carga › Bases: "Actualizar" una fuente (prototipo `carga-actualizar`,
// `-leyendo` y `-error`), en `panel=actualizar-fuente&foco=<base>`. Recorrido de
// tres pasos: elegir el archivo, ver qué cambia y aplicar. Nada se escribe hasta
// "Aplicar actualización"; al aplicar el motor guarda una copia y el panel
// ofrece volver a ella mientras sea legible. La lectura desde la plataforma no
// tiene vista previa en el motor: el panel lo dice y no la simula.

import { useLocation } from "react-router-dom";
import { ActualizarFuenteContenido } from "./ActualizarFuenteContenido";
import type { BaseDeLaColeccion, ColeccionDeBases } from "../pestanas/bases/basesModel";
import type { EstudioPayload } from "../../../api/estudio";
import { panelAbiertoEn } from "../../../lib/navegacion/paneles";
import { PANEL_ACTUALIZAR_FUENTE } from "../panelesCarga";
import { modoDeActualizacion } from "./actualizarFuenteModel";
import "./actualizarFuente.css";

export function modoDeLaFila(fila: BaseDeLaColeccion) {
  return modoDeActualizacion({
    enEstudio: fila.enEstudio,
    recibeNuevaVersion: fila.recibeNuevaVersion,
    sourceKind: fila.base?.source_kind ?? null,
    integrada: Boolean(fila.base?.multi_integrated) || fila.fuentes.length > 1,
  });
}

export function ActualizarFuente({ coleccion, ocupado, onCambio }: {
  coleccion: ColeccionDeBases;
  ocupado: boolean;
  onCambio: (payload: EstudioPayload) => Promise<void>;
}) {
  const { search } = useLocation();
  const abierto = panelAbiertoEn(search, PANEL_ACTUALIZAR_FUENTE);
  const foco = new URLSearchParams(search).get("foco") ?? "";
  const fila = coleccion.bases.find((b) => b.nombre === foco) ?? null;
  // La clave reinicia el recorrido cada vez que se abre o cambia de base.
  return (
    <ActualizarFuenteContenido
      key={abierto ? `abierto:${foco}` : "cerrado"}
      fila={fila}
      modo={fila ? modoDeLaFila(fila) : null}
      ocupado={ocupado}
      onCambio={onCambio}
    />
  );
}
