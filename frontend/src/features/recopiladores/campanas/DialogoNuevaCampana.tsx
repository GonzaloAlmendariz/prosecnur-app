// «Nueva campaña» (ADR 0111 §2): primero el tipo, después lo que ese tipo pide.
//
// Panel direccionable `?panel=nueva-campana` (clase «dialogo»). Se ven los tipos
// que el estudio declara en el Planner (todos si no declaró perfiles, ADR 0122 P2);
// el que no se puede crear dice por qué (aulas y territorial
// si el proyecto ya tiene la suya; territorial sin muestra enviada desde Hojas
// de ruta). La territorial pide la fase cuando piloto y campo real tienen envío. Un correo nace de una plantilla real, en
// blanco o de un correo existente (abre «Importar un correo existente»).
//
// Contrato de Superficie:
// - C1: `material-campo/campanas/nueva-tipos` y `…/nueva-origenes` (equal),
//   una opción por miembro.
// - C2/C4: ancho fijo por viewport, alto tope de la ventana y un único dueño de
//   scroll (`.rec-nueva-cuerpo`); título y pie quedan fijos.

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import type { RegistroDeCampanas, TipoDeCampana } from "../../../api/materialCampanas";
import type { FaseTerritorial } from "../../../api/materialTerritorial";
import { MAIL_PLATFORMS, type MailPlatform, type MailPreset } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import type { ControlPanel } from "../../../lib/navegacion/paneles";
import { ArrowLeft, FileCode2, FilePlus2, Loader2, Plus, X } from "../../../vendor/lucide-react";
import { NOMBRE_DE_PLATAFORMA, RESUMEN_DE_PLATAFORMA } from "../correos/dialectos";
import { LARGO_ACTOR, LARGO_NOMBRE, ORIGEN_EN_BLANCO, problemaDelActor, problemaDelNombre } from "../correos/modeloCampanas";
import { ContadorDeNombre } from "./ContadorDeNombre";
import { origenDePreset } from "../correos/modeloCorreo";
import { AvisoDeNombreRepetido } from "./AvisoDeNombreRepetido";
import { hrefDeCampana } from "./direccionDeCampanas";
import { useFocoDeRetorno } from "./focoDeRetorno";
import { NOMBRE_CAMPANA_AULAS, NOMBRE_CAMPANA_TELEFONICA, NOMBRE_CAMPANA_TERRITORIAL, NOMBRE_DE_ACREDITACION, QUE_ES_EL_TIPO, ROTULO_DE_FASE, ROTULO_DEL_TIPO, disponibilidadDe, fechaCorta } from "./modeloRegistro";
import { eleccionDeFase, faseParaCrear } from "../territorial/fasesDelEnvio";
import { useEnviosTerritoriales } from "../territorial/useEnviosTerritoriales";
import { campanaHomonima } from "./nombreUnico";
import { ICONO_DEL_TIPO } from "./TarjetaDeCampana";
import type { FuenteDelRegistro } from "./useRegistroDeCampanas";
import "../correos/correosCampanas.css";
import "./campanas.css";

export type Resultado = { ok: true } | { ok: false; mensaje: string };

type Props = {
  panel: ControlPanel;
  registro: RegistroDeCampanas | null;
  fuente: FuenteDelRegistro | null;
  presets: readonly MailPreset[];
  miniaturas: Record<string, string | null>;
  ocupado: boolean;
  onCrearAulas: (name: string) => Promise<Resultado>;
  /** `fase` es `null` cuando el backend debe usar la activa (ninguna fase con envío conocida). */
  onCrearTerritorial: (name: string, fase: FaseTerritorial | null) => Promise<Resultado>;
  /** En acreditación, `ronda` es el público y la ronda del Modelo que abre (ADR 0125 §5). */
  onCrearTelefonica: (name: string, ronda?: { publico: string; ronda: number }) => Promise<Resultado>;
  /** ADR 0125 A4: el Planner fija `material.proposito`; en acreditación los nombres lo dicen. */
  proposito?: "acreditacion" | null;
  /** ADR 0125 A3: una supervisión por lote de Monitoreo. */
  onCrearSupervision: (name: string, lote: string) => Promise<Resultado>;
  onCrearCorreo: (input: { name: string; actor: string; origen: string; platform: MailPlatform }) => Promise<Resultado>;
  /** «Desde un correo existente…»: cambia este diálogo por el de importar. */
  onImportar: (platform: MailPlatform) => void;
};

const TIPOS: readonly TipoDeCampana[] = ["aulas", "territorial", "telefonica", "supervision", "correo"];

function Miniatura({ html, titulo }: { html: string | null | undefined; titulo: string }) {
  return (
    <span className="rec-nueva-mini" aria-hidden>
      {html ? <iframe title={`Miniatura de ${titulo}`} tabIndex={-1} sandbox="allow-same-origin" srcDoc={html} scrolling="no" /> : null}
    </span>
  );
}

/** Los tipos del estudio a la vista; el que no se puede crear dice por qué. */
export function TiposDeCampana({ registro, elegido, ocupado, onElegir }: {
  registro: RegistroDeCampanas | null;
  elegido: TipoDeCampana | null;
  ocupado: boolean;
  onElegir: (tipo: TipoDeCampana) => void;
}) {
  const ids = useId();
  return (
    <>
    <ul
      className="rec-nueva-tipos"
      data-qa-geometry-group="material-campo/campanas/nueva-tipos"
      data-qa-geometry-contract="equal"
      aria-label="Tipo de campaña"
    >
      {/* ADR 0122 P2: sólo los tipos que el estudio declara en el Planner. */}
      {TIPOS.filter((t) => !registro || disponibilidadDe(registro, t).del_estudio !== false).map((t) => {
        const disp = registro ? disponibilidadDe(registro, t) : { disponible: false, motivo: null };
        const Icono = ICONO_DEL_TIPO[t];
        return (
          <li key={t} data-qa-geometry-member>
            <button
              type="button"
              className="rec-nueva-tipo"
              aria-pressed={elegido === t}
              disabled={!disp.disponible || ocupado}
              aria-describedby={disp.motivo ? `${ids}-motivo-${t}` : undefined}
              onClick={() => onElegir(t)}
            >
              <Icono size={20} aria-hidden className="rec-nueva-tipo-icono" />
              <b>{ROTULO_DEL_TIPO[t]}</b>
              <small>{QUE_ES_EL_TIPO[t]}</small>
              {disp.motivo ? <span id={`${ids}-motivo-${t}`} className="rec-nueva-motivo">{disp.motivo}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
    {/* Checklist F18: el territorial sin envío dice por qué y lleva a donde se envía (no cabe dentro del botón deshabilitado). */}
    {/* Revisión con ojo de usuario (1 nov 2026): elegido otro tipo, el enlace a Hojas de ruta ya no viene al caso. */}
    {!elegido && registro && /env[ií]a la muestra/i.test(disponibilidadDe(registro, "territorial").motivo ?? "") ? (
      <p className="rec-nueva-ir-hojas">
        <Link to="/hojas-ruta?seccion=seleccion&panel=salidas">Enviar la muestra desde Hojas de ruta › Entrega</Link>
      </p>
    ) : null}
    </>
  );
}

export function DialogoNuevaCampana({ panel, registro, fuente, presets, miniaturas, ocupado, onCrearAulas, onCrearTerritorial, onCrearTelefonica, proposito = null, onCrearSupervision, onCrearCorreo, onImportar }: Props) {
  const ids = useId();
  const { abierto, cerrar } = panel;
  const [tipo, setTipo] = useState<TipoDeCampana | null>(null);
  const [nombre, setNombre] = useState("");
  const [actor, setActor] = useState("");
  const [origen, setOrigen] = useState<string>(ORIGEN_EN_BLANCO);
  const [plataforma, setPlataforma] = useState<MailPlatform>("mailchimp");
  const [error, setError] = useState("");
  const [fase, setFase] = useState<FaseTerritorial | null>(null);
  const [lote, setLote] = useState<string | null>(null);
  const [rondaElegida, setRondaElegida] = useState<string | null>(null);
  const rondasLibres = registro?.tipos.find((t) => t.tipo === "telefonica")?.rondas_libres ?? [];
  const ronda = rondasLibres.find((r) => r.id === rondaElegida) ?? null;
  const lotesLibres = registro?.tipos.find((t) => t.tipo === "supervision")?.lotes_libres ?? [];
  const territorialDisponible = registro ? disponibilidadDe(registro, "territorial").disponible : false;
  const envios = useEnviosTerritoriales(abierto && territorialDisponible);
  const eleccion = eleccionDeFase(envios.envios);

  useEffect(() => {
    if (abierto) return;
    setTipo(null);
    setFase(null);
    setLote(null);
    setRondaElegida(null);
    setNombre("");
    setActor("");
    setError("");
    // Al reabrir, la plataforma y el origen vuelven a su valor de partida: el diálogo no recuerda la campaña anterior.
    setPlataforma("mailchimp");
    setOrigen(presets.length ? presets[0].preset_id : ORIGEN_EN_BLANCO);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se reinicia solo al cerrar, no cuando llegan los presets
  }, [abierto]);

  // La primera plantilla real es el origen por defecto cuando llegan los presets.
  useEffect(() => {
    if (presets.length) setOrigen((o) => (o === ORIGEN_EN_BLANCO ? presets[0].preset_id : o));
  }, [presets]);

  const elegir = (t: TipoDeCampana) => {
    setTipo(t);
    setError("");
    const deAcreditacion = proposito === "acreditacion" ? NOMBRE_DE_ACREDITACION[t] : undefined;
    setNombre(deAcreditacion ?? (t === "aulas" ? NOMBRE_CAMPANA_AULAS : t === "territorial" ? NOMBRE_CAMPANA_TERRITORIAL : t === "telefonica" ? NOMBRE_CAMPANA_TELEFONICA : ""));
    if (t === "telefonica" && rondasLibres.length === 1) setRondaElegida(rondasLibres[0].id);
    // Con un solo lote libre, ya está elegido.
    if (t === "supervision" && lotesLibres.length === 1) elegirLote(lotesLibres[0].lote_id);
  };
  const elegirLote = (id: string) => {
    setLote(id);
    setNombre((n) => (n.trim() && !n.startsWith("Supervisión ") ? n : `Supervisión ${id.replace(/^ronda-/, "ronda ")}`));
  };

  const problema = nombre.trim() ? problemaDelNombre(nombre) ?? (tipo === "correo" ? problemaDelActor(actor) : null) : null;
  // F1: el nombre no se repite; la campaña que ya lo usa se ofrece para abrirla.
  const homonima = tipo && registro ? campanaHomonima(nombre, registro.campaigns) : null;
  // F12: por qué «Crear campaña» todavía no se puede pulsar, dicho junto al botón.
  const faltaFase = tipo === "territorial" && eleccion.tipo === "elegir" && !fase;
  const faltaLote = tipo === "supervision" && !lote;
  const faltaRonda = tipo === "telefonica" && rondasLibres.length > 0 && !ronda;
  const motivo = !tipo
    ? "Elige un tipo para seguir."
    : faltaFase
      ? "Elige de qué fase se lee la muestra."
      : faltaLote
      ? "Elige el lote de Monitoreo que se supervisa."
      : faltaRonda
      ? "Elige el público y la ronda del Modelo."
      : !nombre.trim()
      ? "Escribe el nombre de la campaña para crearla."
      : homonima
        ? "Cambia el nombre: ya lo usa otra campaña."
        : null;
  const alCerrar = useFocoDeRetorno(abierto, ['[data-retorno="nueva-campana"]']);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (!tipo || problema || homonima || !nombre.trim() || faltaFase || faltaLote || faltaRonda) return;
    setError("");
    const out = tipo === "aulas"
      ? await onCrearAulas(nombre)
      : tipo === "territorial"
        ? await onCrearTerritorial(nombre, faseParaCrear(eleccion, fase))
        : tipo === "telefonica"
        ? await onCrearTelefonica(nombre, ronda ? { publico: ronda.publico, ronda: ronda.ronda } : undefined)
        : tipo === "supervision" && lote
        ? await onCrearSupervision(nombre, lote)
        : await onCrearCorreo({ name: nombre, actor, origen, platform: plataforma });
    if (!out.ok) setError(out.mensaje);
  };

  return (
    <Dialog.Root open={abierto} onOpenChange={(siguiente) => { if (!siguiente && !ocupado) cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="rec-camp-velo" />
        <Dialog.Content
          className="rec-nueva"
          {...panel.props}
          // Se monta sólo con el registro leído: está listo.
          data-audit-ready="true"
          aria-busy={ocupado}
          aria-describedby={`${ids}-desc`}
          onCloseAutoFocus={alCerrar}
        >
          <header className="rec-nueva-cabeza">
            <span>
              <Dialog.Title className="rec-nueva-titulo">Nueva campaña</Dialog.Title>
              <Dialog.Description id={`${ids}-desc`} className="rec-nueva-desc">
                Cada campaña es un operativo con sus propios elementos. Elige de qué tipo es.
              </Dialog.Description>
            </span>
            <Dialog.Close asChild>
              <PulsoButton variant="icon" size="sm" aria-label="Cerrar" disabled={ocupado}>
                <X size={16} aria-hidden />
              </PulsoButton>
            </Dialog.Close>
          </header>

          <form id={`${ids}-form`} className="rec-nueva-cuerpo" onSubmit={(e) => { void crear(e); }} data-qa-geometry-capacity="owned">
            <TiposDeCampana registro={registro} elegido={tipo} ocupado={ocupado} onElegir={elegir} />

            {tipo === "aulas" ? (
              <div className="rec-nueva-paso">
                <label className="rec-camp-campo rec-nueva-campo">
                  <span>Nombre de la campaña</span>
                  <input
                    value={nombre}
                    maxLength={LARGO_NOMBRE}
                    autoFocus
                    aria-invalid={homonima ? true : undefined}
                    aria-describedby={homonima ? `${ids}-repetido` : undefined}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </label>
                {homonima ? <AvisoDeNombreRepetido id={`${ids}-repetido`} campana={homonima} href={homonima.archived ? null : hrefDeCampana(homonima)} /> : null}
                <p className="rec-nueva-pie-nota">
                  Las unidades salen de la muestra decidida en Cálculo de muestra: al abrir la campaña se siembran desde Unidades.
                  {fuente === "derivada" ? " Esta versión del backend no guarda el nombre: la campaña se llama «Campo en aulas»." : ""}
                </p>
              </div>
            ) : null}

            {/* Revisión con ojo de usuario (1 nov 2026): Telefónica no tenía paso; se creaba sin poder nombrarla
                ni saber qué seguía. */}
            {tipo === "telefonica" ? (
              <div className="rec-nueva-paso">
                {rondasLibres.length ? (
                  <fieldset className="rec-nueva-plataformas">
                    <legend>Ronda del Modelo</legend>
                    <span className="rec-nueva-plataformas-opciones">
                      {rondasLibres.map((r) => (
                        <label key={r.id} className={`rec-nueva-plataforma${rondaElegida === r.id ? " is-on" : ""}`}>
                          <input type="radio" name={`${ids}-ronda`} value={r.id} checked={rondaElegida === r.id} onChange={() => setRondaElegida(r.id)} />
                          <span>
                            <b>{r.etiqueta} · ronda {r.ronda}</b>
                            <small>{r.viene_de ? `Viene de «${registro?.campaigns.find((c) => c.id === r.viene_de)?.name ?? r.viene_de}»` : r.ronda > 1 ? "La ronda anterior no es telefónica" : "Primera ronda"}</small>
                          </span>
                        </label>
                      ))}
                    </span>
                  </fieldset>
                ) : null}
                <label className="rec-camp-campo rec-nueva-campo">
                  <span>Nombre de la campaña</span>
                  <input
                    value={nombre}
                    maxLength={LARGO_NOMBRE}
                    autoFocus
                    aria-invalid={problema || homonima ? true : undefined}
                    aria-describedby={homonima ? `${ids}-repetido` : undefined}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </label>
                {homonima ? <AvisoDeNombreRepetido id={`${ids}-repetido`} campana={homonima} href={homonima.archived ? null : hrefDeCampana(homonima)} /> : null}
                <p className="rec-nueva-pie-nota">
                  En la campaña declaras cuántos casos entrega el cliente y quién llama; de ahí sale la plantilla del barrido que llena el equipo y lee Monitoreo.
                </p>
              </div>
            ) : null}

            {tipo === "supervision" ? (
              <div className="rec-nueva-paso">
                <fieldset className="rec-nueva-plataformas">
                  <legend>Lote de Monitoreo</legend>
                  <span className="rec-nueva-plataformas-opciones">
                    {lotesLibres.map((l) => (
                      <label key={l.lote_id} className={`rec-nueva-plataforma${lote === l.lote_id ? " is-on" : ""}`}>
                        <input type="radio" name={`${ids}-lote`} value={l.lote_id} checked={lote === l.lote_id} onChange={() => elegirLote(l.lote_id)} />
                        <span>
                          <b>{l.lote_id.replace(/^ronda-/, "Ronda ")} · {l.casos.toLocaleString("es-PE")} {l.casos === 1 ? "caso" : "casos"}</b>
                          <small>{l.criterio}</small>
                        </span>
                      </label>
                    ))}
                  </span>
                </fieldset>
                <label className="rec-camp-campo rec-nueva-campo">
                  <span>Nombre de la campaña</span>
                  <input
                    value={nombre}
                    maxLength={LARGO_NOMBRE}
                    aria-invalid={problema || homonima ? true : undefined}
                    aria-describedby={homonima ? `${ids}-repetido` : undefined}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </label>
                {homonima ? <AvisoDeNombreRepetido id={`${ids}-repetido`} campana={homonima} href={homonima.archived ? null : hrefDeCampana(homonima)} /> : null}
                <p className="rec-nueva-pie-nota">
                  Monitoreo eligió a quién supervisar y cuándo. En la campaña eliges qué columnas del barrido y de los resultados lleva la base; las tres de la supervisión van siempre y las lee Monitoreo.
                </p>
              </div>
            ) : null}

            {tipo === "territorial" ? (
              <div className="rec-nueva-paso">
                <label className="rec-camp-campo rec-nueva-campo">
                  <span>Nombre de la campaña</span>
                  <input
                    value={nombre}
                    maxLength={LARGO_NOMBRE}
                    autoFocus
                    aria-invalid={problema || homonima ? true : undefined}
                    aria-describedby={homonima ? `${ids}-repetido` : undefined}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </label>
                {homonima ? <AvisoDeNombreRepetido id={`${ids}-repetido`} campana={homonima} href={homonima.archived ? null : hrefDeCampana(homonima)} /> : null}
                {envios.cargando ? <p className="rec-nueva-pie-nota">Leyendo qué muestra envió Hojas de ruta…</p> : null}
                {envios.error ? <p className="rec-nueva-pie-nota" role="alert">{envios.error}</p> : null}
                {eleccion.tipo === "elegir" && envios.envios ? (
                  <fieldset className="rec-nueva-plataformas">
                    <legend>Muestra de</legend>
                    <span className="rec-nueva-plataformas-opciones">
                      {(["field", "pilot"] as const).map((f) => {
                        const meta = envios.envios?.[f];
                        const cuando = meta?.enviado_at ? fechaCorta(meta.enviado_at) : null;
                        return (
                          <label key={f} className={`rec-nueva-plataforma${fase === f ? " is-on" : ""}`}>
                            <input type="radio" name={`${ids}-fase`} value={f} checked={fase === f} onChange={() => setFase(f)} />
                            <span>
                              <b>{ROTULO_DE_FASE[f]}</b>
                              <small>
                                {meta ? `${meta.n_titulares.toLocaleString("es-PE")} titulares · ${meta.n_reemplazos.toLocaleString("es-PE")} reemplazos` : ""}
                                {cuando ? ` · enviada el ${cuando}` : ""}
                              </small>
                            </span>
                          </label>
                        );
                      })}
                    </span>
                  </fieldset>
                ) : null}
                <p className="rec-nueva-pie-nota">
                  {eleccion.tipo === "unica"
                    ? `Las UMP salen de la muestra de ${ROTULO_DE_FASE[eleccion.fase].toLowerCase()} que envió Hojas de ruta. `
                    : "Las UMP salen de la muestra que envió Hojas de ruta. "}
                  Si allá cambia, la campaña lo avisa hasta que se reenvíe.
                </p>
              </div>
            ) : null}

            {tipo === "correo" ? (
              <div className="rec-nueva-paso">
                <span className="rec-nueva-campos">
                  <label className="rec-camp-campo rec-nueva-campo">
                    <span>Nombre de la campaña</span>
                    <input
                      value={nombre}
                      maxLength={LARGO_NOMBRE}
                      placeholder="Invitación egresados"
                      autoFocus
                      aria-invalid={problema || homonima ? true : undefined}
                      aria-describedby={[`${ids}-contador`, homonima ? `${ids}-repetido` : ""].filter(Boolean).join(" ")}
                      onChange={(e) => setNombre(e.target.value)}
                    />
                    <ContadorDeNombre id={`${ids}-contador`} nombre={nombre} />
                  </label>
                  <label className="rec-camp-campo rec-nueva-campo">
                    <span>Actor</span>
                    <input value={actor} maxLength={LARGO_ACTOR} placeholder="Egresados" onChange={(e) => setActor(e.target.value)} />
                  </label>
                </span>
                {homonima ? <AvisoDeNombreRepetido id={`${ids}-repetido`} campana={homonima} href={homonima.archived ? null : hrefDeCampana(homonima)} /> : null}
                <fieldset className="rec-nueva-plataformas">
                  <legend>Sale por</legend>
                  <span className="rec-nueva-plataformas-opciones">
                    {MAIL_PLATFORMS.map((p) => (
                      <label key={p} className={`rec-nueva-plataforma${plataforma === p ? " is-on" : ""}`}>
                        <input type="radio" name={`${ids}-plataforma`} value={p} checked={plataforma === p} onChange={() => setPlataforma(p)} />
                        <span>
                          <b>{NOMBRE_DE_PLATAFORMA[p]}</b>
                          <small>{RESUMEN_DE_PLATAFORMA[p]}</small>
                        </span>
                      </label>
                    ))}
                  </span>
                </fieldset>
                <fieldset className="rec-nueva-origenes-marco">
                  <legend>Empieza desde</legend>
                  <ul
                    className="rec-nueva-origenes"
                    data-qa-geometry-group="material-campo/campanas/nueva-origenes"
                    data-qa-geometry-contract="equal"
                  >
                    {presets.map((p) => (
                      <li key={p.preset_id} data-qa-geometry-member>
                        <button type="button" className="rec-nueva-origen" aria-pressed={origen === p.preset_id} onClick={() => setOrigen(p.preset_id)}>
                          <Miniatura html={miniaturas[p.preset_id]} titulo={p.title} />
                          <b>{p.title}</b>
                          {origenDePreset(p.preset_id) ? <small>Plantilla real · {origenDePreset(p.preset_id)}</small> : null}
                        </button>
                      </li>
                    ))}
                    <li data-qa-geometry-member>
                      <button type="button" className="rec-nueva-origen" aria-pressed={origen === ORIGEN_EN_BLANCO} onClick={() => setOrigen(ORIGEN_EN_BLANCO)}>
                        <span className="rec-nueva-mini" aria-hidden><FilePlus2 size={24} /></span>
                        <b>En blanco</b>
                        <small>Saludo, un párrafo, firma y pie</small>
                      </button>
                    </li>
                    <li data-qa-geometry-member>
                      <button type="button" className="rec-nueva-origen" disabled={ocupado} onClick={() => onImportar(plataforma)}>
                        <span className="rec-nueva-mini" aria-hidden><FileCode2 size={24} /></span>
                        <b>Desde un correo existente…</b>
                        <small>Un HTML de Mailchimp o SurveyMonkey, con su asunto</small>
                      </button>
                    </li>
                  </ul>
                </fieldset>
              </div>
            ) : null}
          </form>

          <footer className="rec-nueva-pie">
            {problema ? <span className="rec-nueva-problema" role="alert">{problema}</span> : null}
            {error ? <span className="rec-nueva-problema" role="alert">{error}</span> : null}
            {motivo && !problema && !error ? <span className="rec-nueva-pie-motivo" id={`${ids}-motivo`}>{motivo}</span> : null}
            {tipo ? (
              <PulsoButton variant="ghost" size="sm" type="button" disabled={ocupado} onClick={() => setTipo(null)}>
                <ArrowLeft size={14} aria-hidden /> Otro tipo
              </PulsoButton>
            ) : null}
            <PulsoButton
              variant="primary"
              size="sm"
              type="submit"
              form={`${ids}-form`}
              disabled={!tipo || ocupado || !nombre.trim() || Boolean(problema) || Boolean(homonima) || faltaFase}
              aria-describedby={motivo ? `${ids}-motivo` : undefined}
            >
              {ocupado ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
              Crear campaña
            </PulsoButton>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
