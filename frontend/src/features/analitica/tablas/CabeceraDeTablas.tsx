// La cabecera de Frecuencias y Cruces, como en el prototipo: un contenedor con
// la receta de los paneles. A la izquierda la pestaña (el TabHeading del kit,
// con su antetítulo y su ícono); a la derecha, los casos que cuentan, las
// cifras del archivo en una tira con divisores y la acción principal.

import type { ReactNode } from "react";

import { Panel } from "../../../components/Panel";
import { TabHeading } from "../../../components/TabHeading";
import { PROCESAMIENTO_PESTANAS } from "../../../lib/navegacion/catalogos/procesamiento";
import type { LucideIcon } from "../../../vendor/lucide-react";
import { UniversoAnalisis } from "../UniversoAnalisis";
import { CifrasDeCabecera, type CifraDeCabecera } from "./CifrasDeCabecera";

/** Lo que la página sabe de la pestaña: su nombre, su ícono del riel y su lugar entre las disponibles. */
export type EncabezadoDePestana = {
  titulo: string;
  icono: LucideIcon;
  pestanaN?: number;
  pestanaDe?: number;
};

/** El encabezado de una pestaña de Analítica según el catálogo, para cuando la página no lo pasa. */
export function encabezadoDelCatalogo(pestana: "frecuencias" | "cruces"): EncabezadoDePestana {
  const meta = PROCESAMIENTO_PESTANAS.analitica.find((p) => p.key === pestana);
  return { titulo: meta?.label ?? pestana, icono: meta?.icon ?? PROCESAMIENTO_PESTANAS.analitica[0].icon };
}

export function CabeceraDeTablas({ encabezado, cifras, ariaCifras, accion }: {
  encabezado: EncabezadoDePestana;
  cifras: readonly CifraDeCabecera[];
  ariaCifras: string;
  /** La acción principal de la pestaña: generar el archivo. */
  accion: ReactNode;
}) {
  return (
    <Panel noPadding className="tablas-panel tablas-cabecera" data-entra="sube">
      <TabHeading
        eyebrow="Analítica"
        titulo={encabezado.titulo}
        icono={encabezado.icono}
        // El antetítulo es "Analítica", como en el prototipo; el lugar de la pestaña queda para el lector de pantalla.
        control={(
          <div className="tablas-cabecera-control">
            {encabezado.pestanaN && encabezado.pestanaDe ? (
              <span className="pulso-sr-only">Pestaña {encabezado.pestanaN} de {encabezado.pestanaDe}</span>
            ) : null}
            <div className="tablas-cabecera-universo">
              <UniversoAnalisis />
            </div>
            <CifrasDeCabecera cifras={cifras} ariaLabel={ariaCifras} />
            <div className="tablas-cabecera-accion">{accion}</div>
          </div>
        )}
      />
    </Panel>
  );
}
