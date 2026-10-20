// Campañas de correo (E1h): crear, duplicar, renombrar y borrar.
//
// Panel direccionable `?panel=correo-campanas` (clase «dialogo»). Cada fila es
// una campaña: su nombre, su actor, su asunto y si tiene destinatarios en esta
// sesión. Borrar no se hace aquí: abre `correo-campana-borrar`, que pide dos
// confirmaciones. Duplicar copia la plantilla y nunca los destinatarios.
//
// Contrato de Superficie:
// - C1: `material-campo/catalogo/correos-campanas`, contrato equal, una fila
//   por campaña como miembro.
// - C2/C4: ancho fijo por viewport, alto tope de la ventana y un único dueño de
//   scroll (`.rec-camp-dialogo-cuerpo`); título y «Nueva campaña» quedan fijos.

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useState, type FormEvent } from "react";

import { MAIL_PLATFORMS, type MailCampaignSummary, type MailPlatform, type MailPreset } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import type { ControlPanel } from "../../../lib/navegacion/paneles";
import { Copy, FileCode2, FolderOpen, Loader2, Pencil, Plus, Send, Trash2, Users, X } from "../../../vendor/lucide-react";
import { NOMBRE_DE_PLATAFORMA, RESUMEN_DE_PLATAFORMA } from "./dialectos";
import { origenDePreset } from "./modeloCorreo";
import {
  LARGO_ACTOR,
  LARGO_NOMBRE,
  LIMITE_CAMPANAS,
  ORIGEN_EN_BLANCO,
  nombreLibre,
  problemaDelActor,
  problemaDelNombre,
} from "./modeloCampanas";
import type { AccionesDeCampanas } from "./useCampanas";
import "./correosEnvios.css";

type Edicion =
  | { tipo: "ninguna" }
  | { tipo: "renombrar"; id: string; name: string; actor: string; platform: MailPlatform }
  /** Abrir otra campaña con cambios sin guardar: se confirma en la fila. */
  | { tipo: "abrir"; id: string };

type Nueva = { name: string; actor: string; origen: string; platform: MailPlatform };

/** Elegir la plataforma: dos opciones con su consecuencia en una línea. */
function ElegirPlataforma({ nombre, valor, onCambio }: { nombre: string; valor: MailPlatform; onCambio: (p: MailPlatform) => void }) {
  return (
    <fieldset className="rec-camp-plataforma">
      <legend>Sale por</legend>
      {MAIL_PLATFORMS.map((p) => (
        <label key={p} className={`rec-camp-origen-op${valor === p ? " is-on" : ""}`}>
          <input type="radio" name={nombre} value={p} checked={valor === p} onChange={() => onCambio(p)} />
          <span>
            <b>{NOMBRE_DE_PLATAFORMA[p]}</b>
            <small>{RESUMEN_DE_PLATAFORMA[p]}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

type Props = {
  panel: ControlPanel;
  campanas: readonly MailCampaignSummary[];
  activa: string | null;
  presets: readonly MailPreset[];
  ocupado: boolean;
  /** La campaña abierta tiene cambios sin guardar que se perderían al abrir otra. */
  conCambios: boolean;
  acciones: Pick<AccionesDeCampanas, "crear" | "duplicar" | "renombrar">;
  /** Abre «Importar un correo existente». */
  onImportar: () => void;
  /** Abre la campaña (y cierra el diálogo). */
  onAbrir: (campaignId: string) => void;
  /** Pide borrar: abre el diálogo de dos pasos. */
  onBorrar: (campaignId: string) => void;
};

const fecha = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function cuando(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : fecha.format(d);
}

export function DialogoCampanas({ panel, campanas, activa, presets, ocupado, conCambios, acciones, onImportar, onAbrir, onBorrar }: Props) {
  const ids = useId();
  const [edicion, setEdicion] = useState<Edicion>({ tipo: "ninguna" });
  const [nueva, setNueva] = useState<Nueva>({ name: "", actor: "", origen: presets[0]?.preset_id ?? ORIGEN_EN_BLANCO, platform: "mailchimp" });
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const { abierto, cerrar } = panel;
  const lleno = campanas.length >= LIMITE_CAMPANAS;

  useEffect(() => {
    if (abierto) return;
    setEdicion({ tipo: "ninguna" });
    setMensaje(null);
  }, [abierto]);

  // El origen elegido por defecto es la primera plantilla real cuando llegan los presets.
  useEffect(() => {
    if (!presets.length) return;
    setNueva((n) => (n.origen === ORIGEN_EN_BLANCO && !n.name ? { ...n, origen: presets[0].preset_id } : n));
  }, [presets]);

  const problemaNueva = nueva.name.trim() ? problemaDelNombre(nueva.name) ?? problemaDelActor(nueva.actor) : null;

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    const nombre = nueva.name.trim();
    const problema = problemaDelNombre(nombre) ?? problemaDelActor(nueva.actor);
    if (problema) {
      setMensaje({ tono: "error", texto: problema });
      return;
    }
    setMensaje(null);
    const out = await acciones.crear({ name: nombreLibre(nombre, campanas), actor: nueva.actor, origen: nueva.origen, platform: nueva.platform });
    if (!out.ok) {
      setMensaje({ tono: "error", texto: out.mensaje });
      return;
    }
    setNueva((n) => ({ ...n, name: "", actor: "" }));
    onAbrir(out.campaignId);
  };

  const duplicar = async (c: MailCampaignSummary) => {
    setMensaje(null);
    const out = await acciones.duplicar(c);
    setMensaje(out.ok
      ? { tono: "ok", texto: "Campaña duplicada. Los destinatarios no se copian: se importan en la copia." }
      : { tono: "error", texto: out.mensaje });
  };

  const guardarNombre = async (e: FormEvent) => {
    e.preventDefault();
    if (edicion.tipo !== "renombrar") return;
    const problema = problemaDelNombre(edicion.name) ?? problemaDelActor(edicion.actor);
    if (problema) {
      setMensaje({ tono: "error", texto: problema });
      return;
    }
    const out = await acciones.renombrar(edicion.id, edicion.name, edicion.actor, edicion.platform);
    if (!out.ok) {
      setMensaje({ tono: "error", texto: out.mensaje });
      return;
    }
    setMensaje(out.aviso ? { tono: "ok", texto: out.aviso } : null);
    setEdicion({ tipo: "ninguna" });
  };

  return (
    <Dialog.Root open={abierto} onOpenChange={(siguiente) => { if (!siguiente && !ocupado) cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="rec-camp-velo" />
        <Dialog.Content
          className="rec-camp-dialogo"
          {...panel.props}
          // Se monta sólo con la lista de campañas leída (o fallida): ya está listo.
          data-audit-ready="true"
          aria-busy={ocupado}
          aria-describedby={`${ids}-desc`}
        >
          <header className="rec-camp-dialogo-cabeza">
            <span>
              <Dialog.Title className="rec-camp-dialogo-titulo">Campañas de correo</Dialog.Title>
              <Dialog.Description id={`${ids}-desc`} className="rec-camp-dialogo-desc">
                Cada campaña es un correo con su plantilla, sus envíos y su salida para Mailchimp o SurveyMonkey.
              </Dialog.Description>
            </span>
            <Dialog.Close asChild>
              <PulsoButton variant="icon" size="sm" aria-label="Cerrar" disabled={ocupado}>
                <X size={16} aria-hidden />
              </PulsoButton>
            </Dialog.Close>
          </header>

          <div className="rec-camp-dialogo-cuerpo" data-qa-geometry-capacity="owned">
            {campanas.length ? (
              <ul
                className="rec-camp-filas"
                data-qa-geometry-group="material-campo/catalogo/correos-campanas"
                data-qa-geometry-contract="equal"
                aria-label="Campañas del proyecto"
              >
                {campanas.map((c) => {
                  const actual = c.campaign_id === activa;
                  const editando = edicion.tipo === "renombrar" && edicion.id === c.campaign_id ? edicion : null;
                  // Pasar a SurveyMonkey borra la lista de destinatarios: se dice ANTES de guardar.
                  const borraLista = editando ? editando.platform === "surveymonkey" && c.platform !== "surveymonkey" : false;
                  const porAbrir = edicion.tipo === "abrir" && edicion.id === c.campaign_id;
                  return (
                    <li key={c.campaign_id} className={`rec-camp-fila${actual ? " is-active" : ""}`} data-qa-geometry-member>
                      {porAbrir ? (
                        <div className="rec-camp-fila-confirmar" role="alert">
                          <span>La campaña abierta tiene cambios sin guardar. Si abres <b>{c.name}</b>, se descartan.</span>
                          <span className="rec-camp-fila-acciones">
                            <PulsoButton variant="secondary" size="sm" autoFocus onClick={() => setEdicion({ tipo: "ninguna" })}>
                              Seguir aquí
                            </PulsoButton>
                            <PulsoButton variant="danger" size="sm" onClick={() => { setEdicion({ tipo: "ninguna" }); onAbrir(c.campaign_id); }}>
                              Descartar y abrir
                            </PulsoButton>
                          </span>
                        </div>
                      ) : editando ? (
                        <form className="rec-camp-renombrar" onSubmit={(e) => { void guardarNombre(e); }}>
                          <label className="rec-camp-campo">
                            <span>Nombre</span>
                            <input
                              autoFocus
                              value={editando.name}
                              maxLength={LARGO_NOMBRE}
                              onChange={(e) => setEdicion({ ...editando, name: e.target.value })}
                            />
                          </label>
                          <label className="rec-camp-campo">
                            <span>Actor</span>
                            <input
                              value={editando.actor}
                              maxLength={LARGO_ACTOR}
                              placeholder="Estudiantes, docentes…"
                              onChange={(e) => setEdicion({ ...editando, actor: e.target.value })}
                            />
                          </label>
                          <ElegirPlataforma
                            nombre={`${ids}-plataforma-${c.campaign_id}`}
                            valor={editando.platform}
                            onCambio={(platform) => setEdicion({ ...editando, platform })}
                          />
                          {borraLista ? (
                            <p className="rec-camp-mensaje is-warning rec-camp-aviso-plataforma" role="alert">
                              Con SurveyMonkey los contactos viven en su recopilador: al guardar se borra
                              {c.recipients_loaded ? " la lista de destinatarios importada en esta campaña." : " cualquier lista de destinatarios de esta campaña."}
                            </p>
                          ) : null}
                          <span className="rec-camp-fila-acciones">
                            <PulsoButton variant="secondary" size="sm" type="button" onClick={() => setEdicion({ tipo: "ninguna" })}>
                              Cancelar
                            </PulsoButton>
                            <PulsoButton variant={borraLista ? "danger" : "primary"} size="sm" type="submit" disabled={ocupado || !editando.name.trim()}>
                              {borraLista ? "Guardar y borrar la lista" : "Guardar"}
                            </PulsoButton>
                          </span>
                        </form>
                      ) : (
                        <>
                          <span className="rec-camp-fila-textos">
                            <span className="rec-camp-fila-nombre">
                              <b>{c.name}</b>
                              <span className="rec-camp-chip is-plataforma">{NOMBRE_DE_PLATAFORMA[c.platform]}</span>
                              {c.recipients_loaded ? <span className="rec-camp-chip">Con destinatarios</span> : null}
                            </span>
                            <span className="rec-camp-fila-meta">
                              {c.actor ? <span><Users size={12} aria-hidden /> {c.actor}</span> : <span className="is-suave">Sin actor</span>}
                              {c.sends.length > 1 ? <span><Send size={12} aria-hidden /> {c.sends.length} envíos</span> : null}
                              {c.subject ? <span className="rec-camp-fila-asunto" title={`Asunto: ${c.subject}`}>Asunto: {c.subject}</span> : null}
                              {cuando(c.updated_at) ? <span className="is-suave">Editada {cuando(c.updated_at)}</span> : null}
                            </span>
                          </span>
                          <span className="rec-camp-fila-acciones">
                            <PulsoButton
                              variant={actual ? "ghost" : "secondary"}
                              size="sm"
                              disabled={actual || ocupado}
                              onClick={() => {
                                if (conCambios) setEdicion({ tipo: "abrir", id: c.campaign_id });
                                else onAbrir(c.campaign_id);
                              }}
                            >
                              <FolderOpen size={14} aria-hidden /> {actual ? "Abierta" : "Abrir"}
                            </PulsoButton>
                            <PulsoButton
                              variant="icon"
                              size="sm"
                              aria-label={`Renombrar ${c.name}`}
                              title="Renombrar"
                              disabled={ocupado}
                              onClick={() => { setMensaje(null); setEdicion({ tipo: "renombrar", id: c.campaign_id, name: c.name, actor: c.actor, platform: c.platform }); }}
                            >
                              <Pencil size={14} aria-hidden />
                            </PulsoButton>
                            <PulsoButton
                              variant="icon"
                              size="sm"
                              aria-label={`Duplicar ${c.name}`}
                              title={lleno ? `Hasta ${LIMITE_CAMPANAS} campañas por proyecto` : "Duplicar"}
                              disabled={ocupado || lleno}
                              onClick={() => { void duplicar(c); }}
                            >
                              <Copy size={14} aria-hidden />
                            </PulsoButton>
                            <PulsoButton
                              variant="icon"
                              size="sm"
                              aria-label={`Borrar ${c.name}`}
                              title="Borrar"
                              className="rec-camp-borrar"
                              disabled={ocupado}
                              onClick={() => onBorrar(c.campaign_id)}
                            >
                              <Trash2 size={14} aria-hidden />
                            </PulsoButton>
                          </span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rec-camp-sin-filas">Todavía no hay campañas de correo. Crea la primera abajo.</p>
            )}
            {mensaje ? (
              <p className={`rec-camp-mensaje is-${mensaje.tono}`} role={mensaje.tono === "error" ? "alert" : "status"}>
                {mensaje.texto}
              </p>
            ) : null}
          </div>

          <form className="rec-camp-nueva" onSubmit={(e) => { void crear(e); }} aria-labelledby={`${ids}-nueva`}>
            <h3 id={`${ids}-nueva`} className="rec-camp-nueva-titulo">Nueva campaña</h3>
            {lleno ? (
              <p className="rec-camp-mensaje is-info">
                Un proyecto admite hasta {LIMITE_CAMPANAS} campañas de correo. Borra una para crear otra.
              </p>
            ) : (
              <>
                <span className="rec-camp-nueva-campos">
                  <label className="rec-camp-campo">
                    <span>Nombre</span>
                    <input
                      value={nueva.name}
                      maxLength={LARGO_NOMBRE}
                      placeholder="Invitación docentes"
                      aria-invalid={problemaNueva ? true : undefined}
                      onChange={(e) => setNueva({ ...nueva, name: e.target.value })}
                    />
                  </label>
                  <label className="rec-camp-campo">
                    <span>Actor</span>
                    <input
                      value={nueva.actor}
                      maxLength={LARGO_ACTOR}
                      placeholder="Docentes"
                      onChange={(e) => setNueva({ ...nueva, actor: e.target.value })}
                    />
                  </label>
                </span>
                <fieldset className="rec-camp-origen">
                  <legend>Empieza desde</legend>
                  {presets.map((p) => (
                    <label key={p.preset_id} className={`rec-camp-origen-op${nueva.origen === p.preset_id ? " is-on" : ""}`}>
                      <input
                        type="radio"
                        name={`${ids}-origen`}
                        value={p.preset_id}
                        checked={nueva.origen === p.preset_id}
                        onChange={() => setNueva({ ...nueva, origen: p.preset_id })}
                      />
                      <span>
                        <b>{p.title}</b>
                        {origenDePreset(p.preset_id) ? <small>{origenDePreset(p.preset_id)}</small> : null}
                      </span>
                    </label>
                  ))}
                  <label className={`rec-camp-origen-op${nueva.origen === ORIGEN_EN_BLANCO ? " is-on" : ""}`}>
                    <input
                      type="radio"
                      name={`${ids}-origen`}
                      value={ORIGEN_EN_BLANCO}
                      checked={nueva.origen === ORIGEN_EN_BLANCO}
                      onChange={() => setNueva({ ...nueva, origen: ORIGEN_EN_BLANCO })}
                    />
                    <span>
                      <b>En blanco</b>
                      <small>Saludo, un párrafo, firma y pie</small>
                    </span>
                  </label>
                  <button type="button" className="rec-camp-origen-op rec-camp-origen-importar" disabled={ocupado} onClick={onImportar}>
                    <FileCode2 size={16} aria-hidden />
                    <span>
                      <b>Desde un correo existente…</b>
                      <small>Un HTML de Mailchimp, SurveyMonkey u otro</small>
                    </span>
                  </button>
                </fieldset>
                <ElegirPlataforma nombre={`${ids}-plataforma-nueva`} valor={nueva.platform} onCambio={(platform) => setNueva({ ...nueva, platform })} />
                <span className="rec-camp-nueva-acciones">
                  {conCambios && !problemaNueva ? (
                    <span className="rec-camp-nueva-nota">La campaña abierta tiene cambios sin guardar: se descartan al abrir la nueva.</span>
                  ) : null}
                  {problemaNueva ? <span className="rec-camp-nueva-problema" role="alert">{problemaNueva}</span> : null}
                  <PulsoButton variant="primary" size="sm" type="submit" disabled={ocupado || !nueva.name.trim() || Boolean(problemaNueva)}>
                    {ocupado ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
                    Crear campaña
                  </PulsoButton>
                </span>
              </>
            )}
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
