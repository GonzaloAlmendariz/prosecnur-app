// Entrega › un entregable de un solo archivo sin ajustes: Script de réplica y
// Formulario final (ADR 0144; venían de Bases e instrumentos). El prototipo no
// dibuja su panel: se arma con la forma del libro. Al centro, qué contiene el
// archivo y "Generar"; a la derecha, de qué se construye y el archivo.

import type { ReactNode } from "react";

import { PilaDeMesa } from "../../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { Play } from "../../../vendor/lucide-react";
import { SeConstruyeCon, type Dependencia } from "../libro/SeConstruyeCon";
import { SeccionDeAjustes } from "../tablas/SeccionDeAjustes";
import { useReporteRun } from "../useReporteRun";
import type { Articulo } from "../../../components/entregables/generacionModelo";
import { ArchivosDeEntrega } from "./ArchivosDeEntrega";

export function EntregaDeUnArchivo({ zona, titulo, articulo, formato, nombreDelArchivo, contenido, dependencias, generar }: {
  zona: string;
  titulo: string;
  articulo: Articulo;
  formato: string;
  nombreDelArchivo: string;
  /** Qué lleva el archivo, en renglones cortos. */
  contenido: readonly ReactNode[];
  dependencias: readonly Dependencia[];
  generar: () => Promise<unknown>;
}) {
  const run = useReporteRun(titulo, { articulo, formato });
  return (
    <>
      <PanelDeMesa
        zona={zona}
        titulo={titulo}
        acciones={(
          <PulsoButton variant="secondary" onClick={() => void run.runSync(generar)} disabled={run.busy}>
            <Play size={14} aria-hidden="true" />
            Generar
          </PulsoButton>
        )}
      >
        <div className="entrega-ajustes">
          <SeccionDeAjustes titulo={nombreDelArchivo}>
            <ul className="entrega-contenido">
              {contenido.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </SeccionDeAjustes>
        </div>
      </PanelDeMesa>
      <PilaDeMesa grupo="analitica/entrega-lateral">
        <SeConstruyeCon dependencias={dependencias} />
        <ArchivosDeEntrega archivos={[{ clave: zona, formato, nombre: titulo, run }]} />
      </PilaDeMesa>
    </>
  );
}
