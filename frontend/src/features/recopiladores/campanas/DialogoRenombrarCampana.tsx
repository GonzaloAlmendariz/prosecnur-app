// Renombrar una campaña (ADR 0111): `?panel=campana-renombrar&foco=<id>`.
//
// Un correo cambia también su actor y su plataforma; pasar a SurveyMonkey
// olvida la lista de destinatarios y se dice ANTES de guardar. La campaña de
// aulas sólo cambia su nombre.

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useState, type FormEvent } from "react";

import type { CampanaMaterial } from "../../../api/materialCampanas";
import { MAIL_PLATFORMS, type MailPlatform } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import type { ControlPanel } from "../../../lib/navegacion/paneles";
import { X } from "../../../vendor/lucide-react";
import { NOMBRE_DE_PLATAFORMA } from "../correos/dialectos";
import { LARGO_ACTOR, LARGO_NOMBRE, problemaDelActor, problemaDelNombre } from "../correos/modeloCampanas";
import type { Resultado } from "./DialogoNuevaCampana";
import "../correos/correosCampanas.css";
import "./campanas.css";

type Props = {
  panel: ControlPanel;
  campana: CampanaMaterial | null;
  ocupado: boolean;
  onGuardar: (campana: CampanaMaterial, cambio: { name: string; actor: string; platform?: MailPlatform }) => Promise<Resultado>;
  onCerrar: () => void;
};

export function DialogoRenombrarCampana({ panel, campana, ocupado, onGuardar, onCerrar }: Props) {
  const ids = useId();
  const plataformaActual = campana?.estado?.tipo === "correo" ? campana.estado.platform : null;
  const [nombre, setNombre] = useState("");
  const [actor, setActor] = useState("");
  const [plataforma, setPlataforma] = useState<MailPlatform>("mailchimp");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!panel.abierto || !campana) return;
    setNombre(campana.name);
    setActor(campana.actor);
    setPlataforma(plataformaActual ?? "mailchimp");
    setError("");
  }, [campana, panel.abierto, plataformaActual]);

  const esCorreo = campana?.tipo === "correo";
  const problema = problemaDelNombre(nombre) ?? (esCorreo ? problemaDelActor(actor) : null);
  const borraLista = esCorreo && plataforma === "surveymonkey" && plataformaActual !== "surveymonkey";

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!campana || problema) return;
    const out = await onGuardar(campana, { name: nombre, actor, ...(esCorreo ? { platform: plataforma } : {}) });
    if (!out.ok) setError(out.mensaje);
  };

  return (
    <Dialog.Root open={panel.abierto && campana !== null} onOpenChange={(siguiente) => { if (!siguiente && !ocupado) onCerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="rec-camp-velo" />
        <Dialog.Content className="rec-nueva" {...panel.props} data-audit-ready="true" aria-busy={ocupado} aria-describedby={`${ids}-desc`}>
          <header className="rec-nueva-cabeza">
            <span>
              <Dialog.Title className="rec-nueva-titulo">Renombrar campaña</Dialog.Title>
              <Dialog.Description id={`${ids}-desc`} className="rec-nueva-desc">
                {esCorreo ? "El nombre, a quién va y por qué plataforma sale." : "El nombre con el que la campaña aparece en la lista."}
              </Dialog.Description>
            </span>
            <Dialog.Close asChild>
              <PulsoButton variant="icon" size="sm" aria-label="Cerrar" disabled={ocupado}><X size={16} aria-hidden /></PulsoButton>
            </Dialog.Close>
          </header>
          <form id={`${ids}-form`} className="rec-nueva-cuerpo" onSubmit={(e) => { void guardar(e); }}>
            <span className="rec-nueva-campos">
              <label className="rec-camp-campo rec-nueva-campo">
                <span>Nombre</span>
                <input autoFocus value={nombre} maxLength={LARGO_NOMBRE} aria-invalid={problema ? true : undefined} onChange={(e) => setNombre(e.target.value)} />
              </label>
              {esCorreo ? (
                <label className="rec-camp-campo rec-nueva-campo">
                  <span>Actor</span>
                  <input value={actor} maxLength={LARGO_ACTOR} placeholder="Estudiantes, docentes…" onChange={(e) => setActor(e.target.value)} />
                </label>
              ) : null}
            </span>
            {esCorreo ? (
              <fieldset className="rec-nueva-plataformas">
                <legend>Sale por</legend>
                <span className="rec-nueva-plataformas-opciones">
                  {MAIL_PLATFORMS.map((p) => (
                    <label key={p} className={`rec-nueva-plataforma${plataforma === p ? " is-on" : ""}`}>
                      <input type="radio" name={`${ids}-plataforma`} value={p} checked={plataforma === p} onChange={() => setPlataforma(p)} />
                      <span><b>{NOMBRE_DE_PLATAFORMA[p]}</b></span>
                    </label>
                  ))}
                </span>
              </fieldset>
            ) : null}
            {borraLista ? (
              <p className="rec-camp-mensaje is-warning" role="alert">
                Con SurveyMonkey los contactos viven en su recopilador: al guardar se borra la lista de destinatarios de esta campaña.
              </p>
            ) : null}
          </form>
          <footer className="rec-nueva-pie">
            {problema ? <span className="rec-nueva-problema" role="alert">{problema}</span> : null}
            {error ? <span className="rec-nueva-problema" role="alert">{error}</span> : null}
            <PulsoButton variant="secondary" size="sm" type="button" disabled={ocupado} onClick={onCerrar}>Cancelar</PulsoButton>
            <PulsoButton variant={borraLista ? "danger" : "primary"} size="sm" type="submit" form={`${ids}-form`} disabled={ocupado || Boolean(problema)}>
              {borraLista ? "Guardar y borrar la lista" : "Guardar"}
            </PulsoButton>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
