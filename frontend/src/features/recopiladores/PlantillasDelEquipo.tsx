// Entrega › Plantillas del equipo (campaña de aulas; etapa 3, ADR 0122 §11). Las
// plantillas que llena el equipo de aulas salen de Material: el libro (Aulas Agendadas y
// Aulas Aplicadas) en blanco con las aulas de la entrega, y la disponibilidad de los
// aplicadores. La lectura y el seguimiento siguen en Monitoreo, que consulta esta entrega
// con su sello en vez de que Material le escriba el plan.
//
// Contrato de Superficie: dos tarjetas con título (C1); cada una contiene su vacío y su
// error (C3); el scroll es del panel de la sección (C4).

import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { downloadUrl } from "../../api/core";
import { descargarArchivo } from "../../lib/descargas";
import { apiMaterialAulasEntrega, apiMaterialAulasPlantilla, type EntregaDeAulas, type PiezaDelEquipo } from "../../api/materialAulasEntrega";
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import { serializarDireccion } from "../../lib/navegacion/direccion";
import { CalendarDays, Download, FileSpreadsheet } from "../../vendor/lucide-react";
import "./styles/plantillas-equipo.css";
import { CargaDeBloque } from "../../components/CargaDeBloque";
import { FormatoDeSalida, FormatosDeSalida } from "./PaquetesAulasTablero";

const PIEZAS: readonly { pieza: PiezaDelEquipo; titulo: string; llena: string; requiereEntrega: boolean }[] = [
  { pieza: "libro", titulo: "Libro del equipo", llena: "Aulas Agendadas (fecha, hora y aplicador de cada aula) y Aulas Aplicadas (el parte)", requiereEntrega: true },
  { pieza: "disponibilidad", titulo: "Disponibilidad de aplicadores", llena: "Qué días y franjas puede cada aplicador", requiereEntrega: false },
  // R7 del mapa de responsabilidades (2 nov 2026): la asignación con la que campo empieza.
  { pieza: "asignacion", titulo: "Asignación inicial de aplicadores", llena: "Qué aplicador va a cada aula titular, elegido de la lista del equipo", requiereEntrega: true },
];

/** Donde Monitoreo rehace el reparto de cada día sobre la agenda (control, no material). */
const A_MONITOREO_REPARTO = serializarDireccion({ modulo: "monitoreo", modo: "aulas", seccion: "modelo", pestana: "carga" });

const fecha = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export function PlantillasDelEquipo() {
  const [entrega, setEntrega] = useState<EntregaDeAulas | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState<PiezaDelEquipo | null>(null);

  useEffect(() => {
    let vivo = true;
    apiMaterialAulasEntrega()
      .then((e) => { if (vivo) setEntrega(e); })
      .catch((e: unknown) => { if (vivo) setError(e instanceof Error ? e.message : "No se pudo leer la entrega."); });
    return () => { vivo = false; };
  }, []);

  const descargar = (pieza: PiezaDelEquipo) => {
    setOcupado(pieza);
    setError("");
    apiMaterialAulasPlantilla(pieza)
      .then((r) => descargarArchivo(downloadUrl(r.file_id)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo generar la plantilla."))
      .finally(() => setOcupado(null));
  };

  const entregada = Boolean(entrega?.entregada);
  return (
    // Pasada de diseño (2 nov 2026): cada planilla es una tarjeta de salida, como los formatos de Paquetes,
    // y las dos partes de la pestaña viven en un Panel con su línea.
    <div className="rec-equipo-tarjetas" data-qa-geometry-group="material-campo/entrega/plantillas" data-qa-geometry-contract="intrinsic">
      <Panel
        data-qa-geometry-member
        title={<><FileSpreadsheet size={16} aria-hidden /> Plantillas del equipo</>}
        hint="En blanco y con las aulas de la entrega ya puestas. Campo las llena; la lectura y el seguimiento siguen en Monitoreo."
      >
        <FormatosDeSalida>
          {PIEZAS.map((p) => {
            const bloqueada = p.requiereEntrega && !entregada;
            return (
              <FormatoDeSalida
                key={p.pieza}
                icono={<FileSpreadsheet size={16} />}
                titulo={p.titulo}
                descripcion={bloqueada ? `${p.llena}. Sale después de entregar el material a Monitoreo.` : `${p.llena}.`}
              >
                <PulsoButton size="sm" variant="secondary" disabled={bloqueada || ocupado !== null || entrega === null} onClick={() => descargar(p.pieza)}>
                  <Download size={14} aria-hidden /> {ocupado === p.pieza ? "Generando…" : "Excel"}
                </PulsoButton>
              </FormatoDeSalida>
            );
          })}
        </FormatosDeSalida>
        <p className="rec-equipo-nota">
          La asignación inicial es con la que campo empieza. El reparto de cada día sobre la agenda lo rehace Monitoreo, en{" "}
          <Link to={A_MONITOREO_REPARTO}>Modelo › Carga</Link>.
        </p>
        {error ? <p className="rec-equipo-error" role="alert">{error}</p> : null}
      </Panel>

      <Panel
        data-qa-geometry-member
        title={<><CalendarDays size={16} aria-hidden /> Traspaso a Monitoreo</>}
        hint={entrega && entregada ? undefined : 'Al entregar, Monitoreo la trae desde Insumos › Fuentes con "Traer la entrega".'}
      >
        {entrega === null && !error ? <CargaDeBloque label="Leyendo la entrega…" /> : null}
        {entrega && !entregada ? <p className="rec-equipo-estado">Todavía no hay entrega</p> : null}
        {entrega && entregada ? (
          <>
            <p className="rec-equipo-nota">
              Entrega del {fecha(entrega.entregadaEl)}, con {entrega.unidades.toLocaleString("es-PE")} aulas. Material ya no escribe el plan de
              Monitoreo: Monitoreo consulta esta entrega y avisa si cambia.
            </p>
            <p className={entrega.vigente && !entrega.desactualizada ? "rec-equipo-nota" : "rec-equipo-error"}>
              {entrega.desactualizada
                ? "El plan cambió desde la entrega: prepara y entrega otra vez para que Monitoreo la traiga."
                : entrega.vigente
                  ? <span title={entrega.sello}>La entrega sigue vigente.</span>
                  : "El despliegue cambió desde la entrega: vuelve a entregar."}
            </p>
          </>
        ) : null}
      </Panel>
    </div>
  );
}
