// Prueba de horarios, paso 4: el plan de recordatorios. Una grilla por
// recordatorio, con la hora de cada grupo en cada público (editable) y, en cada
// celda con hora, el borrador de ese grupo en Mailchimp. "Proponer plan
// cruzado" arma el plan desde la fecha de cada recordatorio y cuatro horas: el
// grupo que recibió en la mañana recibe en la noche del siguiente.
//
// Los avisos (fuera de oficina, misma hora, falta una hora) los calcula el
// backend y se muestran tal cual. La app no envía ni programa.

import { useState } from "react";

import {
  apiBorradorDeGrupo,
  apiGuardarPlan,
  apiProponerPlan,
  type Grupo,
} from "../../../api/mailSeguimiento";
import { EstadoChip } from "../../../components/EstadoChip";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoField, PulsoFieldRow } from "../../../components/PulsoField";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { CalendarClock, ExternalLink, FilePen, Loader2, Shuffle } from "../../../vendor/lucide-react";
import { faltaParaElBorrador, guardarRemitente, mensajeDeError, type Remitente } from "../correos/mailchimpPorApiModel";
import {
  aProgramado,
  esFecha,
  esHora,
  fechasDelPlan,
  grillaDelPlan,
  planConHora,
  type CeldaDelPlan,
  type FilaDeLaGrilla,
} from "./modeloSeguimiento";
import { IrA, hrefDeEnvios } from "./enlacesDeSeguimiento";
import { cabeceraDeRonda, estadoDeCelda } from "./modeloTablero";
import { Chip } from "./piezas";
import { useSeguimientoStore } from "./store";
import { useOperacion } from "./useOperacion";

/** Sin el id ni el centro de datos de la cuenta, el enlace genérico abre la lista de campañas de Mailchimp. */
const CAMPANAS_EN_MAILCHIMP = "https://admin.mailchimp.com/campaigns/";

type Propuesta = { fechas: Record<number, string>; manana: string; noche: string; oficina_temprano: string; oficina_media: string };

type Celdas = {
  /** Lo que se escribe en una celda antes de guardarlo (clave `ronda|campaña|grupo`). */
  ediciones: Record<string, string>;
  creando: string | null;
  /** El enlace de edición de cada borrador creado en esta sesión. */
  urls: Record<string, string>;
  error: { clave: string; texto: string } | null;
};

const clave = (ronda: number, id: string, g: Grupo) => `${ronda}|${id}|${g}`;

export function PlanDeRecordatorios({ remitente }: { remitente: Remitente }) {
  const estado = useSeguimientoStore((s) => s.estado);
  const guardado = useOperacion<void>();
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [celdas, setCeldas] = useState<Celdas>({ ediciones: {}, creando: null, urls: {}, error: null });
  if (!estado) return null;
  const h = estado.horario;
  if (!h.campanas.length) return <p className="rec-seg-nota">Marca primero los públicos de la prueba.</p>;
  if (!h.rondas.length) {
    return (
      <EstadoVacio
        icono={<CalendarClock size={18} />}
        titulo="El plan no tiene recordatorios"
        descripcion="Las campañas de la prueba todavía no tienen recordatorios: se agregan en los Envíos de cada correo."
        accion={<IrA href={hrefDeEnvios(h.campanas[0])}>Ir a Envíos</IrA>}
      />
    );
  }

  const publicos = Object.fromEntries(estado.campanas.map((c) => [c.campaign_id, c.publico]));
  const grilla = grillaDelPlan(h, publicos);
  const p: Propuesta = propuesta ?? {
    fechas: fechasDelPlan(h), manana: "09:30", noche: "20:00", oficina_temprano: h.oficina_desde, oficina_media: "10:00",
  };
  const hayOficina = h.oficina.some((id) => h.campanas.includes(id));
  const propuestaValida = h.rondas.every((r) => esFecha(p.fechas[r.ronda] ?? ""))
    && [p.manana, p.noche, p.oficina_temprano, p.oficina_media].every(esHora);
  const faltaBorrador = !h.etiquetado_en
    ? "Pon primero las etiquetas en Mailchimp."
    : faltaParaElBorrador(remitente, estado.config.list_id);

  const proponer = () => guardado.correr(async () => {
    useSeguimientoStore.getState().aplicar(await apiProponerPlan({
      rondas: h.rondas.map((r) => ({ ronda: r.ronda, fecha: p.fechas[r.ronda] })),
      manana: p.manana, noche: p.noche, oficina_temprano: p.oficina_temprano, oficina_media: p.oficina_media,
    }));
    setPropuesta(null);
    setCeldas((c) => ({ ...c, ediciones: {} }));
  }, "No se pudo proponer el plan.");

  const guardarHora = (ronda: number, id: string, grupo: Grupo) => {
    const k = clave(ronda, id, grupo);
    const editada = celdas.ediciones[k];
    if (editada === undefined) return;
    const programado = aProgramado(editada);
    const actual = h.plan.find((f) => f.ronda === ronda && f.campaign_id === id && f.grupo === grupo)?.programado ?? "";
    const sinCambio = programado === actual;
    if (sinCambio || (editada && !programado)) {
      setCeldas((c) => { const ediciones = { ...c.ediciones }; delete ediciones[k]; return { ...c, ediciones }; });
      return;
    }
    void guardado.correr(async () => {
      useSeguimientoStore.getState().aplicar(await apiGuardarPlan(planConHora(h.plan, { ronda, campaign_id: id, grupo, programado })));
      setCeldas((c) => { const ediciones = { ...c.ediciones }; delete ediciones[k]; return { ...c, ediciones }; });
    }, "No se pudo guardar la hora.");
  };

  const crearBorrador = async (ronda: number, id: string, grupo: Grupo) => {
    const k = clave(ronda, id, grupo);
    setCeldas((c) => ({ ...c, creando: k, error: null }));
    try {
      const r = await apiBorradorDeGrupo({ campaign_id: id, ronda, grupo, from_name: remitente.from_name, reply_to: remitente.reply_to });
      guardarRemitente(remitente);
      setCeldas((c) => ({ ...c, creando: null, urls: r.edit_url ? { ...c.urls, [k]: r.edit_url } : c.urls }));
      await useSeguimientoStore.getState().cargar({ silencioso: true });
    } catch (e) {
      setCeldas((c) => ({ ...c, creando: null, error: { clave: k, texto: mensajeDeError(e, "No se pudo crear el borrador.") } }));
    }
  };

  // Una función que pinta, no un componente: declarado aquí, un componente se volvería a montar en cada
  // tecla y el campo de la hora perdería el foco.
  const pintarCelda = (ronda: number, fila: FilaDeLaGrilla, celda: CeldaDelPlan) => {
    const k = clave(ronda, fila.campaign_id, celda.grupo);
    const f = celda.fila;
    const valor = celdas.ediciones[k] ?? f?.programado ?? "";
    const creando = celdas.creando === k;
    const est = estadoDeCelda(f);
    return (
      <span className="rec-seg-celda">
        <span className={`rec-seg-marca is-${celda.grupo.toLowerCase()}`} aria-hidden />
        <PulsoInput
          size="sm"
          type="datetime-local"
          aria-label={`Hora del grupo ${celda.grupo}, ${fila.publico}, recordatorio ${ronda}`}
          value={valor}
          disabled={guardado.corriendo}
          onChange={(e) => setCeldas((c) => ({ ...c, ediciones: { ...c.ediciones, [k]: e.target.value } }))}
          onBlur={() => guardarHora(ronda, fila.campaign_id, celda.grupo)}
        />
        <span className={`rec-seg-celda-estado is-${est.tono}`}>{est.texto}</span>
        {f?.mailchimp_id ? (
          <a className="rec-seg-abrir" href={celdas.urls[k] || CAMPANAS_EN_MAILCHIMP} target="_blank" rel="noopener noreferrer" aria-label="Abrir en Mailchimp" title={`Borrador ${f.mailchimp_id}`}>
            <ExternalLink size={13} aria-hidden /> Mailchimp
          </a>
        ) : f?.programado ? (
          <PulsoButton
            variant="secondary"
            size="sm"
            disabled={Boolean(faltaBorrador) || creando || celdas.creando !== null}
            title={faltaBorrador || undefined}
            onClick={() => void crearBorrador(ronda, fila.campaign_id, celda.grupo)}
          >
            {creando ? <Loader2 size={13} className="pulso-spin" aria-hidden /> : <FilePen size={13} aria-hidden />} Crear borrador
          </PulsoButton>
        ) : null}
        {celdas.error?.clave === k ? <span className="rec-seg-error" role="alert">{celdas.error.texto}</span> : null}
      </span>
    );
  };

  const columnasDe = (ronda: number): PulsoTableColumna<FilaDeLaGrilla>[] => [
    {
      id: "publico", encabezado: "Público", ancho: 200,
      celda: (f) => (f.oficina ? <>{f.publico} <Chip>Oficina</Chip></> : f.publico),
      valor: (f) => f.publico,
    },
    { id: "A", encabezado: "Grupo A", ancho: 460, celda: (f) => pintarCelda(ronda, f, f.A) },
    { id: "B", encabezado: "Grupo B", ancho: 460, celda: (f) => pintarCelda(ronda, f, f.B) },
  ];

  return (
    <>
      <div className="rec-seg-ronda-plan">
        <h4 className="rec-seg-subtitulo">Fechas y horas</h4>
        <PulsoFieldRow geometryGroup="material-campo/correo/seguimiento/horarios/fechas" ariaLabel="Fecha de cada recordatorio" role="group">
          {h.rondas.map((r) => (
            <PulsoField key={r.ronda} label={r.etiqueta}>
              <PulsoInput
                type="date"
                value={p.fechas[r.ronda] ?? ""}
                disabled={guardado.corriendo}
                onChange={(e) => setPropuesta({ ...p, fechas: { ...p.fechas, [r.ronda]: e.target.value } })}
              />
            </PulsoField>
          ))}
        </PulsoFieldRow>
        <PulsoFieldRow geometryGroup="material-campo/correo/seguimiento/horarios/horas" ariaLabel="Horas del plan" role="group">
          <PulsoField label="Mañana">
            <PulsoInput type="time" value={p.manana} disabled={guardado.corriendo} onChange={(e) => setPropuesta({ ...p, manana: e.target.value })} />
          </PulsoField>
          <PulsoField label="Noche">
            <PulsoInput type="time" value={p.noche} disabled={guardado.corriendo} onChange={(e) => setPropuesta({ ...p, noche: e.target.value })} />
          </PulsoField>
          {hayOficina ? (
            <>
              <PulsoField label="Oficina, inicio de la jornada">
                <PulsoInput type="time" value={p.oficina_temprano} disabled={guardado.corriendo} onChange={(e) => setPropuesta({ ...p, oficina_temprano: e.target.value })} />
              </PulsoField>
              <PulsoField label="Oficina, media mañana">
                <PulsoInput type="time" value={p.oficina_media} disabled={guardado.corriendo} onChange={(e) => setPropuesta({ ...p, oficina_media: e.target.value })} />
              </PulsoField>
            </>
          ) : null}
        </PulsoFieldRow>
        <span className="rec-seg-acciones">
          <PulsoButton
            variant={h.plan.length ? "secondary" : "primary"}
            size="sm"
            disabled={!propuestaValida || guardado.corriendo}
            title={propuestaValida ? undefined : "Indica la fecha de cada recordatorio."}
            onClick={() => void proponer()}
          >
            {guardado.corriendo ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Shuffle size={14} aria-hidden />} Proponer plan cruzado
          </PulsoButton>
        </span>
        {h.plan.some((f) => f.mailchimp_id) ? <p className="rec-seg-nota">Proponer de nuevo conserva las filas que ya tienen borrador.</p> : null}
      </div>

      {guardado.error ? <p className="rec-seg-error" role="alert">{guardado.error}</p> : null}
      {h.avisos.length ? (
        <ul className="rec-seg-avisos" aria-label="Avisos del plan">
          {h.avisos.map((a, i) => <li key={`${a.tipo}-${a.ronda}-${a.campaign_id}-${i}`}>{a.texto}</li>)}
        </ul>
      ) : null}

      {grilla.map((r) => {
        const cab = cabeceraDeRonda(h.plan, r.ronda);
        return (
        <section key={r.ronda} className="rec-seg-ronda-plan rec-seg-ronda-tabla" aria-labelledby={`rec-seg-ronda-${r.ronda}`}>
          <header className="rec-seg-ronda-banda">
            <h4 id={`rec-seg-ronda-${r.ronda}`} className="rec-seg-subtitulo">{r.etiqueta}</h4>
            {cab.fecha ? <span className="rec-seg-ronda-fecha">{cab.fecha}</span> : <span className="rec-seg-ronda-fecha">Sin fecha</span>}
            {cab.salio ? <EstadoChip label="Ya salió" tone="success" /> : null}
          </header>
          <PulsoTable
            ariaLabel={`Plan del ${r.etiqueta.toLocaleLowerCase("es-PE")}`}
            columnas={columnasDe(r.ronda)}
            filas={r.filas}
            idDeFila={(f) => f.campaign_id}
            vacio="Sin públicos en la prueba."
          />
        </section>
        );
      })}
    </>
  );
}
