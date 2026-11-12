// "Archivos" de un entregable (prototipo, Analítica › Entrega): un renglón por
// archivo. Antes de generar, su formato, su nombre y "Por generar"; al generar,
// el contenedor de entregables del kit con el avance, el archivo listo y sus
// acciones, o el fallo. La app no guarda cuándo se generó cada uno (pedido E1
// del ADR 0144), así que no lo dice.

import type { ReactNode } from "react";

import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { TileFormato } from "../../../components/entregables/TileFormato";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { FolderOpen } from "../../../vendor/lucide-react";
import { ArchivosPorBase } from "../PaneKit";
import type { ReporteRunState } from "../useReporteRun";

type Run = Pick<ReporteRunState, "generacion" | "perBase">;

export type ArchivoDeEntrega = {
  clave: string;
  formato: string;
  nombre: string;
  run: Run;
  /** Lo que va bajo el archivo listo, además de los archivos por base. */
  pie?: ReactNode;
  /** El archivo se genera desde su renglón (no desde el panel del centro). */
  onGenerar?: () => void;
};

function Archivo({ formato, nombre, run, pie, onGenerar }: ArchivoDeEntrega) {
  const { estado, cerrar } = run.generacion;
  if (estado.fase === "inactiva") {
    return (
      <li className="libro-archivo">
        <TileFormato formato={formato} />
        <div>
          <b>{nombre}</b>
          <span>Por generar</span>
        </div>
        {onGenerar ? (
          <PulsoButton variant="secondary" size="sm" className="entrega-archivo-accion" onClick={onGenerar}>
            Generar
          </PulsoButton>
        ) : null}
      </li>
    );
  }
  const porBase = run.perBase.length > 1 ? run.perBase : [];
  const debajo = estado.fase === "lista" && (porBase.length > 0 || pie)
    ? <>{porBase.length > 0 ? <ArchivosPorBase bases={porBase} /> : null}{pie}</>
    : undefined;
  return (
    <li className="libro-archivo libro-archivo--activo">
      <ContenedorEntregable estado={estado} forma="bloque" onCerrar={cerrar} pie={debajo} />
    </li>
  );
}

export function ArchivosDeEntrega({ archivos }: { archivos: readonly ArchivoDeEntrega[] }) {
  return (
    <PanelDeMesa zona="archivos" titulo="Archivos" icono={<FolderOpen size={16} aria-hidden="true" />}>
      <ul className="libro-archivos" data-qa-geometry-group="analitica/entrega-archivos" data-qa-geometry-contract="intrinsic">
        {archivos.map((a) => <Archivo key={a.clave} {...a} />)}
      </ul>
    </PanelDeMesa>
  );
}
