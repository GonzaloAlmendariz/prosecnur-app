import { useCallback, useEffect, useMemo, useState } from "react";

import type { MailBlock, MailBlockType, MailPreset, MailTemplate } from "../../../api/materialMail";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { GlidingTabList } from "../../../components/GlidingTabList";
import { PulsoButton } from "../../../components/PulsoButton";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { AlertTriangle, Check, Loader2, Mail, RefreshCw, Save } from "../../../vendor/lucide-react";
import { Segmented } from "../../xlsformEditor/kit";
import { ColumnaDeBloques } from "./ColumnaDeBloques";
import {
  SOBRE,
  agregarBloque,
  conTexto,
  editarBloque,
  insertarToken,
  moverBloque,
  quitarBloque,
  repartirProblemas,
  textoDe,
  type VistaDelCorreo,
} from "./modeloCorreo";
import { PanelDeBloque } from "./PanelDeBloque";
import { PanelDestinatarios } from "./PanelDestinatarios";
import { PanelIdentidad } from "./PanelIdentidad";
import { PanelMailchimp } from "./PanelMailchimp";
import { PanelRevision } from "./PanelRevision";
import { VistaPreviaDelCorreoConectada } from "./VistaPreviaDelCorreo";
import { ConfirmarBorrarCampana } from "./ConfirmarBorrarCampana";
import { DialogoCampanas } from "./DialogoCampanas";
import { campanaTrasBorrar } from "./modeloCampanas";
import {
  PANEL_CORREO_CAMPANAS,
  PANEL_CORREO_CAMPANA_BORRAR,
  PANEL_CORREO_DESTINATARIOS,
  PANEL_CORREO_IDENTIDAD,
  PANEL_CORREO_REVISION,
} from "./panelesCorreos";
import { SelectorDeCampana } from "./SelectorDeCampana";
import { SinCampanas } from "./SinCampanas";
import { hayCambios, hayQueGuardar, useCorreosStore } from "./store";
import { useCampanaDelFoco } from "./useCampanaDelFoco";
import { useCampanas } from "./useCampanas";
import { useCorreos } from "./useCorreos";
import "./correos.css";
import "./correosCampanas.css";

type Props = {
  /** Avisa al shell mientras el correo o su vista previa no han llegado. */
  onCargando?: (cargando: boolean) => void;
  /**
   * Cada escritura (guardar, crear, duplicar, renombrar, borrar) sube la
   * revisión global del estado: el shell la relee para que las otras secciones
   * no escriban con una vieja (H-f).
   */
  onStateRefresh?: () => void | Promise<void>;
};

type Pestana = "bloque" | "identidad" | "destinatarios" | "revision";

const VISTAS: { value: VistaDelCorreo; label: string }[] = [
  { value: "escritorio", label: "Escritorio" },
  { value: "telefono", label: "Teléfono" },
  { value: "oscuro", label: "Modo oscuro" },
];

/**
 * Catálogo › Correos (ADR 0110 §2): el correo se compone aquí con bloques del
 * registro cerrado y sale como insumo para Mailchimp. El envío masivo se hace
 * en Mailchimp; esta vista no envía nada.
 */
export function CorreosEditor({ onCargando, onStateRefresh }: Props) {
  const onEscrito = useCallback(() => { void onStateRefresh?.(); }, [onStateRefresh]);
  const campanasAcc = useCampanas({ onEscrito });
  const acciones = useCorreos({ onEscrito });
  const st = useCorreosStore();
  const { ir } = useCampanaDelFoco();
  const campanasPanel = usePanelDireccionable(PANEL_CORREO_CAMPANAS);
  const borrarPanel = usePanelDireccionable(PANEL_CORREO_CAMPANA_BORRAR);
  const [creandoPrimera, setCreandoPrimera] = useState<string | null>(null);
  const identidad = usePanelDireccionable(PANEL_CORREO_IDENTIDAD);
  const destinatariosPanel = usePanelDireccionable(PANEL_CORREO_DESTINATARIOS);
  const revisionPanel = usePanelDireccionable(PANEL_CORREO_REVISION);
  const [presetPendiente, setPresetPendiente] = useState<MailPreset | null>(null);

  const pestana: Pestana = identidad.abierto
    ? "identidad"
    : destinatariosPanel.abierto
      ? "destinatarios"
      : revisionPanel.abierto
        ? "revision"
        : "bloque";
  const panelAbierto = identidad.abierto ? identidad : destinatariosPanel.abierto ? destinatariosPanel : revisionPanel.abierto ? revisionPanel : null;

  const irAPestana = useCallback((p: Pestana) => {
    if (p === "bloque") panelAbierto?.cerrar();
    else if (p === "identidad") identidad.abrir();
    else if (p === "destinatarios") destinatariosPanel.abrir();
    else revisionPanel.abrir();
  }, [destinatariosPanel, identidad, panelAbierto, revisionPanel]);

  const seleccionar = useCallback((id: string) => {
    // Un campo se inserta en el texto del bloque que se está mirando, no en el
    // último que tuvo el cursor.
    if (id !== st.seleccion) st.setDestino(null);
    st.seleccionar(id);
    if (pestana !== "bloque") panelAbierto?.cerrar();
  }, [panelAbierto, pestana, st]);

  const template = st.borrador;
  const problemas = useMemo(() => repartirProblemas(st.problemas, template), [st.problemas, template]);
  const cambios = hayCambios(st);
  const porGuardar = hayQueGuardar(st);
  const miniaturasPendientes = st.presets.some((p) => !(p.preset_id in st.miniaturas));
  const sinCampanas = st.campanasCarga === "lista" && st.campanas.length === 0;
  const cargando = st.campanasCarga === "inicial" || st.campanasCarga === "cargando"
    || (st.campanasCarga === "lista" && !sinCampanas && (
      st.carga === "inicial" || st.carga === "cargando"
      || (st.carga === "lista" && ((!st.vistaPrevia && !st.vistaPreviaError) || miniaturasPendientes))));
  const campanaActiva = st.campanas.find((c) => c.campaign_id === st.campana) ?? null;
  const borrarId = st.borrarPedido?.campaignId ?? st.campana;
  const campanaABorrar = st.campanas.find((c) => c.campaign_id === borrarId) ?? null;
  const listaLista = st.campanasCarga === "lista" || st.campanasCarga === "error";

  useEffect(() => { onCargando?.(cargando); }, [cargando, onCargando]);
  useEffect(() => () => onCargando?.(false), [onCargando]);

  const editar = useCallback((update: (t: MailTemplate) => MailTemplate) => st.editar(update), [st]);
  const editarUnBloque = useCallback((id: string, update: (b: MailBlock) => MailBlock) => {
    st.editar((t) => editarBloque(t, id, update));
  }, [st]);

  const insertarCampo = (key: string) => {
    const destino = st.destino;
    if (!destino || !template) return;
    if (destino.objetivo === SOBRE && (destino.prop === "subject" || destino.prop === "preheader")) {
      const prop = destino.prop;
      const { valor, cursor } = insertarToken(template[prop], destino.cursor, key);
      st.editar((t) => ({ ...t, [prop]: valor }));
      st.setDestino({ ...destino, cursor });
      return;
    }
    const block = template.blocks.find((b) => b.block_id === destino.objetivo);
    if (!block || destino.prop === "subject" || destino.prop === "preheader") return;
    const prop = destino.prop;
    const { valor, cursor } = insertarToken(textoDe(block, prop), destino.cursor, key);
    editarUnBloque(block.block_id, (b) => conTexto(b, prop, valor));
    st.setDestino({ ...destino, cursor });
  };

  const elegirPreset = (preset: MailPreset) => {
    if (template?.preset_id === preset.preset_id && !cambios) return;
    if (cambios) {
      setPresetPendiente(preset);
      return;
    }
    aplicarPreset(preset);
  };
  const aplicarPreset = (preset: MailPreset) => {
    st.reemplazarBorrador({ ...preset.template, revision: template?.revision ?? preset.template.revision });
    st.seleccionar(SOBRE);
    setPresetPendiente(null);
  };

  const agregar = (type: MailBlockType) => {
    if (!template) return;
    const seleccionActual = template.blocks.some((b) => b.block_id === st.seleccion) ? st.seleccion : null;
    const out = agregarBloque(template, type, seleccionActual);
    st.reemplazarBorrador(out.template);
    seleccionar(out.block_id);
  };

  const abrirCampana = (campaignId: string) => {
    ir({ foco: campaignId, panel: null });
  };

  const pedirBorrar = (campaignId: string) => {
    st.setBorrarPedido({ campaignId, desdeDialogo: true });
    ir({ panel: PANEL_CORREO_CAMPANA_BORRAR.id });
  };

  const borrar = async (campaignId: string, confirmName: string) => {
    const antes = useCorreosStore.getState().campanas;
    const abierta = useCorreosStore.getState().campana;
    const out = await campanasAcc.borrar(campaignId, confirmName);
    if (!out.ok) return out;
    const desdeDialogo = useCorreosStore.getState().borrarPedido?.desdeDialogo ?? false;
    const siguiente = campanaTrasBorrar(antes, campaignId, abierta);
    st.setBorrarPedido(null);
    st.setAvisoCampanas({ tono: "ok", texto: "Campaña borrada con su plantilla y sus destinatarios." });
    ir({ foco: siguiente, panel: desdeDialogo && siguiente ? PANEL_CORREO_CAMPANAS.id : null });
    return out;
  };

  const cancelarBorrado = () => {
    const desdeDialogo = st.borrarPedido?.desdeDialogo ?? false;
    st.setBorrarPedido(null);
    ir({ panel: desdeDialogo ? PANEL_CORREO_CAMPANAS.id : null });
  };

  const crearPrimera = async (origen: string, nombre: string) => {
    setCreandoPrimera(origen);
    st.setAvisoCampanas(null);
    const out = await campanasAcc.crear({ name: nombre, actor: "", origen });
    setCreandoPrimera(null);
    if (!out.ok) {
      st.setAvisoCampanas({ tono: "error", texto: out.mensaje });
      return;
    }
    if (out.aviso) st.setAvisoCampanas({ tono: "info", texto: out.aviso });
    abrirCampana(out.campaignId);
  };

  // Los diálogos esperan la lista: sin ella no saben qué campaña nombrar.
  const dialogos = !listaLista ? null : (
    <>
      <DialogoCampanas
        panel={campanasPanel}
        campanas={st.campanas}
        activa={st.campana}
        presets={st.presets}
        ocupado={st.ocupado === "campanas"}
        conCambios={porGuardar}
        acciones={campanasAcc}
        onAbrir={abrirCampana}
        onBorrar={pedirBorrar}
      />
      <ConfirmarBorrarCampana
        panel={borrarPanel}
        campana={campanaABorrar}
        onBorrar={borrar}
        onCancelar={cancelarBorrado}
      />
    </>
  );

  const avisoCampanas = st.avisoCampanas ? (
    <p className={`rec-mail-aviso is-${st.avisoCampanas.tono}`} role={st.avisoCampanas.tono === "error" ? "alert" : "status"}>
      {st.avisoCampanas.texto}
      <button type="button" className="rec-mail-link" onClick={() => st.setAvisoCampanas(null)}>Entendido</button>
    </p>
  ) : null;

  if (st.campanasCarga === "error") {
    return (
      <div className="rec-vacio-sin-plan" data-qa-geometry-capacity="owned">
        <EstadoVacio
          tamano="normal"
          icono={<AlertTriangle size={18} />}
          titulo="No se pudieron leer las campañas de correo"
          descripcion={st.campanasError}
          accion={(
            <PulsoButton variant="secondary" size="sm" onClick={() => { void campanasAcc.cargarCampanas(); }}>
              <RefreshCw size={14} aria-hidden /> Reintentar
            </PulsoButton>
          )}
        />
      </div>
    );
  }

  if (sinCampanas) {
    return (
      <>
        <SinCampanas
          presets={st.presets}
          miniaturas={st.miniaturas}
          creando={creandoPrimera}
          aviso={st.avisoCampanas?.tono === "error" ? st.avisoCampanas.texto : null}
          onCrear={(origen, nombre) => { void crearPrimera(origen, nombre); }}
        />
        {dialogos}
      </>
    );
  }

  if (st.carga === "error") {
    return (
      <div className="rec-vacio-sin-plan" data-qa-geometry-capacity="owned">
        <EstadoVacio
          tamano="normal"
          icono={<AlertTriangle size={18} />}
          titulo="No se pudo leer el correo"
          descripcion={st.errorCarga}
          accion={(
            <PulsoButton variant="secondary" size="sm" onClick={() => { void acciones.cargar(); }}>
              <RefreshCw size={14} aria-hidden /> Reintentar
            </PulsoButton>
          )}
        />
      </div>
    );
  }

  if (!template) {
    return (
      <>
        <div className="rec-loading" data-qa-geometry-capacity="owned">
          {st.campanasCarga === "lista" ? "Leyendo el correo…" : "Leyendo las campañas de correo…"}
        </div>
        {dialogos}
      </>
    );
  }

  const persona = st.vistaPrevia?.recipient;
  const totalPersonas = st.destinatarios?.loaded ? st.destinatarios.counts?.valid ?? 0 : 0;
  const imagenesSinArchivo = st.revision?.checks.find((c) => c.code === "images_available")?.items
    .filter((i): i is string => typeof i === "string") ?? [];
  const bannerCheck = st.revision?.checks.find((c) => c.code === "banner_size") ?? null;
  const ocupado = st.ocupado !== null;
  const tabs: { id: Pestana; label: string; cuenta?: number }[] = [
    { id: "bloque", label: "Bloque" },
    { id: "identidad", label: "Identidad" },
    { id: "destinatarios", label: "Destinatarios" },
    { id: "revision", label: "Revisión", cuenta: st.revision ? st.revision.errors : undefined },
  ];

  return (
    <>
    {dialogos}
    <div className="rec-mail-contenedor">
      <div
        className="rec-mail"
        data-qa-geometry-group="material-campo/catalogo/correos"
        data-qa-geometry-contract="intrinsic"
      >
        <header className="rec-mail-barra">
          <span className="rec-mail-barra-id">
            <span className="rec-mail-barra-icono" aria-hidden><Mail size={15} /></span>
            <span className="rec-mail-barra-textos">
              <SelectorDeCampana
                campanas={st.campanas}
                activa={campanaActiva}
                conCambios={porGuardar}
                onElegir={abrirCampana}
                onGestionar={campanasPanel.abrir}
              />
              <button
                type="button"
                className="rec-mail-asunto"
                title={`Asunto: ${template.subject || "sin asunto"}`}
                onClick={() => seleccionar(SOBRE)}
              >
                Asunto: {template.subject || "sin asunto"}
              </button>
            </span>
          </span>
          <span className="rec-mail-barra-acciones">
            <Segmented aria-label="Cómo se mira el correo" value={st.vista} options={VISTAS} onChange={st.setVista} />
            <span className="rec-mail-ver-como" aria-live="polite">
              Ver como <b>{persona?.nombre || "—"}</b>
              {persona?.source === "synthetic" ? <span className="rec-mail-chip">ejemplo</span> : null}
            </span>
            <PulsoButton
              variant="secondary"
              size="sm"
              disabled={!totalPersonas}
              title={totalPersonas ? undefined : "Importa destinatarios para ver el correo de cada persona"}
              onClick={st.siguientePersona}
            >
              Siguiente persona
            </PulsoButton>
            <span className={`rec-mail-guardado${porGuardar ? " is-pendiente" : ""}`} role="status">
              {st.ocupado === "guardando" ? <Loader2 size={13} className="pulso-spin" aria-hidden /> : porGuardar ? null : <Check size={13} aria-hidden />}
              {cambios ? "Sin guardar" : st.problemasGuardados.length ? "Guardada inválida" : st.builtin ? "Plantilla de fábrica" : "Guardado"}
            </span>
            <PulsoButton variant="primary" size="sm" disabled={!porGuardar || ocupado} onClick={() => { void acciones.guardar(); }}>
              <Save size={14} aria-hidden /> Guardar
            </PulsoButton>
          </span>
        </header>

        {st.aviso ? (
          <p className={`rec-mail-aviso is-${st.aviso.tono}`} role={st.aviso.tono === "error" ? "alert" : "status"}>
            {st.aviso.texto}
            {st.aviso.texto.includes("Vuelve a cargar") ? (
              <button type="button" className="rec-mail-link" onClick={() => { void acciones.cargar(); }}>Volver a cargar</button>
            ) : avisoCampanas}
          </p>
        ) : null}

        <ColumnaDeBloques
          presets={st.presets}
          miniaturas={st.miniaturas}
          template={template}
          seleccion={pestana === "bloque" ? st.seleccion : ""}
          problemas={problemas}
          presetPendiente={presetPendiente?.preset_id ?? null}
          onElegirPreset={elegirPreset}
          onConfirmarPreset={() => { if (presetPendiente) aplicarPreset(presetPendiente); }}
          onCancelarPreset={() => setPresetPendiente(null)}
          onSeleccionar={seleccionar}
          onAgregar={agregar}
          onInsertarCampo={insertarCampo}
          hayDestino={Boolean(st.destino) && pestana === "bloque"}
        />

        <VistaPreviaDelCorreoConectada onSeleccionar={seleccionar} conSeleccion={pestana === "bloque"} />

        <aside className="rec-mail-col rec-mail-col--inspector" aria-label="Inspector del correo">
          <GlidingTabList
            className="rec-mail-tabs"
            role="tablist"
            aria-label="Inspector del correo"
            activeKey={pestana}
            onRovingKeyChange={(key) => irAPestana(key as Pestana)}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-gliding-key={tab.id}
                id={`rec-mail-tab-${tab.id}`}
                aria-selected={pestana === tab.id}
                aria-controls="rec-mail-inspector"
                className={`rec-mail-tab${pestana === tab.id ? " is-on" : ""}`}
                onClick={() => irAPestana(tab.id)}
              >
                {tab.label}
                {tab.cuenta ? <span className="rec-mail-tab-cuenta">{tab.cuenta}</span> : null}
              </button>
            ))}
          </GlidingTabList>
          <div
            id="rec-mail-inspector"
            role="tabpanel"
            aria-labelledby={`rec-mail-tab-${pestana}`}
            className="rec-mail-insp"
            data-qa-geometry-capacity="owned"
            {...(panelAbierto ? panelAbierto.props : {})}
          >
            {pestana === "bloque" ? (
              <PanelDeBloque
                template={template}
                seleccion={st.seleccion}
                problemas={problemas}
                persona={persona ?? null}
                onEditar={editar}
                onEditarBloque={editarUnBloque}
                onDestino={st.setDestino}
                onMover={(id, delta) => st.editar((t) => moverBloque(t, id, delta))}
                onQuitar={(id) => { st.editar((t) => quitarBloque(t, id)); st.seleccionar(SOBRE); }}
                onAbrirIdentidad={() => irAPestana("identidad")}
              />
            ) : null}
            {pestana === "identidad" ? (
              <PanelIdentidad
                template={template}
                imagenesLocales={st.imagenesLocales}
                htmlDeLaVista={st.vistaPrevia?.html ?? null}
                sinArchivo={imagenesSinArchivo}
                bannerCheck={bannerCheck}
                ocupado={ocupado}
                onEditar={editar}
                onSubir={(id, file) => { void acciones.subirImagen(id, file); }}
              />
            ) : null}
            {pestana === "destinatarios" ? (
              <PanelDestinatarios
                template={template}
                destinatarios={st.destinatarios}
                persona={st.persona}
                ocupado={ocupado}
                onEditar={editar}
                onImportar={(file) => { void acciones.importar(file); }}
                onMapear={(mapping) => { void acciones.mapear(mapping); }}
                onOlvidar={() => { void acciones.olvidar(); }}
                onVerComo={st.setPersona}
              />
            ) : null}
            {pestana === "revision" ? <PanelRevision revision={st.revision} cargando={st.revisionCargando} /> : null}
          </div>
          <PanelMailchimp
            template={template}
            revision={st.revision}
            exportacion={st.exportacion}
            exportando={st.ocupado === "exportando" ? "completo" : st.ocupado === "exportando-plantilla" ? "plantilla" : null}
            ocupado={ocupado}
            htmlActual={st.vistaPrevia?.html ?? null}
            onExportar={(scope) => {
              void acciones.exportar(scope).then((resultado) => { if (resultado === "revision") irAPestana("revision"); });
            }}
            onGuardarJunto={() => { void acciones.guardarJuntoAlProyecto(); }}
            onVerRevision={() => irAPestana("revision")}
          />
        </aside>
      </div>
    </div>
    </>
  );
}
