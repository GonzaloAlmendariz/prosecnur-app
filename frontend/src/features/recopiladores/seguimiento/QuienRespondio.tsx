// Seguimiento > Quién respondió: la audiencia del estudio, la encuesta de cada
// campaña, "Actualizar todas las campañas" (job) con archivado opcional y la
// corrida automática antes de cada envío programado.
//
// Contrato de Superficie: tarjeta de campañas a ancho completo y, debajo, un par
// de tarjetas iguales (`.../respondieron/acciones`, equal).

import { useMemo, useState } from "react";

import {
  apiActualizarTodas,
  apiGuardarConfigSeguimiento,
  normalizeResultadoDeActualizacion,
  type CambioDeConfig,
  type CampanaSeguimiento,
  type ResultadoDeActualizacion,
} from "../../../api/mailSeguimiento";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoField } from "../../../components/PulsoField";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { LoadingBlock } from "../../../components/States";
import { formatoConteo } from "../../../lib/formatoNumero";
import { CalendarClock, CheckCheck, Loader2, RefreshCw, Users } from "../../../vendor/lucide-react";
import { MailchimpAvance } from "../correos/MailchimpAvance";
import { esperarTrabajo } from "../correos/mailchimpTrabajo";
import { conteoConPct, faltaEnCampana, faltaParaActualizar, fechaHoraLegible, resumenDeActualizacion } from "./modeloSeguimiento";
import { AvisoDeConexiones, Resultado, useConexiones } from "./piezas";
import { useSeguimientoStore } from "./store";
import { useOperacion } from "./useOperacion";

const SIN_ENCUESTA = "__sin_encuesta__";

export function QuienRespondio() {
  const estado = useSeguimientoStore((s) => s.estado);
  const carga = useSeguimientoStore((s) => s.carga);
  const opciones = useSeguimientoStore((s) => s.opciones);
  const guardado = useOperacion<void>();

  const guardar = (cambio: CambioDeConfig) => guardado.correr(async () => {
    useSeguimientoStore.getState().aplicar(await apiGuardarConfigSeguimiento(cambio));
  }, "No se pudo guardar.");

  if (!estado) {
    return carga === "error" ? null : <LoadingBlock label="Leyendo las campañas del estudio" />;
  }

  const audiencias = opciones?.mailchimp.audiences ?? [];
  const encuestas = opciones?.surveymonkey.surveys ?? [];

  return (
    <>
      <section className="rec-seg-tarjeta" aria-labelledby="rec-seg-campanas">
        <header className="rec-seg-cabeza">
          <h3 id="rec-seg-campanas" className="rec-seg-titulo"><Users size={16} aria-hidden /> Campañas de Mailchimp</h3>
        </header>
        <AvisoDeConexiones necesita={["mailchimp", "surveymonkey"]} />
        <div className="rec-seg-fila">
          <PulsoField label="Audiencia de Mailchimp">
            <PulsoSelect
              value={estado.config.list_id || undefined}
              placeholder="Elige la audiencia"
              disabled={guardado.corriendo || !audiencias.length}
              options={audiencias.map((a) => ({
                value: a.id,
                label: `${a.name}${a.member_count != null ? ` (${formatoConteo(a.member_count)} contactos)` : ""}`,
              }))}
              onValueChange={(list_id) => { void guardar({ list_id }); }}
            />
          </PulsoField>
        </div>
        <TablaDeCampanas
          campanas={estado.campanas}
          encuestas={encuestas}
          ocupado={guardado.corriendo}
          onEncuesta={(id, survey) => { void guardar({ encuestas: { [id]: survey } }); }}
        />
        {guardado.error ? <p className="rec-seg-error" role="alert">{guardado.error}</p> : null}
      </section>

      <div className="rec-seg-par" data-qa-geometry-group="material-campo/correo/seguimiento/respondieron/acciones" data-qa-geometry-contract="equal">
        <ActualizarTodas onGuardar={guardar} ocupadoGuardando={guardado.corriendo} />
        <AntesDeCadaEnvio onGuardar={guardar} ocupadoGuardando={guardado.corriendo} />
      </div>
    </>
  );
}

function TablaDeCampanas({ campanas, encuestas, ocupado, onEncuesta }: {
  campanas: readonly CampanaSeguimiento[];
  encuestas: readonly { id: string; title: string; response_count: number | null }[];
  ocupado: boolean;
  onEncuesta: (campaignId: string, surveyId: string) => void;
}) {
  const columnas = useMemo<PulsoTableColumna<CampanaSeguimiento>[]>(() => [
    { id: "publico", encabezado: "Público", ancho: 200, celda: (c) => c.publico, valor: (c) => c.publico },
    {
      id: "encuesta",
      encabezado: "Encuesta de SurveyMonkey",
      ancho: 280,
      celda: (c) => (
        <PulsoSelect
          size="sm"
          ariaLabel={`Encuesta de ${c.publico}`}
          value={c.encuesta || SIN_ENCUESTA}
          disabled={ocupado}
          options={[
            { value: SIN_ENCUESTA, label: "Sin encuesta" },
            // La guardada aunque la cuenta conectada ya no la liste: no se pierde en silencio.
            ...(c.encuesta && !encuestas.some((s) => s.id === c.encuesta) ? [{ value: c.encuesta, label: `Encuesta ${c.encuesta}` }] : []),
            ...encuestas.map((s) => ({ value: s.id, label: s.title })),
          ]}
          onValueChange={(v) => onEncuesta(c.campaign_id, v === SIN_ENCUESTA ? "" : v)}
        />
      ),
    },
    {
      id: "enlace", encabezado: "Con enlace", ancho: 130, tipo: "cifra",
      celda: (c) => (c.contactos ? conteoConPct(c.con_enlace, c.personas) : "Sin contactos"),
      valor: (c) => c.con_enlace,
    },
    {
      id: "respondieron", encabezado: "Respondieron", ancho: 150, tipo: "cifra",
      celda: (c) => (c.respondieron == null ? "Sin leer" : conteoConPct(c.respondieron, c.con_enlace)),
      valor: (c) => c.respondieron,
    },
    {
      id: "a-medias", encabezado: "A medias", ancho: 100, tipo: "cifra",
      celda: (c) => (c.a_medias == null ? "Sin leer" : formatoConteo(c.a_medias)),
      valor: (c) => c.a_medias,
    },
    {
      id: "leido", encabezado: "Última lectura", ancho: 170,
      celda: (c) => faltaEnCampana(c) || (c.leido_en ? fechaHoraLegible(c.leido_en) : "Todavía no"),
      valor: (c) => c.leido_en,
    },
  ], [encuestas, ocupado, onEncuesta]);

  return (
    <>
      <PulsoTable
        ariaLabel="Campañas de Mailchimp del estudio"
        columnas={columnas}
        filas={campanas}
        idDeFila={(c) => c.campaign_id}
        vacio="El estudio no tiene campañas de correo en Mailchimp."
      />
      <p className="rec-seg-nota">Los porcentajes de "Respondieron" son sobre quienes tienen enlace personal; los de "Con enlace", sobre los contactos efectivos.</p>
    </>
  );
}

type Acciones = { onGuardar: (cambio: CambioDeConfig) => Promise<void | null>; ocupadoGuardando: boolean };

function ActualizarTodas({ onGuardar, ocupadoGuardando }: Acciones) {
  const estado = useSeguimientoStore((s) => s.estado);
  const conexiones = useConexiones();
  const op = useOperacion<ResultadoDeActualizacion>();
  if (!estado) return null;
  const falta = faltaParaActualizar(estado, conexiones.mailchimp, conexiones.surveymonkey);
  const publicos = Object.fromEntries(estado.campanas.map((c) => [c.campaign_id, c.publico]));
  const resumen = op.resultado ? resumenDeActualizacion(op.resultado, publicos) : null;

  const actualizar = () => op.correr(async (onAvance) => {
    const inicio = await apiActualizarTodas({ archivar: estado.config.archivar });
    const r = normalizeResultadoDeActualizacion(await esperarTrabajo(inicio.job_id, onAvance));
    // Las saltadas al arrancar también se dicen, aunque el job no las devuelva.
    const saltadas = r.saltadas.length ? r.saltadas : inicio.saltadas;
    void useSeguimientoStore.getState().cargar({ silencioso: true });
    return { ...r, saltadas };
  }, "No se pudo actualizar.");

  return (
    <section className="rec-seg-tarjeta" aria-labelledby="rec-seg-actualizar">
      <header className="rec-seg-cabeza">
        <h3 id="rec-seg-actualizar" className="rec-seg-titulo"><CheckCheck size={16} aria-hidden /> Quién respondió</h3>
      </header>
      <PulsoSwitch
        label="Archivar en Mailchimp a quienes respondieron"
        description="Con sus dos correos. Se puede deshacer y lo archivado no se cobra."
        checked={estado.config.archivar}
        disabled={ocupadoGuardando || op.corriendo}
        onCheckedChange={(archivar) => { void onGuardar({ archivar }); }}
      />
      <span className="rec-seg-acciones">
        <PulsoButton variant="primary" size="sm" disabled={Boolean(falta) || op.corriendo} title={falta || undefined} onClick={() => void actualizar()}>
          {op.corriendo ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
          Actualizar todas las campañas
        </PulsoButton>
      </span>
      {falta && !op.corriendo ? <p className="rec-seg-nota">{falta}</p> : null}
      {op.corriendo ? <MailchimpAvance avance={op.avance} rotulo="Leyendo respuestas" /> : null}
      {op.error ? <p className="rec-seg-error" role="alert">{op.error}</p> : null}
      {resumen ? <Resultado titulo={resumen.titulo} lineas={resumen.porCampana.map((l) => ({ id: l.campaign_id, texto: `${l.publico}: ${l.texto}`, error: l.error }))} /> : null}
    </section>
  );
}

function AntesDeCadaEnvio({ onGuardar, ocupadoGuardando }: Acciones) {
  const estado = useSeguimientoStore((s) => s.estado);
  const fondo = useSeguimientoStore((s) => s.fondo);
  const [minutos, setMinutos] = useState<string | null>(null);
  if (!estado) return null;
  const { activo, minutos: guardados } = estado.config.antes_de_envio;
  const proximo = fondo.ultimo?.proximo ?? null;
  const valor = minutos ?? String(guardados);
  const minutosValidos = /^\d+$/.test(valor) && Number(valor) >= 5 && Number(valor) <= 180;

  const guardarMinutos = () => {
    if (!minutosValidos || Number(valor) === guardados) { setMinutos(null); return; }
    void onGuardar({ antes_de_envio: { minutos: Number(valor) } }).then(() => setMinutos(null));
  };

  return (
    <section className="rec-seg-tarjeta" aria-labelledby="rec-seg-antes">
      <header className="rec-seg-cabeza">
        <h3 id="rec-seg-antes" className="rec-seg-titulo"><CalendarClock size={16} aria-hidden /> Antes de cada envío</h3>
      </header>
      <PulsoSwitch
        label="Actualizar antes de cada envío programado"
        description="Corre mientras la app está abierta."
        checked={activo}
        disabled={ocupadoGuardando || !estado.config.list_id}
        onCheckedChange={(v) => { void onGuardar({ antes_de_envio: { activo: v } }); }}
      />
      <div className="rec-seg-fila">
        <PulsoField label="Minutos de anticipación" error={minutosValidos ? undefined : "De 5 a 180 minutos."}>
          <PulsoInput
            numeric
            inputMode="numeric"
            value={valor}
            disabled={ocupadoGuardando}
            onChange={(e) => setMinutos(e.target.value)}
            onBlur={guardarMinutos}
            onKeyDown={(e) => { if (e.key === "Enter") guardarMinutos(); }}
          />
        </PulsoField>
      </div>
      <dl className="rec-seg-datos">
        <div className="rec-seg-dato">
          <dt>Próxima campaña programada</dt>
          <dd>
            {!activo
              ? "Se consulta con la opción encendida"
              : proximo
                ? `${proximo.titulo || "Sin título"}, ${fechaHoraLegible(proximo.send_time)}${proximo.destinatarios != null ? ` (${formatoConteo(proximo.destinatarios)} destinatarios)` : ""}`
                : fondo.ultimo ? "Ninguna programada en Mailchimp" : "Consultando"}
          </dd>
        </div>
        <div className="rec-seg-dato">
          <dt>Última corrida automática</dt>
          <dd>{fondo.corriendo ? "Actualizando ahora" : estado.config.ultima_at ? fechaHoraLegible(estado.config.ultima_at) : "Todavía no corrió"}</dd>
        </div>
      </dl>
      {fondo.error && activo ? <p className="rec-seg-error" role="status">{fondo.error}</p> : null}
    </section>
  );
}
