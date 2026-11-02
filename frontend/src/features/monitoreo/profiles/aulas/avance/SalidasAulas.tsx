import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpenCheck, FileSpreadsheet, FileText, Info, ListChecks, Loader2, Send } from "lucide-react";

import type { MonitoreoAulasConfig, MonitoreoLastSheetsPublication } from "../../../../../api/monitoreo";
import { Dialog } from "../../../../../components/Dialog";
import { PulsoButton } from "../../../../../components/PulsoButton";
import { PANEL_REVISAR_LIBRO } from "../../../../../lib/navegacion/manifiesto";
import { usePanelDireccionable } from "../../../../../lib/navegacion/paneles";
import { useTablasDeAvance } from "../useTablasDeAvance";
import type { Vacio } from "./porFacultadModelo";
import {
  construirSalidas,
  readinessDeSalidas,
  type AccionDeSalida,
  type FilaDeHoja,
  type QueTocaPublicar,
  type Salida,
  type VistaPrevia,
} from "./salidasModelo";
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
  const { tablas, error } = useTablasDeAvance();
  const modelo = useMemo(
    () => construirSalidas({
      config: contexto.config,
      corte: contexto.corte,
      clientSheets: contexto.clientSheets,
      tablas,
      errorTablas: error,
    }),
    [contexto.config, contexto.corte, contexto.clientSheets, tablas, error],
  );
  const revisar = usePanelDireccionable(PANEL_REVISAR_LIBRO);
  const libro = modelo.salidas.find((s) => s.clave === "libro");

  const ejecutar = (accion: AccionDeSalida) => {
    if (accion === "revisar" || accion === "publicar") revisar.abrir();
    else if (accion === "excel") void contexto.generarLibro();
  };

  return (
    <section
      className="aulas-sl"
      aria-label="Salidas"
      data-audit-ready={readinessDeSalidas(modelo)}
      data-qa-geometry-group="aulas-salidas"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="aulas-sl-izquierda" data-qa-geometry-member="salidas">
        <section className="aulas-sl-panel" aria-labelledby="aulas-sl-salidas-titulo">
          <header className="aulas-sl-cabecera">
            <h3 id="aulas-sl-salidas-titulo" className="aulas-sl-titulo">Salidas del corte</h3>
          </header>
          <ul className="aulas-sl-lista">
            {modelo.salidas.map((s) => (
              <FilaDeSalida
                key={s.clave}
                salida={s}
                ocupado={contexto.ocupado}
                hrefHerramientas={contexto.hrefHerramientas}
                onAccion={ejecutar}
              />
            ))}
          </ul>
        </section>
        <VistaPreviaDelAvance vista={modelo.vistaPrevia} />
      </div>
      <div className="aulas-sl-derecha" data-qa-geometry-member="hojas">
        <QueTocaPublicarPanel queToca={modelo.queToca} />
      </div>
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
    </section>
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

function FilaDeSalida({ salida, ocupado, hrefHerramientas, onAccion }: {
  salida: Salida;
  ocupado: boolean;
  hrefHerramientas: string;
  onAccion: (accion: AccionDeSalida) => void;
}) {
  const navegar = useNavigate();
  const Icono = ICONOS[salida.clave];
  return (
    <li className="aulas-sl-salida">
      <span className="aulas-sl-icono" aria-hidden="true"><Icono size={18} /></span>
      <div className="aulas-sl-texto">
        <div className="aulas-sl-nombre">
          <b>{salida.titulo}</b>
          <span className="aulas-sl-chip" data-tono={salida.tono}>{salida.estado}</span>
        </div>
        <p>{salida.detalle}</p>
      </div>
      <div className="aulas-sl-acciones">
        {salida.acciones.map((a) => (a.accion === "pdf" || a.accion === "conectar" ? (
          <PulsoButton key={a.accion} variant="secondary" size="sm" onClick={() => navegar(hrefHerramientas)}>
            {a.rotulo}
          </PulsoButton>
        ) : (
          <PulsoButton
            key={a.accion}
            variant={a.principal ? "primary" : "secondary"}
            size="sm"
            disabled={ocupado || (a.accion !== "revisar" && Boolean(a.deshabilitada))}
            title={a.deshabilitada}
            onClick={() => onAccion(a.accion)}
          >
            {a.rotulo}
          </PulsoButton>
        )))}
      </div>
    </li>
  );
}

function VistaPreviaDelAvance({ vista }: { vista: VistaPrevia }) {
  const id = "aulas-sl-vista-titulo";
  return (
    <section className="aulas-sl-panel aulas-sl-vista" aria-labelledby={id}>
      <header className="aulas-sl-cabecera">
        <h3 id={id} className="aulas-sl-titulo">Así se verá «Avance de campo»</h3>
        {vista.tipo === "tabla" ? <span className="aulas-sl-sub">{vista.sub}</span> : null}
      </header>
      {vista.tipo === "cargando" ? (
        <p className="aulas-sl-nota" role="status"><Loader2 size={14} className="pulso-spin" aria-hidden="true" /> Armando la vista previa…</p>
      ) : vista.tipo === "vacio" ? <Nota vacio={vista.vacio} /> : (
        <div className="aulas-sl-tabla-marco" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Vista previa de Avance de campo, con desplazamiento">
          <table className="aulas-sl-tabla" aria-labelledby={id}>
            <thead>
              <tr>
                {vista.cabecera.map((c, i) => <th key={c} scope="col" className={vista.numericas[i] ? "is-num" : undefined}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {vista.filas.map((fila) => (
                <tr key={fila[0]}>
                  {fila.map((v, i) => (i === 0
                    ? <th key={i} scope="row">{v}</th>
                    : <td key={i} className={vista.numericas[i] ? "is-num" : undefined}>{v}</td>))}
                </tr>
              ))}
            </tbody>
            {vista.total ? (
              <tfoot>
                <tr>
                  {vista.total.map((v, i) => (i === 0
                    ? <th key={i} scope="row">{v}</th>
                    : <td key={i} className={vista.numericas[i] ? "is-num" : undefined}>{v}</td>))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </section>
  );
}

function ListaDeHojas({ queToca }: { queToca: QueTocaPublicar }) {
  if (queToca.tipo === "vacio") return <Nota vacio={queToca.vacio} />;
  const grupo = (titulo: string, filas: FilaDeHoja[]) => (filas.length ? (
    <div className="aulas-sl-grupo">
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
  const id = "aulas-sl-hojas-titulo";
  return (
    <section className="aulas-sl-panel aulas-sl-que-toca" aria-labelledby={id}>
      <header className="aulas-sl-cabecera">
        <h3 id={id} className="aulas-sl-titulo">Qué toca Publicar en el libro</h3>
        {queToca.tipo === "hojas" ? <span className="aulas-sl-sub">{queToca.sub}</span> : null}
      </header>
      <ListaDeHojas queToca={queToca} />
    </section>
  );
}

export const SalidasAulas = memo(SalidasAulasImpl);
