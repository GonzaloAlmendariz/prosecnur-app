import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpenCheck, FileSpreadsheet, FileText, Info, ListChecks, Send } from "lucide-react";

import type { MonitoreoAulasConfig, MonitoreoLastSheetsPublication } from "../../../../../api/monitoreo";
import { Dialog } from "../../../../../components/Dialog";
import { PulsoButton } from "../../../../../components/PulsoButton";
import { PANEL_REVISAR_LIBRO } from "../../../../../lib/navegacion/manifiesto";
import { usePanelDireccionable } from "../../../../../lib/navegacion/paneles";
import { useTablasDeAvance } from "../useTablasDeAvance";
import type { Vacio } from "./porFacultadModelo";
import { tonoDeEstadoChip } from "../tonoDeEstadoChip";
import {
  construirSalidas,
  readinessDeSalidas,
  type AccionDeSalida,
  type FilaDeHoja,
  type QueTocaPublicar,
  type Salida,
  type VistaPrevia,
} from "./salidasModelo";
import { corteCorto } from "../../../core/barraComun";
import { BloqueDeMonitoreo } from "../../../core/BloqueDeMonitoreo";
import { HojaDelCliente, type TablaDelCliente } from "../../../salidas/estandar/HojaDelCliente";
import { PortadaDeSalidas } from "../../../salidas/estandar/SalidasDeMonitoreo";
import "./salidas.css";

/** Lo que Salidas necesita de la página: el estado del corte y sus acciones. */
export type ContextoDeSalidas = {
  config: MonitoreoAulasConfig | null | undefined;
  corte: string;
  clientSheets: MonitoreoLastSheetsPublication | null | undefined;
  ocupado: boolean;
  /** R13: lleva a Material › Entrega, donde se construyen las tablas del Sheets. */
  irAMaterial: () => void;
  /** Genera y descarga el libro en Excel. */
  generarLibro: () => Promise<void>;
  /** La sub-vista con los flujos de PDF y del Sheets del cliente. */
  hrefHerramientas: string;
};

const ICONOS: Record<Salida["clave"], typeof FileText> = {
  libro: BookOpenCheck,
  pdf: FileText,
  cliente: Send,
  excel: FileSpreadsheet,
};

/**
 * Avance › Salidas (ficha A5, `docs/qa/revamp-monitoreo/aulas.md`). ¿Qué sale
 * de este corte y qué toca cada salida?
 *
 * Izquierda: las cuatro salidas del corte con su estado y su acción, y debajo
 * cómo se verá «Avance de campo». Derecha, 400 px: qué toca Publicar en el
 * libro, hoja por hoja. «Revisar cambios» no escribe: las tablas se construyen en Material (R13).
 */
function SalidasAulasImpl({ contexto }: { contexto: ContextoDeSalidas }) {
  const { tablas, error, sinPlan } = useTablasDeAvance();
  const modelo = useMemo(
    () => construirSalidas({
      config: contexto.config,
      corte: contexto.corte,
      clientSheets: contexto.clientSheets,
      tablas,
      errorTablas: error,
      sinPlanTablas: sinPlan,
    }),
    [contexto.config, contexto.corte, contexto.clientSheets, tablas, error, sinPlan],
  );
  const revisar = usePanelDireccionable(PANEL_REVISAR_LIBRO);
  const libro = modelo.salidas.find((s) => s.clave === "libro");

  const ejecutar = (accion: AccionDeSalida) => {
    if (accion === "revisar" || accion === "publicar") revisar.abrir();
    else if (accion === "excel") void contexto.generarLibro();
  };

  const navegar = useNavigate();
  const accionesDe = (salida: Salida) => (
    <>
      {salida.acciones.map((a) => (a.accion === "pdf" || a.accion === "conectar" ? (
        <PulsoButton key={a.accion} variant="secondary" size="sm" onClick={() => navegar(contexto.hrefHerramientas)}>
          {a.rotulo}
        </PulsoButton>
      ) : (
        <PulsoButton
          key={a.accion}
          variant={a.principal ? "primary" : "secondary"}
          size="sm"
          disabled={contexto.ocupado || (a.accion !== "revisar" && Boolean(a.deshabilitada))}
          title={a.deshabilitada}
          onClick={() => ejecutar(a.accion)}
        >
          {a.rotulo}
        </PulsoButton>
      )))}
    </>
  );

  // Estándar de Salidas (4 nov 2026): la misma portada que los otros tres modos, con las salidas propias de
  // cursos-horario (el libro y el Excel) y «Qué toca Publicar» bajo la lista.
  return (
    <>
      <PortadaDeSalidas
        readiness={readinessDeSalidas(modelo)}
        acciones={<PulsoButton variant="secondary" size="sm" nav onClick={() => navegar(contexto.hrefHerramientas)}>PDF y cliente</PulsoButton>}
        filas={modelo.salidas.map((salida) => ({
          clave: salida.clave,
          titulo: salida.titulo,
          estado: salida.estado,
          tono: tonoDeEstadoChip(salida.tono),
          detalle: salida.detalle,
          icono: ICONOS[salida.clave],
          accion: accionesDe(salida),
        }))}
        despues={<QueTocaPublicarPanel queToca={modelo.queToca} />}
        vistaPrevia={<VistaPreviaDelAvance vista={modelo.vistaPrevia} corte={contexto.corte} />}
      />
      <Dialog
        panel={PANEL_REVISAR_LIBRO}
        size="md"
        icon={<ListChecks size={18} />}
        title="Revisar cambios del libro"
        subtitle="Qué escribe en el Sheets del equipo construir las tablas. Revisar no escribe nada: las tablas se construyen en Material."
        dismissible={!contexto.ocupado}
        footer={
          <PulsoButton
            variant="primary"
            disabled={contexto.ocupado}
            title="Material › Entrega construye las tablas con el mismo motor"
            onClick={() => {
              revisar.cerrar();
              contexto.irAMaterial();
            }}
          >
            Construir en Material
          </PulsoButton>
        }
      >
        <div className="aulas-sl-revision">
          {libro ? <p className="aulas-sl-revision-estado">{libro.estado}. {libro.detalle}</p> : null}
          <ListaDeHojas queToca={modelo.queToca} />
          <p className="aulas-sl-pie">
            Antes de escribir, construir las tablas lee las hojas del equipo y la de los aplicadores: lo que cambiaron a mano manda.
          </p>
        </div>
      </Dialog>
    </>
  );
}

function Nota({ vacio }: { vacio: Vacio }) {
  return (
    <p className="aulas-sl-nota" data-qa-geometry-empty={vacio.clase}>
      <Info size={14} aria-hidden="true" />
      <span>{vacio.causa}</span>
    </p>
  );
}

function VistaPreviaDelAvance({ vista, corte }: { vista: VistaPrevia; corte: string }) {
  const tabla: TablaDelCliente | null = vista.tipo === "tabla"
    ? {
      cabecera: vista.cabecera,
      numericas: vista.numericas,
      filas: vista.filas.map((fila) => ({ clave: fila[0], celdas: fila })),
      total: vista.total ?? undefined,
    }
    : null;
  const vacio = vista.tipo === "cargando" ? "Armando la vista previa…" : vista.tipo === "vacio" ? vista.vacio.causa : "";
  return (
    <HojaDelCliente encabezado="Monitoreo de cursos-horario" corte={corte ? corteCorto(corte) : ""} titulo="Avance de campo" tabla={tabla} vacio={vacio}>
      {vista.tipo === "tabla" && vista.sub ? <p className="aulas-sl-nota">{vista.sub}</p> : null}
    </HojaDelCliente>
  );
}

function ListaDeHojas({ queToca }: { queToca: QueTocaPublicar }) {
  if (queToca.tipo === "vacio") return <Nota vacio={queToca.vacio} />;
  const grupo = (titulo: string, filas: FilaDeHoja[]) => (filas.length ? (
    <div className="aulas-sl-grupo" data-qa-geometry-member>
      <h4>{titulo}</h4>
      <ul className="aulas-sl-hojas">
        {filas.map((f) => (
          <li key={f.hoja} title={f.titulo}>
            <span>{f.hoja}{f.condicional ? <small className="aulas-sl-condicional">Condicional</small> : null}</span>
            <span className="aulas-sl-regla" data-tono={f.tono}>{f.regla}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null);
  return (
    <>
      {grupo("Hojas de la app", queToca.app)}
      {grupo("Hojas del equipo", queToca.equipo)}
    </>
  );
}

function QueTocaPublicarPanel({ queToca }: { queToca: QueTocaPublicar }) {
  return (
    <BloqueDeMonitoreo
      marco="kit"
      className="aulas-sl-que-toca"
      titulo="Qué toca Publicar en el libro"
      lectura={queToca.tipo === "hojas" ? queToca.sub : undefined}
      data-qa-geometry-group="aulas-salidas-que-toca"
      data-qa-geometry-contract="intrinsic"
    >
      <ListaDeHojas queToca={queToca} />
    </BloqueDeMonitoreo>
  );
}

export const SalidasAulas = memo(SalidasAulasImpl);
