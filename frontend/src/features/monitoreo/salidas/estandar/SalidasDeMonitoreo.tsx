import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Database, FileSpreadsheet, FileText, Send, Users } from "../../../../vendor/lucide-react";

import { EstadoChip } from "../../../../components/EstadoChip";
import { PulsoButton } from "../../../../components/PulsoButton";
import { BloqueDeMonitoreo } from "../../core/BloqueDeMonitoreo";
import { readinessDeSalidas } from "../../corte/corteContract";
import { MonitoreoOutputsWorkbench, type MonitoreoOutputsWorkbenchProps } from "../MonitoreoOutputsWorkbench";
import { filasDeSalidas, type FamiliaDeSalidas, type FilaDeSalida } from "./filasDeSalidas";
import "./salidasDeMonitoreo.css";

/** La sub-vista con el motor completo de salidas: PDF, producción, Sheets y base final. */
export const PANEL_HERRAMIENTAS_DE_SALIDAS = "herramientas";

const ICONOS: Record<string, typeof FileText> = {
  "pdf-cliente": FileText,
  "pdf-produccion": Users,
  "sheets-cliente": Send,
  "sheets-interno": FileSpreadsheet,
  "base-final": Database,
};

/**
 * **Avance › Salidas, igual en los cuatro modos** (estándar de Salidas, 4 nov 2026: decidido por coordinación a
 * pedido de Gonzalo, «¿no se pueden estandarizar en el mejor?»; revisable). Cada modo había puesto una portada
 * distinta sobre el mismo motor: acreditación una franja de cierre, telefónico la vista del PDF, territorial
 * nada y cursos-horario una lista de salidas.
 *
 * El estándar toma lo mejor de dos: la lista de cursos-horario (una fila por entregable, su estado y una sola
 * acción) y la hoja del telefónico (lo que recibe el cliente). El motor completo vive en la sub-vista
 * «PDF y cliente» (`panel=herramientas`, un panel superpuesto con dirección); cada fila lleva allá.
 */
export function SalidasDeMonitoreo({
  vistaPrevia,
  filasPropias = [],
  despues,
  ...motor
}: MonitoreoOutputsWorkbenchProps & {
  /** La hoja del cliente de este modo (`HojaDelCliente`). */
  vistaPrevia: ReactNode;
  /** Salidas que sólo tiene este modo (el cierre del campo en acreditación), antes de las comunes. */
  filasPropias?: Array<FilaDeSalida & { accion?: ReactNode }>;
  /** Lo que el modo agrega bajo la lista. */
  despues?: ReactNode;
}) {
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const params = new URLSearchParams(ubicacion.search);
  const irA = (panel: string | null) => {
    const siguiente = new URLSearchParams(ubicacion.search);
    if (panel) siguiente.set("panel", panel); else siguiente.delete("panel");
    siguiente.delete("foco");
    navegar({ pathname: ubicacion.pathname, search: `?${siguiente.toString()}` });
  };
  if (params.get("panel") === PANEL_HERRAMIENTAS_DE_SALIDAS) {
    return (
      <div className="mon-sal-motor">
        <div className="mon-sal-volver">
          <PulsoButton variant="link" size="sm" onClick={() => irA(null)}><ArrowLeft size={14} aria-hidden="true" /> Salidas del corte</PulsoButton>
        </div>
        <MonitoreoOutputsWorkbench {...motor} variante="ficha" />
      </div>
    );
  }

  const familia = motor.family as FamiliaDeSalidas;
  const filas = filasDeSalidas({ familia, corte: motor.corte, clientSheets: motor.clientSheets, internalSheets: motor.internalSheets });
  const readiness = readinessDeSalidas(motor.corte);
  const abrir = () => irA(PANEL_HERRAMIENTAS_DE_SALIDAS);
  const estadoDelCorte = readiness.puedePublicarCliente
    ? <><EstadoChip label="Listo" tone="success" /> El corte puede salir a cliente.</>
    : <><EstadoChip label="Bloqueado" tone="warn" /> {readiness.bloqueos[0]?.mensaje ?? "El corte todavía no puede salir a cliente."}</>;

  return (
    <PortadaDeSalidas
      rotulo={motor.rotulo}
      lectura={estadoDelCorte}
      acciones={<PulsoButton variant="secondary" size="sm" nav onClick={abrir}>PDF y cliente</PulsoButton>}
      filas={[
        ...filasPropias,
        ...filas.map((fila) => ({
          ...fila,
          accion: <PulsoButton variant="secondary" size="sm" onClick={abrir}>{String(fila.clave).startsWith("sheets") ? "Revisar" : "Abrir"}</PulsoButton>,
        })),
      ]}
      despues={despues}
      vistaPrevia={vistaPrevia}
    />
  );
}

/** `pie`: lo que va bajo la fila entera, del texto a la acción (el contenedor del kit en forma fila). */
export type FilaDePortada = FilaDeSalida & { accion?: ReactNode; icono?: typeof FileText; pie?: ReactNode };

/**
 * La portada de Salidas, sólo presentación: la lista a la izquierda (con lo que el modo agrega debajo) y la hoja
 * del cliente a la derecha. `SalidasDeMonitoreo` la arma con las filas comunes; cursos-horario, con las suyas.
 */
export function PortadaDeSalidas({ rotulo, lectura, acciones, filas, despues, vistaPrevia, readiness = "monitoreo-salidas" }: {
  rotulo?: ReactNode;
  lectura?: ReactNode;
  acciones?: ReactNode;
  filas: FilaDePortada[];
  despues?: ReactNode;
  vistaPrevia: ReactNode;
  /** La marca de `data-audit-ready` (la del modo, si ya la declara). */
  readiness?: string;
}) {
  return (
    <section
      className="mon-sal"
      aria-label="Salidas del corte"
      data-audit-ready={readiness}
      data-qa-geometry-group="monitoreo-salidas"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-sal-izquierda" data-qa-geometry-member="salidas">
        <BloqueDeMonitoreo
          marco="kit"
          className="mon-sal-lista"
          antetitulo={rotulo}
          titulo="Salidas del corte"
          lectura={lectura}
          acciones={acciones}
        >
          <ul className="mon-sal-filas" data-qa-geometry-group="monitoreo-salidas-filas" data-qa-geometry-contract="intrinsic">
            {filas.map((fila) => <Fila key={fila.clave} fila={fila} accion={fila.accion} icono={fila.icono} pie={fila.pie} />)}
          </ul>
        </BloqueDeMonitoreo>
        {despues}
      </div>
      <BloqueDeMonitoreo marco="kit" className="mon-sal-vista" titulo="Así se verá" bajada="lo que recibe el cliente" data-qa-geometry-member="vista">
        {vistaPrevia}
      </BloqueDeMonitoreo>
    </section>
  );
}

function Fila({ fila, accion, icono, pie }: { fila: FilaDeSalida; accion?: ReactNode; icono?: typeof FileText; pie?: ReactNode }) {
  const Icono = icono ?? ICONOS[String(fila.clave)] ?? FileText;
  return (
    <li className="mon-sal-fila" data-qa-geometry-member>
      <span className="mon-sal-icono" aria-hidden="true"><Icono size={18} /></span>
      <div className="mon-sal-texto">
        <div className="mon-sal-nombre">
          <b>{fila.titulo}</b>
          <EstadoChip label={fila.estado} tone={fila.tono} />
        </div>
        <p>{fila.detalle}</p>
      </div>
      {accion ? <div className="mon-sal-accion">{accion}</div> : null}
      {pie}
    </li>
  );
}
