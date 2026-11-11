// Seguimiento > Prueba de horarios: seis pasos en el orden en que se hacen, cada
// uno con su estado (hecho, sigue, pendiente) para que quien llega a mitad sepa
// dónde va. 1 públicos y horario de oficina, 2 asignación al azar, 3 etiquetas en Mailchimp,
// 4 plan de recordatorios, 5 borradores por grupo, 6 resultados.
//
// La app no envía ni programa: crea borradores y la hora se pone en Mailchimp.
// Contrato de Superficie: `.../horarios/pasos` (intrinsic), un paso por fila.

import { useState, type ReactNode } from "react";

import {
  apiEtiquetarGrupos,
  apiGuardarHorario,
  apiLeerEnvios,
  apiSortearHorario,
  normalizeEtiquetasDeGrupo,
  type CambioDeHorario,
  type CampanaSeguimiento,
  type EtiquetasDeGrupo,
  type LecturaDeEnvios,
} from "../../../api/mailSeguimiento";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoField, PulsoFieldRow } from "../../../components/PulsoField";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { LoadingBlock } from "../../../components/States";
import { formatoConteo } from "../../../lib/formatoNumero";
import { Loader2, Search, Shuffle, Tags } from "../../../vendor/lucide-react";
import { MailchimpAvance } from "../correos/MailchimpAvance";
import { leerRemitente, type Remitente } from "../correos/mailchimpPorApiModel";
import { esperarTrabajo } from "../correos/mailchimpTrabajo";
import {
  ROTULO_DE_ESTADO,
  conteoConPct,
  esHora,
  fechaHoraLegible,
  pasosDeLaPrueba,
  resumenDeEtiquetas,
  semillaDeHoy,
  type PasoDeLaPrueba,
} from "./modeloSeguimiento";
import { AvisoDeConexiones, Chip, Confirmar, Resultado, useConexiones } from "./piezas";
import { PlanDeRecordatorios } from "./PlanDeRecordatorios";
import { ResultadosDeHorarios } from "./ResultadosDeHorarios";
import { useSeguimientoStore } from "./store";
import { useOperacion } from "./useOperacion";

export function PruebaDeHorarios() {
  const estado = useSeguimientoStore((s) => s.estado);
  const carga = useSeguimientoStore((s) => s.carga);
  const [remitente, setRemitente] = useState<Remitente>(leerRemitente);
  if (!estado) return carga === "error" ? null : <LoadingBlock label="Leyendo la prueba de horarios" />;
  const pasos = pasosDeLaPrueba(estado.horario);
  const paso = (id: PasoDeLaPrueba["id"]) => pasos.find((p) => p.id === id) as PasoDeLaPrueba;

  return (
    <>
      <AvisoDeConexiones necesita={["mailchimp"]} />
      <ol
        className="rec-seg-pasos"
        aria-label="Pasos de la prueba de horarios"
        data-qa-geometry-group="material-campo/correo/seguimiento/horarios/pasos"
        data-qa-geometry-contract="intrinsic"
      >
        <Paso paso={paso("publicos")}><PasoPublicos /></Paso>
        <Paso paso={paso("sorteo")}><PasoSorteo /></Paso>
        <Paso paso={paso("etiquetas")}><PasoEtiquetas /></Paso>
        <Paso paso={paso("plan")}><PlanDeRecordatorios remitente={remitente} /></Paso>
        <Paso paso={paso("borradores")}><PasoBorradores remitente={remitente} onRemitente={setRemitente} /></Paso>
        <Paso paso={paso("resultados")}><ResultadosDeHorarios /></Paso>
      </ol>
    </>
  );
}

function Paso({ paso, children }: { paso: PasoDeLaPrueba; children: ReactNode }) {
  const id = `rec-seg-paso-${paso.id}`;
  return (
    <li className={`rec-seg-paso is-${paso.estado}`} aria-labelledby={id} aria-current={paso.estado === "sigue" ? "step" : undefined}>
      <span className="rec-seg-num" aria-hidden>{paso.numero}</span>
      <div className="rec-seg-paso-cuerpo">
        <header className="rec-seg-cabeza">
          <h3 id={id} className="rec-seg-titulo">{paso.titulo}</h3>
          <Chip tono={paso.estado === "pendiente" ? undefined : paso.estado}>{ROTULO_DE_ESTADO[paso.estado]}</Chip>
        </header>
        {children}
      </div>
    </li>
  );
}

/** Guarda un cambio del horario y adopta el estado que devuelve. */
function useGuardarHorario() {
  const op = useOperacion<void>();
  const guardar = (cambio: CambioDeHorario) => op.correr(async () => {
    useSeguimientoStore.getState().aplicar(await apiGuardarHorario(cambio));
  }, "No se pudo guardar.");
  return { ...op, guardar };
}

// ---- 1. Públicos y horario de oficina ----------------------------------------------------

function PasoPublicos() {
  const estado = useSeguimientoStore((s) => s.estado);
  const op = useGuardarHorario();
  const [horas, setHoras] = useState<{ desde: string; hasta: string } | null>(null);
  const h = estado?.horario;
  const sorteado = Boolean(h?.sorteado_en);

  const columnas = ((): PulsoTableColumna<CampanaSeguimiento>[] => {
    if (!h) return [];
    const alternar = (lista: readonly string[], id: string, on: boolean) => (on ? [...new Set([...lista, id])] : lista.filter((x) => x !== id));
    return [
      { id: "publico", encabezado: "Público", ancho: 220, celda: (c) => c.publico, valor: (c) => c.publico },
      {
        id: "prueba", encabezado: "En la prueba", ancho: 130,
        celda: (c) => (
          <PulsoSwitch
            size="sm"
            ariaLabel={`${c.publico} en la prueba`}
            checked={h.campanas.includes(c.campaign_id)}
            disabled={op.corriendo || sorteado}
            title={sorteado ? "Los grupos ya se asignaron: para cambiar los públicos hay que volver a asignarlos." : undefined}
            onCheckedChange={(v) => { void op.guardar({ campanas: alternar(h.campanas, c.campaign_id, v) }); }}
          />
        ),
      },
      {
        id: "oficina", encabezado: "Horario de oficina", ancho: 160,
        celda: (c) => (
          <PulsoSwitch
            size="sm"
            ariaLabel={`${c.publico} con horario de oficina`}
            checked={h.oficina.includes(c.campaign_id)}
            disabled={op.corriendo || !h.campanas.includes(c.campaign_id)}
            onCheckedChange={(v) => { void op.guardar({ oficina: alternar(h.oficina, c.campaign_id, v) }); }}
          />
        ),
      },
      {
        id: "enlace", encabezado: "Con enlace", ancho: 130, tipo: "cifra",
        celda: (c) => (c.contactos ? formatoConteo(c.con_enlace) : "Sin contactos"), valor: (c) => c.con_enlace,
      },
    ];
  })();

  if (!estado || !h) return null;
  const desde = horas?.desde ?? h.oficina_desde;
  const hasta = horas?.hasta ?? h.oficina_hasta;
  const horasValidas = esHora(desde) && esHora(hasta) && desde < hasta;
  const guardarHoras = () => {
    if (!horasValidas || (desde === h.oficina_desde && hasta === h.oficina_hasta)) { setHoras(null); return; }
    void op.guardar({ oficina_desde: desde, oficina_hasta: hasta }).then(() => setHoras(null));
  };

  return (
    <>
      <PulsoTable
        ariaLabel="Públicos de la prueba"
        columnas={columnas}
        filas={estado.campanas}
        idDeFila={(c) => c.campaign_id}
        vacio="El estudio no tiene campañas de correo en Mailchimp."
      />
      <PulsoFieldRow geometryGroup="material-campo/correo/seguimiento/horarios/oficina" ariaLabel="Horario de oficina" role="group">
        <PulsoField label="Oficina desde" error={horasValidas ? undefined : "La oficina termina después de empezar."}>
          <PulsoInput type="time" value={desde} disabled={op.corriendo} onChange={(e) => setHoras({ desde: e.target.value, hasta })} onBlur={guardarHoras} />
        </PulsoField>
        <PulsoField label="Oficina hasta">
          <PulsoInput type="time" value={hasta} disabled={op.corriendo} onChange={(e) => setHoras({ desde, hasta: e.target.value })} onBlur={guardarHoras} />
        </PulsoField>
      </PulsoFieldRow>
      <p className="rec-seg-nota">Los públicos con horario de oficina sólo reciben dentro de ese horario.</p>
      {op.error ? <p className="rec-seg-error" role="alert">{op.error}</p> : null}
    </>
  );
}

// ---- 2. Asignación al azar de los grupos -----------------------------------------------------------------

const SORTEADA = "E_COLLECTION_MAIL_PRUEBA_SORTEADA";

function PasoSorteo() {
  const estado = useSeguimientoStore((s) => s.estado);
  const op = useOperacion<void>();
  const [semilla, setSemilla] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  if (!estado) return null;
  const h = estado.horario;
  const valor = semilla ?? String(h.semilla ?? semillaDeHoy());
  const valida = /^\d+$/.test(valor) && Number(valor) >= 1;
  const sorteado = Boolean(h.sorteado_en);

  const sortear = async (rehacer: boolean) => {
    const ok = await op.correr(async () => {
      await apiSortearHorario({ semilla: Number(valor), rehacer });
      await useSeguimientoStore.getState().cargar({ silencioso: true });
    }, "No se pudieron asignar los grupos.");
    if (ok !== null) { setConfirmar(false); setSemilla(null); }
  };
  const pideConfirmar = confirmar || op.codigo === SORTEADA;
  const enPrueba = estado.campanas.filter((c) => h.campanas.includes(c.campaign_id));

  return (
    <>
      <div className="rec-seg-fila">
        <PulsoField label="Semilla" error={valida ? undefined : "Un número entero positivo."}>
          <PulsoInput numeric inputMode="numeric" className="rec-seg-semilla" value={valor} disabled={op.corriendo} onChange={(e) => setSemilla(e.target.value)} />
        </PulsoField>
        <span className="rec-seg-acciones">
          {sorteado ? (
            <PulsoButton variant="secondary" size="sm" disabled={op.corriendo || !valida} onClick={() => setConfirmar(true)}>
              <Shuffle size={14} aria-hidden /> Volver a asignar
            </PulsoButton>
          ) : (
            <PulsoButton variant="primary" size="sm" disabled={op.corriendo || !valida || !h.campanas.length} onClick={() => void sortear(false)}>
              {op.corriendo ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Shuffle size={14} aria-hidden />} Asignar grupos al azar
            </PulsoButton>
          )}
        </span>
      </div>
      {!h.campanas.length ? <p className="rec-seg-nota">Marca primero los públicos de la prueba.</p> : null}
      {pideConfirmar ? (
        <Confirmar
          accion="Sí, volver a asignar"
          ocupado={op.corriendo}
          texto="Cada persona conserva su grupo durante toda la prueba. Volver a asignar cambia los grupos y obliga a poner de nuevo las etiquetas en Mailchimp."
          onCancelar={() => { setConfirmar(false); op.limpiar(); }}
          onConfirmar={() => void sortear(true)}
        />
      ) : null}
      {op.error && op.codigo !== SORTEADA ? <p className="rec-seg-error" role="alert">{op.error}</p> : null}
      {sorteado ? (
        <Resultado
          titulo={`Asignados el ${fechaHoraLegible(h.sorteado_en)} con la semilla ${h.semilla ?? ""}.`}
          lineas={enPrueba.map((c) => ({
            id: c.campaign_id,
            texto: `${c.publico}: grupo A ${conteoConPct(c.grupos.A, c.grupos.A + c.grupos.B)}, grupo B ${conteoConPct(c.grupos.B, c.grupos.A + c.grupos.B)}.`,
          }))}
        />
      ) : null}
    </>
  );
}

// ---- 3. Etiquetas en Mailchimp -----------------------------------------------------------

function PasoEtiquetas() {
  const estado = useSeguimientoStore((s) => s.estado);
  const conexiones = useConexiones();
  const guardado = useGuardarHorario();
  const op = useOperacion<EtiquetasDeGrupo>();
  const [nombres, setNombres] = useState<{ A: string; B: string } | null>(null);
  if (!estado) return null;
  const h = estado.horario;
  const actual = nombres ?? h.etiquetas;
  const validos = actual.A.trim() && actual.B.trim() && actual.A.trim() !== actual.B.trim();
  const guardarNombres = () => {
    if (!validos || (actual.A === h.etiquetas.A && actual.B === h.etiquetas.B)) { setNombres(null); return; }
    void guardado.guardar({ etiquetas: { A: actual.A.trim(), B: actual.B.trim() } }).then(() => setNombres(null));
  };
  const falta = !h.sorteado_en ? "Asigna primero los grupos." : !estado.config.list_id ? "Elige la audiencia en Quién respondió." : !conexiones.mailchimp ? "Falta conectar Mailchimp." : "";

  const etiquetar = () => op.correr(async (onAvance) => {
    const { job_id } = await apiEtiquetarGrupos();
    const r = normalizeEtiquetasDeGrupo(await esperarTrabajo(job_id, onAvance));
    await useSeguimientoStore.getState().cargar({ silencioso: true });
    return r;
  }, "No se pudieron poner las etiquetas.");

  return (
    <>
      <PulsoFieldRow geometryGroup="material-campo/correo/seguimiento/horarios/etiquetas" ariaLabel="Etiquetas de los grupos" role="group">
        <PulsoField label="Etiqueta del grupo A" error={validos ? undefined : "Las dos etiquetas son distintas y no van vacías."}>
          <PulsoInput value={actual.A} maxLength={60} disabled={guardado.corriendo || op.corriendo} onChange={(e) => setNombres({ ...actual, A: e.target.value })} onBlur={guardarNombres} />
        </PulsoField>
        <PulsoField label="Etiqueta del grupo B">
          <PulsoInput value={actual.B} maxLength={60} disabled={guardado.corriendo || op.corriendo} onChange={(e) => setNombres({ ...actual, B: e.target.value })} onBlur={guardarNombres} />
        </PulsoField>
      </PulsoFieldRow>
      <span className="rec-seg-acciones">
        <PulsoButton
          variant={h.etiquetado_en ? "secondary" : "primary"}
          size="sm"
          disabled={Boolean(falta) || op.corriendo}
          title={falta || undefined}
          onClick={() => void etiquetar()}
        >
          {op.corriendo ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Tags size={14} aria-hidden />} Poner las etiquetas en Mailchimp
        </PulsoButton>
      </span>
      {falta ? <p className="rec-seg-nota">{falta}</p> : null}
      {op.corriendo ? <MailchimpAvance avance={op.avance} rotulo="Etiquetando" /> : null}
      {op.error ? <p className="rec-seg-error" role="alert">{op.error}</p> : null}
      {guardado.error ? <p className="rec-seg-error" role="alert">{guardado.error}</p> : null}
      {op.resultado ? (
        <Resultado titulo="Etiquetas puestas en Mailchimp." lineas={resumenDeEtiquetas(op.resultado).map((texto) => ({ texto }))} />
      ) : h.etiquetado_en ? (
        <p className="rec-seg-nota">Puestas el {fechaHoraLegible(h.etiquetado_en)}.</p>
      ) : null}
    </>
  );
}

// ---- 5. Borradores por grupo ---------------------------------------------------------------

function PasoBorradores({ remitente, onRemitente }: { remitente: Remitente; onRemitente: (r: Remitente) => void }) {
  const estado = useSeguimientoStore((s) => s.estado);
  const op = useOperacion<LecturaDeEnvios>();
  if (!estado) return null;
  const conHora = estado.horario.plan.filter((f) => f.programado);
  const creados = conHora.filter((f) => f.mailchimp_id).length;
  const conId = estado.horario.plan.some((f) => f.mailchimp_id);

  const leer = () => op.correr(async () => {
    const r = await apiLeerEnvios();
    await useSeguimientoStore.getState().cargar({ silencioso: true });
    return r;
  }, "No se pudieron leer los envíos.");

  return (
    <>
      <PulsoFieldRow geometryGroup="material-campo/correo/seguimiento/horarios/remitente" ariaLabel="Remitente de los borradores" role="group">
        <PulsoField label="Remitente">
          <PulsoInput
            value={remitente.from_name}
            maxLength={100}
            placeholder="PULSO PUCP"
            autoComplete="organization"
            onChange={(e) => onRemitente({ ...remitente, from_name: e.target.value })}
          />
        </PulsoField>
        <PulsoField label="Correo de respuesta">
          <PulsoInput
            type="email"
            value={remitente.reply_to}
            maxLength={200}
            placeholder="pulso@enviospulso.pucp.edu.pe"
            autoComplete="email"
            onChange={(e) => onRemitente({ ...remitente, reply_to: e.target.value })}
          />
        </PulsoField>
      </PulsoFieldRow>
      <p className="rec-seg-nota">
        {conHora.length
          ? `${formatoConteo(creados)} de ${formatoConteo(conHora.length)} ${conHora.length === 1 ? "borrador creado" : "borradores creados"}. Cada uno se crea desde su celda del plan.`
          : "Los borradores se crean desde cada celda del plan, cuando tiene su hora."}
      </p>
      <span className="rec-seg-acciones">
        <PulsoButton variant="secondary" size="sm" disabled={!conId || op.corriendo} title={conId ? undefined : "Todavía no hay borradores en Mailchimp."} onClick={() => void leer()}>
          {op.corriendo ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Search size={14} aria-hidden />} Leer envíos de Mailchimp
        </PulsoButton>
      </span>
      {op.error ? <p className="rec-seg-error" role="alert">{op.error}</p> : null}
      {op.resultado ? (
        <Resultado
          titulo={`${formatoConteo(op.resultado.leidas)} de ${formatoConteo(op.resultado.con_campana)} ${op.resultado.con_campana === 1 ? "borrador ya salió" : "borradores ya salieron"}.`}
          lineas={[]}
        />
      ) : null}
      <p className="rec-mc-nota">La app no envía: revisa, programa y envía en Mailchimp.</p>
    </>
  );
}
