// Seguimiento > Correo personal (opcional): un segundo correo para una parte de
// quienes no responden. Por campaña se elige la columna con el correo personal;
// una asignación al azar con semilla (80 % por defecto) decide quién lo recibe y
// quién queda de control; "Cargar en Mailchimp" sube el correo personal de los asignados
// (job; los rechazados no se reintentan). El efecto se lee desde el primer envío
// al correo personal, 80 contra 20, por público.
//
// Contrato de Superficie: tarjeta de campañas a ancho completo, un par de
// tarjetas iguales (`.../correo-personal/acciones`, equal) y la tarjeta del efecto.

import { useState } from "react";

import {
  apiCargarCorreoPersonal,
  apiEfectoCorreoPersonal,
  apiGuardarCorreoPersonal,
  apiSortearCorreoPersonal,
  normalizeCargaCorreoPersonal,
  type CambioDeCorreoPersonal,
  type CampanaCorreoPersonal,
  type CargaCorreoPersonal,
  type EfectoCorreoPersonal,
} from "../../../api/mailSeguimiento";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoField, PulsoFieldRow } from "../../../components/PulsoField";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { LoadingBlock } from "../../../components/States";
import { formatoConteo } from "../../../lib/formatoNumero";
import { BarChart3, CalendarClock, Contact, Loader2, Shuffle, Upload } from "../../../vendor/lucide-react";
import { MailchimpAvance } from "../correos/MailchimpAvance";
import { motivoDeFallo } from "../correos/mailchimpPorApiModel";
import { esperarTrabajo } from "../correos/mailchimpTrabajo";
import { aProgramado, fechaHoraLegible, formatoPct, formatoPuntos, semillaDeHoy } from "./modeloSeguimiento";
import { IrA, hrefDeContactos } from "./enlacesDeSeguimiento";
import { AvisoDeConexiones, Chip, Confirmar, Resultado, useConexiones } from "./piezas";
import { TablaDeComparacion } from "./TablaDeComparacion";
import { useSeguimientoStore } from "./store";
import { useOperacion } from "./useOperacion";

const SIN_COLUMNA = "__sin_columna__";
const CARGADO = "E_COLLECTION_MAIL_CORREO_PERSONAL_CARGADO";

export function CorreoPersonal() {
  const estado = useSeguimientoStore((s) => s.estado);
  const carga = useSeguimientoStore((s) => s.carga);
  const guardado = useOperacion<void>();
  const [proporcion, setProporcion] = useState<string | null>(null);
  const [desde, setDesde] = useState<string | null>(null);
  if (!estado) return carga === "error" ? null : <LoadingBlock label="Leyendo el correo personal" />;
  const cp = estado.correo_personal;
  const porId = new Map(estado.campanas.map((c) => [c.campaign_id, c]));

  const guardar = (cambio: CambioDeCorreoPersonal) => guardado.correr(async () => {
    useSeguimientoStore.getState().aplicar(await apiGuardarCorreoPersonal(cambio));
  }, "No se pudo guardar.");

  const pct = proporcion ?? String(Math.round(cp.proporcion * 100));
  const pctValida = /^\d+$/.test(pct) && Number(pct) >= 50 && Number(pct) <= 95;
  const guardarProporcion = () => {
    if (!pctValida || Number(pct) === Math.round(cp.proporcion * 100)) { setProporcion(null); return; }
    void guardar({ proporcion: Number(pct) / 100 }).then(() => setProporcion(null));
  };
  const valorDesde = desde ?? cp.desde;
  const guardarDesde = () => {
    if (desde === null) return;
    const v = aProgramado(desde);
    if ((desde && !v) || v === cp.desde) { setDesde(null); return; }
    void guardar({ desde: v }).then(() => setDesde(null));
  };

  const columnas: PulsoTableColumna<CampanaCorreoPersonal>[] = [
    { id: "publico", encabezado: "Público", ancho: 200, celda: (c) => c.publico, valor: (c) => c.publico },
    {
      id: "columna", encabezado: "Columna con el correo personal", ancho: 260,
      celda: (c) => (c.candidatas.length ? (
        <PulsoSelect
          size="sm"
          ariaLabel={`Columna con el correo personal, ${c.publico}`}
          value={c.columna || SIN_COLUMNA}
          disabled={guardado.corriendo || Boolean(cp.cargado_en)}
          options={[{ value: SIN_COLUMNA, label: "No participa" }, ...c.candidatas.map((k) => ({ value: k.key, label: k.label }))]}
          onValueChange={(v) => { void guardar({ columnas: { [c.campaign_id]: v === SIN_COLUMNA ? "" : v } }); }}
        />
      ) : "Sin columnas con correos"),
    },
    { id: "personal", encabezado: "Correo personal", ancho: 130, tipo: "cifra", celda: (c) => formatoConteo(porId.get(c.campaign_id)?.segundo_correo.personal ?? 0) },
    { id: "control", encabezado: "Control", ancho: 110, tipo: "cifra", celda: (c) => formatoConteo(porId.get(c.campaign_id)?.segundo_correo.control ?? 0) },
    { id: "cargados", encabezado: "Cargados", ancho: 110, tipo: "cifra", celda: (c) => formatoConteo(porId.get(c.campaign_id)?.segundo_correo.cargados ?? 0) },
    { id: "rechazados", encabezado: "Rechazados", ancho: 120, tipo: "cifra", celda: (c) => formatoConteo(porId.get(c.campaign_id)?.segundo_correo.rechazados ?? 0) },
  ];

  if (!cp.campanas.length) {
    return (
      <section className="rec-seg-tarjeta" aria-label="Correo personal" data-qa-geometry-capacity="owned">
        <EstadoVacio
          tamano="normal"
          icono={<Contact size={18} />}
          titulo="El estudio no tiene campañas de correo en Mailchimp"
          descripcion="El correo personal se prueba sobre las campañas de Mailchimp del estudio."
          accion={<IrA href="/material-campo">Ir a Campañas</IrA>}
        />
      </section>
    );
  }
  const sinColumnas = cp.campanas.every((c) => !c.candidatas.length);

  return (
    <>
      <section className="rec-seg-tarjeta" aria-labelledby="rec-seg-cp">
        <header className="rec-seg-cabeza">
          <h3 id="rec-seg-cp" className="rec-seg-titulo"><Contact size={16} aria-hidden /> Correo personal</h3>
          <Chip>Opcional</Chip>
        </header>
        <AvisoDeConexiones necesita={["mailchimp"]} />
        {sinColumnas ? (
          <EstadoVacio
            icono={<Contact size={18} />}
            titulo="Ninguna lista trae una columna con correos personales"
            descripcion="Se agrega como columna de la lista de contactos de cada campaña, con un correo por fila."
            accion={<IrA href={hrefDeContactos(cp.campanas[0].campaign_id)}>Ir a Contactos</IrA>}
          />
        ) : null}
        <PulsoTable
          ariaLabel="Correo personal por campaña"
          columnas={columnas}
          filas={cp.campanas}
          idDeFila={(c) => c.campaign_id}
          vacio="El estudio no tiene campañas de correo en Mailchimp."
        />
        <PulsoFieldRow geometryGroup="material-campo/correo/seguimiento/correo-personal/ajustes" ariaLabel="Ajustes de la asignación" role="group">
          <PulsoField label="Reciben en el correo personal (%)" error={pctValida ? undefined : "De 50 a 95."}>
            <PulsoInput
              numeric
              inputMode="numeric"
              value={pct}
              disabled={guardado.corriendo || Boolean(cp.sorteado_en)}
              onChange={(e) => setProporcion(e.target.value)}
              onBlur={guardarProporcion}
              onKeyDown={(e) => { if (e.key === "Enter") guardarProporcion(); }}
            />
          </PulsoField>
          <PulsoField label="Primer envío al correo personal">
            <PulsoInput
              type="datetime-local"
              value={valorDesde}
              disabled={guardado.corriendo}
              onChange={(e) => setDesde(e.target.value)}
              onBlur={guardarDesde}
            />
          </PulsoField>
        </PulsoFieldRow>
        {guardado.error ? <p className="rec-seg-error" role="alert">{guardado.error}</p> : null}
      </section>

      <div className="rec-seg-par" data-qa-geometry-group="material-campo/correo/seguimiento/correo-personal/acciones" data-qa-geometry-contract="equal">
        <SorteoCorreoPersonal />
        <CargaCorreoPersonalTarjeta />
      </div>

      <EfectoTarjeta />
    </>
  );
}

function SorteoCorreoPersonal() {
  const estado = useSeguimientoStore((s) => s.estado);
  const op = useOperacion<void>();
  const [semilla, setSemilla] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  if (!estado) return null;
  const cp = estado.correo_personal;
  const valor = semilla ?? String(cp.semilla ?? semillaDeHoy());
  const valida = /^\d+$/.test(valor) && Number(valor) >= 1;
  const conColumna = cp.campanas.filter((c) => c.columna);
  const sortear = async (rehacer: boolean) => {
    const ok = await op.correr(async () => {
      await apiSortearCorreoPersonal({ semilla: Number(valor), rehacer });
      await useSeguimientoStore.getState().cargar({ silencioso: true });
    }, "No se pudo hacer la asignación.");
    if (ok !== null) { setConfirmar(false); setSemilla(null); }
  };
  const porId = new Map(estado.campanas.map((c) => [c.campaign_id, c]));

  return (
    <section className="rec-seg-tarjeta" aria-labelledby="rec-seg-cp-asignacion">
      <header className="rec-seg-cabeza">
        <h3 id="rec-seg-cp-asignacion" className="rec-seg-titulo"><Shuffle size={16} aria-hidden /> Asignación al azar</h3>
        {cp.sorteado_en ? <Chip tono="hecho">Hecho</Chip> : null}
      </header>
      <div className="rec-seg-fila">
        <PulsoField label="Semilla" error={valida ? undefined : "Un número entero positivo."}>
          <PulsoInput numeric inputMode="numeric" className="rec-seg-semilla" value={valor} disabled={op.corriendo} onChange={(e) => setSemilla(e.target.value)} />
        </PulsoField>
        <span className="rec-seg-acciones">
          {cp.sorteado_en ? (
            <PulsoButton variant="secondary" size="sm" disabled={op.corriendo || !valida} onClick={() => setConfirmar(true)}>
              <Shuffle size={14} aria-hidden /> Volver a asignar
            </PulsoButton>
          ) : (
            <PulsoButton variant="primary" size="sm" disabled={op.corriendo || !valida || !conColumna.length} title={conColumna.length ? undefined : "Elige la columna de al menos una campaña."} onClick={() => void sortear(false)}>
              {op.corriendo ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Shuffle size={14} aria-hidden />} Asignar al azar
            </PulsoButton>
          )}
        </span>
      </div>
      {confirmar || op.codigo === CARGADO ? (
        <Confirmar
          accion="Sí, volver a asignar"
          ocupado={op.corriendo}
          texto={cp.cargado_en
            ? "Los correos personales ya se cargaron en Mailchimp. Volver a asignar cambia quién es control y el efecto deja de poder medirse."
            : "Volver a asignar cambia quién recibe en el correo personal y quién queda de control."}
          onCancelar={() => { setConfirmar(false); op.limpiar(); }}
          onConfirmar={() => void sortear(true)}
        />
      ) : null}
      {op.error && op.codigo !== CARGADO ? <p className="rec-seg-error" role="alert">{op.error}</p> : null}
      {cp.sorteado_en ? (
        <Resultado
          titulo={`Asignados el ${fechaHoraLegible(cp.sorteado_en)} con la semilla ${cp.semilla ?? ""}.`}
          lineas={conColumna.map((c) => {
            const s = porId.get(c.campaign_id)?.segundo_correo;
            return { id: c.campaign_id, texto: `${c.publico}: ${formatoConteo(s?.personal ?? 0)} con correo personal, ${formatoConteo(s?.control ?? 0)} de control.` };
          })}
        />
      ) : null}
    </section>
  );
}

function CargaCorreoPersonalTarjeta() {
  const estado = useSeguimientoStore((s) => s.estado);
  const conexiones = useConexiones();
  const op = useOperacion<CargaCorreoPersonal>();
  if (!estado) return null;
  const cp = estado.correo_personal;
  const publicos = Object.fromEntries(estado.campanas.map((c) => [c.campaign_id, c.publico]));
  const falta = !cp.sorteado_en ? "Asigna primero al azar." : !estado.config.list_id ? "Elige la audiencia en Quién respondió." : !conexiones.mailchimp ? "Falta conectar Mailchimp." : "";

  const cargar = () => op.correr(async (onAvance) => {
    const { job_id } = await apiCargarCorreoPersonal();
    const r = normalizeCargaCorreoPersonal(await esperarTrabajo(job_id, onAvance));
    await useSeguimientoStore.getState().cargar({ silencioso: true });
    return r;
  }, "No se pudieron cargar los correos personales.");

  return (
    <section className="rec-seg-tarjeta" aria-labelledby="rec-seg-cp-carga">
      <header className="rec-seg-cabeza">
        <h3 id="rec-seg-cp-carga" className="rec-seg-titulo"><Upload size={16} aria-hidden /> Carga en Mailchimp</h3>
        {cp.cargado_en ? <Chip tono="hecho">Hecho</Chip> : null}
      </header>
      <span className="rec-seg-acciones">
        <PulsoButton variant={cp.cargado_en ? "secondary" : "primary"} size="sm" disabled={Boolean(falta) || op.corriendo} title={falta || undefined} onClick={() => void cargar()}>
          {op.corriendo ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Upload size={14} aria-hidden />} Cargar en Mailchimp
        </PulsoButton>
      </span>
      {falta ? <p className="rec-seg-nota">{falta}</p> : null}
      <p className="rec-seg-nota">Los correos que Mailchimp rechaza no se reintentan.</p>
      {op.corriendo ? <MailchimpAvance avance={op.avance} rotulo="Subiendo correos personales" /> : null}
      {op.error ? <p className="rec-seg-error" role="alert">{op.error}</p> : null}
      {op.resultado ? (
        <Resultado
          titulo="Carga terminada."
          lineas={op.resultado.campanas.map((c) => ({
            id: c.campaign_id,
            error: c.rechazados > 0,
            texto: `${publicos[c.campaign_id] ?? c.campaign_id}: ${formatoConteo(c.cargados)} ${c.cargados === 1 ? "cargado" : "cargados"}, ${formatoConteo(c.rechazados)} ${c.rechazados === 1 ? "rechazado" : "rechazados"}${c.motivos.length ? ` (${c.motivos.map((m) => `${formatoConteo(m.n)} por ${motivoDeFallo(m.code)}`).join("; ")})` : ""}.`,
          }))}
        />
      ) : cp.cargado_en ? <p className="rec-seg-nota">Cargados el {fechaHoraLegible(cp.cargado_en)}.</p> : null}
    </section>
  );
}

function EfectoTarjeta() {
  const estado = useSeguimientoStore((s) => s.estado);
  const op = useOperacion<EfectoCorreoPersonal>();
  if (!estado) return null;
  const cp = estado.correo_personal;
  const falta = !cp.sorteado_en ? "Asigna primero al azar." : !cp.desde ? "Indica el primer envío al correo personal." : "";
  const e = op.resultado;
  const t = e?.total ?? null;

  return (
    <section className="rec-seg-tarjeta" aria-labelledby="rec-seg-cp-efecto">
      <header className="rec-seg-cabeza">
        <h3 id="rec-seg-cp-efecto" className="rec-seg-titulo"><BarChart3 size={16} aria-hidden /> Efecto del correo personal</h3>
        {cp.desde ? <Chip><CalendarClock size={12} aria-hidden /> Desde {fechaHoraLegible(cp.desde)}</Chip> : null}
      </header>
      <span className="rec-seg-acciones">
        <PulsoButton variant="secondary" size="sm" disabled={Boolean(falta) || op.corriendo} title={falta || undefined} onClick={() => void op.correr(() => apiEfectoCorreoPersonal(), "No se pudo leer el efecto.")}>
          {op.corriendo ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <BarChart3 size={14} aria-hidden />} Leer el efecto
        </PulsoButton>
      </span>
      {falta ? <p className="rec-seg-nota">{falta}</p> : null}
      {op.error ? <p className="rec-seg-error" role="alert">{op.error}</p> : null}
      {e && t && t.xA + t.xB > 0 ? (
        <>
          <dl className="rec-seg-ab">
            <div className="rec-seg-brazo is-a">
              <dt>Correo personal</dt>
              <dd>{formatoPct(t.pctA)}</dd>
              <small>{formatoConteo(t.xA)} de {formatoConteo(t.nA)}</small>
            </div>
            <div className="rec-seg-brazo is-b">
              <dt>Control</dt>
              <dd>{formatoPct(t.pctB)}</dd>
              <small>{formatoConteo(t.xB)} de {formatoConteo(t.nB)}</small>
            </div>
            <div>
              <dt>Diferencia</dt>
              <dd>{formatoPuntos(t.dif_pp)}</dd>
              <small>{e.cmh?.p_txt ?? ""}</small>
            </div>
          </dl>
          {e.lectura ? <p className="rec-seg-lectura">{e.lectura}</p> : null}
          <TablaDeComparacion
            ariaLabel="Efecto del correo personal por público"
            filas={e.publicos}
            total={t}
            nombreA="Correo personal"
            nombreB="Control"
            rotuloDiferencia="Diferencia, personal menos control"
          />
          {e.rechazados ? (
            <p className="rec-seg-nota">
              {formatoConteo(e.rechazados)} {e.rechazados === 1 ? "correo rechazado sigue" : "correos rechazados siguen"} en el grupo del correo personal.
            </p>
          ) : null}
        </>
      ) : e ? (
        <EstadoVacio
          icono={<BarChart3 size={18} />}
          titulo="Todavía no hay completas que medir"
          descripcion={e.lectura || "Nadie de la medición completó la encuesta desde el primer envío al correo personal."}
        />
      ) : null}
    </section>
  );
}
