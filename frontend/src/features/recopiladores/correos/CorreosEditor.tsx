import { useCallback, useEffect, useMemo, useState } from "react";

import type { MailBlock, MailBlockType, MailPlatform, MailPreset, MailTemplate } from "../../../api/materialMail";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { GlidingTabList } from "../../../components/GlidingTabList";
import { PulsoButton } from "../../../components/PulsoButton";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { Switch } from "../../../components/Switch";
import { AlertTriangle, Check, Loader2, Mail, Redo2, RefreshCw, Save, Undo2 } from "../../../vendor/lucide-react";
import { Segmented } from "../../xlsformEditor/kit";
import { ColumnaDeBloques } from "./ColumnaDeBloques";
import {
  CABECERA,
  CAMPO_NOMBRE,
  SOBRE,
  agregarBloque,
  cabeceraSinAlt,
  conTexto,
  editarBloque,
  idLibre,
  insertarToken,
  moverBloque,
  quitarBloque,
  repartirProblemas,
  rotuloDeBloque,
  slugDeImagen,
  textoDe,
  type VistaDelCorreo,
} from "./modeloCorreo";
import { AvisoDeshacer, type Deshacible } from "./AvisoDeshacer";
import { destinoDelChequeo } from "./comoArreglar";
import { CapaDeEdicion } from "./CapaDeEdicion";
import { GuiaDelEditor } from "./GuiaDelEditor";
import { NOMBRE_DE_PLATAFORMA, etiquetaDeCampo } from "./dialectos";
import { DialogoImportarHtml } from "./DialogoImportarHtml";
import { agregarRecordatorio, asuntoDelEnvio, cerrarApertura, conApertura, editarEnvio, quitarEnvio } from "./modeloEnvios";
import { PanelEnvios } from "./PanelEnvios";
import { DestinatariosEnSurveyMonkey, PanelSurveyMonkey } from "./PanelSurveyMonkey";
import { SelectorDeEnvio } from "./SelectorDeEnvio";
import {
  APERTURA,
  bloqueParaInsertar,
  chequeosPorBloque,
  conPuntoNuevo,
  conTextoDeZona,
  insertarBloqueEn,
  moverBloqueA,
  sinPunto,
  sinPuntosVacios,
  srcDeImagenDelBloque,
} from "./estructuraCorreo";
import { atajoDeHistorial, esCampoNativo } from "./historialCorreo";
import type { CampoDelMenu } from "./MenuDeCampos";
import type { MedidasDeLaHoja } from "./VistaPreviaDelCorreo";
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
  PANEL_CORREO_ENVIOS,
  PANEL_CORREO_IDENTIDAD,
  PANEL_CORREO_IMPORTAR,
  PANEL_CORREO_REVISION,
} from "./panelesCorreos";
import { SelectorDeCampana } from "./SelectorDeCampana";
import { SinCampanas } from "./SinCampanas";
import { envioElegido, hayCambios, hayQueGuardar, useCorreosStore } from "./store";
import { useCampanaDelFoco } from "./useCampanaDelFoco";
import { useCampanas } from "./useCampanas";
import { useCorreos } from "./useCorreos";
import "./correos.css";
import "./correosCampanas.css";
import "./correosCapa.css";
import "./correosEnvios.css";
import "./correosGuia.css";

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

type Pestana = "bloque" | "envios" | "identidad" | "destinatarios" | "revision";

const PARECE_CORREO = /[^\s@]+@[^\s@]+/;

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
  const cerrarDeshacible = useCallback(() => setDeshacible(null), []);
  const campanasAcc = useCampanas({ onEscrito });
  const acciones = useCorreos({ onEscrito });
  const st = useCorreosStore();
  const { ir } = useCampanaDelFoco();
  const campanasPanel = usePanelDireccionable(PANEL_CORREO_CAMPANAS);
  const borrarPanel = usePanelDireccionable(PANEL_CORREO_CAMPANA_BORRAR);
  const [creandoPrimera, setCreandoPrimera] = useState<string | null>(null);
  const [deshacible, setDeshacible] = useState<Deshacible | null>(null);
  const identidad = usePanelDireccionable(PANEL_CORREO_IDENTIDAD);
  const destinatariosPanel = usePanelDireccionable(PANEL_CORREO_DESTINATARIOS);
  const revisionPanel = usePanelDireccionable(PANEL_CORREO_REVISION);
  const enviosPanel = usePanelDireccionable(PANEL_CORREO_ENVIOS);
  const importarPanel = usePanelDireccionable(PANEL_CORREO_IMPORTAR);
  const [presetPendiente, setPresetPendiente] = useState<MailPreset | null>(null);

  const pestana: Pestana = enviosPanel.abierto
    ? "envios"
    : identidad.abierto
      ? "identidad"
      : destinatariosPanel.abierto
        ? "destinatarios"
        : revisionPanel.abierto
          ? "revision"
          : "bloque";
  const panelAbierto = enviosPanel.abierto
    ? enviosPanel
    : identidad.abierto ? identidad : destinatariosPanel.abierto ? destinatariosPanel : revisionPanel.abierto ? revisionPanel : null;

  const irAPestana = useCallback((p: Pestana) => {
    if (p === "bloque") panelAbierto?.cerrar();
    else if (p === "envios") enviosPanel.abrir();
    else if (p === "identidad") identidad.abrir();
    else if (p === "destinatarios") destinatariosPanel.abrir();
    else revisionPanel.abrir();
  }, [destinatariosPanel, enviosPanel, identidad, panelAbierto, revisionPanel]);

  const seleccionar = useCallback((id: string) => {
    // Un campo se inserta en el texto del bloque que se está mirando, no en el
    // último que tuvo el cursor.
    if (id !== st.seleccion) st.setDestino(null);
    if (st.edicion && st.edicion.zona !== id) st.setEdicion(null);
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
  // La plataforma de la campaña decide el dialecto de todo lo que se muestra (E1j).
  const dialecto: MailPlatform = st.plataforma;
  const envio = envioElegido(st);
  const borrarId = st.borrarPedido?.campaignId ?? st.campana;
  const campanaABorrar = st.campanas.find((c) => c.campaign_id === borrarId) ?? null;
  const listaLista = st.campanasCarga === "lista" || st.campanasCarga === "error";

  useEffect(() => { onCargando?.(cargando); }, [cargando, onCargando]);

  // Cmd+Z / Cmd+Shift+Z fuera de un campo: deshace en el correo. Dentro de un
  // input manda su propio deshacer; el editor en línea captura el suyo.
  useEffect(() => {
    const alTeclear = (event: KeyboardEvent) => {
      const atajo = atajoDeHistorial(event);
      if (!atajo || esCampoNativo(event.target)) return;
      const estado = useCorreosStore.getState();
      if (!estado.borrador) return;
      event.preventDefault();
      if (atajo === "deshacer") estado.deshacer();
      else estado.rehacer();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  const chequeos = useMemo(() => chequeosPorBloque(st.revision?.checks), [st.revision]);
  const persona = st.vistaPrevia?.recipient;
  const camposDelMenu = useMemo((): CampoDelMenu[] => {
    if (!template) return [];
    const ejemplo = (v: string | undefined) => (v && !PARECE_CORREO.test(v) ? v : undefined);
    return [
      { key: CAMPO_NOMBRE, label: "Nombre", etiqueta: etiquetaDeCampo({ key: CAMPO_NOMBRE, tag: "FNAME" }, dialecto) ?? "", ejemplo: ejemplo(persona?.nombre) },
      ...template.fields.map((f) => ({ key: f.key, label: f.label, etiqueta: etiquetaDeCampo(f, dialecto) ?? "sin etiqueta", ejemplo: ejemplo(persona?.fields[f.key]) })),
    ];
  }, [dialecto, persona, template]);
  const textoDeCampo = useMemo(() => {
    const porClave = new Map(camposDelMenu.map((c) => [c.key, c]));
    return {
      rotuloDeCampo: (k: string) => porClave.get(k)?.label ?? k,
      ayudaDeCampo: (k: string) => `{{${k}}} → ${porClave.get(k)?.etiqueta ?? "sin equivalente"}`,
    };
  }, [camposDelMenu]);
  useEffect(() => () => onCargando?.(false), [onCargando]);

  const editar = useCallback((update: (t: MailTemplate) => MailTemplate, grupo?: string) => st.editar(update, grupo), [st]);
  const editarUnBloque = useCallback((id: string, update: (b: MailBlock) => MailBlock, grupo?: string) => {
    st.editar((t) => editarBloque(t, id, update), grupo);
  }, [st]);

  /**
   * Sube el archivo de un bloque imagen. El id sale del nombre del archivo
   * (a-z, 0-9 y guiones: Mailchimp lo usa como nombre en el ZIP) y no choca
   * con otra imagen del correo; el bloque pasa a nombrarlo.
   */
  const subirImagenDeBloque = (blockId: string, file: File) => {
    const actual = useCorreosStore.getState().borrador;
    const block = actual?.blocks.find((b) => b.block_id === blockId);
    if (!actual || !block || block.type !== "image") return;
    const usados = [
      ...Object.keys(actual.images),
      ...actual.blocks.flatMap((b) => (b.type === "image" && b.block_id !== blockId ? [b.image_ref] : [])),
    ].filter((id) => id !== block.image_ref);
    const id = idLibre(slugDeImagen(file.name), usados);
    if (id !== block.image_ref) {
      st.editar((t) => {
        const images = { ...t.images };
        if (images[block.image_ref]) {
          images[id] = images[block.image_ref];
          delete images[block.image_ref];
        }
        return { ...editarBloque(t, blockId, (b) => ({ ...b, image_ref: id }) as MailBlock), images };
      });
    }
    void acciones.subirImagen(id, file);
  };

  const capa = (m: MedidasDeLaHoja) => {
    if (!template) return null;
    return (
      <CapaDeEdicion
        {...m}
        template={template}
        seleccion={pestana === "bloque" ? st.seleccion : ""}
        edicion={st.edicion}
        explicaciones={st.explicaciones}
        chequeos={chequeos}
        campos={camposDelMenu}
        textoDeCampo={textoDeCampo}
        apertura={envio.opening ?? null}
        envioDeApertura={envio.label}
        onSeleccionar={seleccionar}
        onEditar={st.setEdicion}
        onTexto={(zona, prop, valor) => {
          if (zona === APERTURA) {
            // La apertura es del envío, no de la plantilla: se escribe en `send.opening`.
            const id = useCorreosStore.getState().envio;
            st.editarEnvios((lista) => conApertura(lista, id, valor));
            return;
          }
          st.editar((t) => editarBloque(t, zona, (b) => conTextoDeZona(b, prop, valor)), `${zona}.${prop}`);
        }}
        onSiguientePunto={(zona, prop) => {
          const block = useCorreosStore.getState().borrador?.blocks.find((b) => b.block_id === zona);
          if (!block) return;
          const out = conPuntoNuevo(block, prop);
          st.editar((t) => editarBloque(t, zona, () => out.block));
          st.setEdicion({ zona, prop: out.prop });
        }}
        onQuitarPunto={(zona, prop) => {
          const block = useCorreosStore.getState().borrador?.blocks.find((b) => b.block_id === zona);
          if (!block) return;
          const out = sinPunto(block, prop);
          if (!out.prop) return;
          st.editar((t) => editarBloque(t, zona, () => out.block));
          st.setEdicion({ zona, prop: out.prop });
        }}
        onTerminar={(zona, prop) => {
          if (zona === APERTURA) {
            // Vacía, la apertura se quita: el envío vuelve al cuerpo común.
            const id = useCorreosStore.getState().envio;
            st.editarEnvios((lista) => cerrarApertura(lista, id));
          } else {
            st.editar((t) => editarBloque(t, zona, (b) => sinPuntosVacios(b, prop)), `${zona}.${prop}`);
          }
          st.cortarGrupo();
        }}
        onMover={(id, indice) => st.editar((t) => moverBloqueA(t, id, indice))}
        onInsertar={(type, hueco) => {
          const actual = useCorreosStore.getState().borrador;
          const out = actual ? insertarBloqueEn(actual, type, hueco) : null;
          if (!out) return;
          st.reemplazarBorrador(out.template);
          seleccionar(out.block_id);
        }}
        onQuitar={quitarConAviso}
        onArchivoDeImagen={subirImagenDeBloque}
        onDeshacer={st.deshacer}
        onRehacer={st.rehacer}
      />
    );
  };

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
    // La imagen nombra su propio archivo: un id que no choque con otra.
    const plantilla = type === "image"
      ? editarBloque(out.template, out.block_id, (b) => ({ ...b, image_ref: (bloqueParaInsertar(template, "image") as { image_ref: string }).image_ref }) as MailBlock)
      : out.template;
    st.reemplazarBorrador(plantilla);
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

  const crearPrimera = async (origen: string, nombre: string, platform: MailPlatform) => {
    setCreandoPrimera(origen);
    st.setAvisoCampanas(null);
    const out = await campanasAcc.crear({ name: nombre, actor: "", origen, platform });
    setCreandoPrimera(null);
    if (!out.ok) {
      st.setAvisoCampanas({ tono: "error", texto: out.mensaje });
      return;
    }
    if (out.aviso) st.setAvisoCampanas({ tono: "info", texto: out.aviso });
    abrirCampana(out.campaignId);
  };

  const avisarDeshacer = useCallback((texto: string, deshacer: () => void) => {
    setDeshacible((previo) => ({ texto, deshacer, clave: (previo?.clave ?? 0) + 1 }));
  }, []);

  /** Quitar un bloque, desde el correo o el inspector: se anuncia con su «Deshacer». */
  function quitarConAviso(id: string) {
    const block = useCorreosStore.getState().borrador?.blocks.find((b) => b.block_id === id);
    st.editar((t) => quitarBloque(t, id));
    st.seleccionar(SOBRE);
    avisarDeshacer(`${block ? rotuloDeBloque(block) : "Bloque"} quitado`, () => useCorreosStore.getState().deshacer());
  }

  /** Elige el bloque del chequeo: lo marca en el correo y muestra su inspector. */
  const irAlBloque = (id: string) => {
    const t = useCorreosStore.getState().borrador;
    // Una cabecera sin descripción se corrige donde se escribe: en Identidad, con el campo listo.
    const sinAlt = id === CABECERA && t ? cabeceraSinAlt(t) : null;
    if (sinAlt) {
      st.setPedirAlt(sinAlt);
      identidad.abrir();
      return;
    }
    if (id !== CABECERA && id !== SOBRE && !t?.blocks.some((b) => b.block_id === id)) {
      irAPestana("revision");
      return;
    }
    seleccionar(id);
    panelAbierto?.cerrar();
    // El foco cae en lo que hay que corregir: lo marcado, o el primer texto del inspector.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const insp = document.getElementById("rec-mail-inspector");
      const campo = insp?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? insp?.querySelector<HTMLElement>("input, textarea");
      campo?.focus();
    }));
  };

  /** «Ver qué falta corregir»: directo al primer bloque con error; si ninguno tiene bloque, a Revisión. */
  const irAlPrimerError = () => {
    const errores = st.revision?.checks.filter((c) => c.status === "error") ?? [];
    const destino = errores.map((c) => destinoDelChequeo(c, SOBRE)).find((d): d is string => d !== null);
    if (destino) irAlBloque(destino);
    else irAPestana("revision");
  };

  const agregarEnvio = () => {
    const out = agregarRecordatorio(useCorreosStore.getState().envios);
    if (!out.sendId) return;
    st.editarEnvios(() => out.envios);
    st.setEnvio(out.sendId);
    enviosPanel.abrir();
  };

  // Los diálogos esperan la lista: sin ella no saben qué campaña nombrar.
  const dialogos = !listaLista ? null : (
    <>
      <DialogoImportarHtml
        panel={importarPanel}
        activa={campanaActiva}
        campanas={st.campanas}
        plataformaPorDefecto={campanaActiva?.platform ?? "mailchimp"}
        conCambios={porGuardar}
        ocupado={st.ocupado === "campanas"}
        onCrear={campanasAcc.crearImportada}
        onReemplazar={(t, importId) => {
          st.reemplazarPorImportada(t, importId);
          const sinAlt = cabeceraSinAlt(t);
          st.setPedirAlt(sinAlt);
          st.setAviso({ tono: "info", texto: "La plantilla se reemplazó por el correo importado. Guarda para conservarla; ⌘Z la deshace." });
          // Una cabecera sin descripción se pide en el acto, en Identidad.
          ir({ panel: sinAlt ? PANEL_CORREO_IDENTIDAD.id : null });
        }}
        onAbrir={(campaignId, aviso, importada) => {
          if (aviso) st.setAvisoCampanas({ tono: "info", texto: aviso });
          const sinAlt = importada ? cabeceraSinAlt(importada) : null;
          st.setPedirAlt(sinAlt);
          ir({ foco: campaignId, panel: sinAlt ? PANEL_CORREO_IDENTIDAD.id : null });
        }}
      />
      <DialogoCampanas
        panel={campanasPanel}
        campanas={st.campanas}
        activa={st.campana}
        presets={st.presets}
        ocupado={st.ocupado === "campanas"}
        conCambios={porGuardar}
        acciones={campanasAcc}
        onImportar={() => ir({ panel: PANEL_CORREO_IMPORTAR.id })}
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
          onCrear={(origen, nombre, platform) => { void crearPrimera(origen, nombre, platform); }}
          onImportar={importarPanel.abrir}
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

  const totalPersonas = st.destinatarios?.loaded ? st.destinatarios.counts?.valid ?? 0 : 0;
  const imagenesSinArchivo = st.revision?.checks.find((c) => c.code === "images_available")?.items
    .filter((i): i is string => typeof i === "string") ?? [];
  const bannerCheck = st.revision?.checks.find((c) => c.code === "banner_size") ?? null;
  const ocupado = st.ocupado !== null;
  const bloqueElegido = template.blocks.find((b) => b.block_id === st.seleccion);
  const imagenDelBloque = bloqueElegido?.type === "image"
    ? st.imagenesLocales[bloqueElegido.image_ref] ?? srcDeImagenDelBloque(st.vistaPrevia?.html, bloqueElegido.block_id)
    : null;
  const tabs: { id: Pestana; label: string; cuenta?: number }[] = [
    { id: "bloque", label: "Bloque" },
    // Sin cuenta: la cuenta roja de las pestañas es de lo que falta corregir, no de cuántos envíos hay.
    { id: "envios", label: "Envíos" },
    { id: "identidad", label: "Identidad" },
    { id: "destinatarios", label: "Personas" },
    { id: "revision", label: "Revisión", cuenta: st.revision ? st.revision.errors : undefined },
  ];

  return (
    <>
    {dialogos}
    <AvisoDeshacer key={deshacible?.clave} aviso={deshacible} onCerrar={cerrarDeshacible} />
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
              <span className="rec-env-barra-campana">
              <SelectorDeCampana
                campanas={st.campanas}
                activa={campanaActiva}
                conCambios={porGuardar}
                onElegir={abrirCampana}
                onGestionar={campanasPanel.abrir}
              />
              <span className="rec-guia-plataforma" title={`Esta campaña sale por ${NOMBRE_DE_PLATAFORMA[dialecto]}`}>{NOMBRE_DE_PLATAFORMA[dialecto]}</span>
              </span>
              <span className="rec-env-barra-linea">
                <SelectorDeEnvio
                  envios={st.envios}
                  activo={envio}
                  onElegir={st.setEnvio}
                  onAgregar={agregarEnvio}
                  onGestionar={() => irAPestana("envios")}
                />
                <button
                  type="button"
                  className="rec-mail-asunto"
                  title={`Asunto: ${asuntoDelEnvio(envio, template) || "sin asunto"}`}
                  onClick={() => { if (envio.subject?.trim()) irAPestana("envios"); else seleccionar(SOBRE); }}
                >
                  Asunto: {asuntoDelEnvio(envio, template) || "sin asunto"}
                </button>
              </span>
            </span>
          </span>
          <span className="rec-mail-barra-acciones">
            <span className="rec-capa-historial" role="group" aria-label="Deshacer y rehacer">
              <PulsoButton variant="icon" size="sm" aria-label="Deshacer" title="Deshacer (⌘Z)" disabled={!st.historial.pasado.length} onClick={st.deshacer}>
                <Undo2 size={14} aria-hidden />
              </PulsoButton>
              <PulsoButton variant="icon" size="sm" aria-label="Rehacer" title="Rehacer (⌘⇧Z)" disabled={!st.historial.futuro.length} onClick={st.rehacer}>
                <Redo2 size={14} aria-hidden />
              </PulsoButton>
            </span>
            <span className="rec-capa-explicaciones" title={`Explicaciones: qué hace cada bloque y cómo sale en ${NOMBRE_DE_PLATAFORMA[dialecto]}`}>
              <Switch
                id="rec-mail-explicaciones"
                checked={st.explicaciones}
                ariaLabel="Explicaciones al pasar el cursor"
                onToggle={() => st.setExplicaciones(!st.explicaciones)}
              />
              <label htmlFor="rec-mail-explicaciones">Explicaciones</label>
            </span>
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
          ejemploDeNombre={persona?.nombre && !PARECE_CORREO.test(persona.nombre) ? persona.nombre : undefined}
          onMover={(id, indice) => st.editar((t) => moverBloqueA(t, id, indice))}
        />

        {!st.aviso ? <GuiaDelEditor /> : null}

        <VistaPreviaDelCorreoConectada capa={capa} />

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
            // Otra pestaña empieza arriba: no hereda el scroll de la anterior.
            key={pestana}
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
                onQuitar={quitarConAviso}
                onAbrirIdentidad={() => irAPestana("identidad")}
                explicaciones={st.explicaciones}
                dialecto={dialecto}
                chequeos={chequeos[st.seleccion === CABECERA ? CABECERA : st.seleccion]?.chequeos ?? []}
                vistaDeImagen={imagenDelBloque}
                ocupado={ocupado}
                onSubirImagen={subirImagenDeBloque}
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
                pedirAlt={st.pedirAlt}
                onAltListo={() => st.setPedirAlt(null)}
              />
            ) : null}
            {pestana === "envios" ? (
              <PanelEnvios
                envios={st.envios}
                activo={envio}
                template={template}
                plataforma={dialecto}
                porGuardar={porGuardar}
                ocupado={ocupado}
                exportando={st.ocupado === "exportando-plantilla"}
                onElegir={st.setEnvio}
                onAgregar={agregarEnvio}
                onQuitar={(id) => {
                  const antes = useCorreosStore.getState().envios;
                  const quitado = antes.find((e) => e.send_id === id);
                  st.editarEnvios((lista) => quitarEnvio(lista, id));
                  avisarDeshacer(`${quitado?.label ?? "Recordatorio"} quitado`, () => st.editarEnvios(() => antes));
                }}
                onEditar={(id, cambio) => st.editarEnvios((lista) => editarEnvio(lista, id, cambio))}
                onExportar={() => {
                  void acciones.exportar("plantilla").then((resultado) => { if (resultado === "revision") irAPestana("revision"); });
                }}
              />
            ) : null}
            {pestana === "destinatarios" && dialecto === "surveymonkey" ? (
              <DestinatariosEnSurveyMonkey />
            ) : null}
            {pestana === "destinatarios" && dialecto !== "surveymonkey" ? (
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
            {pestana === "revision" ? <PanelRevision revision={st.revision} cargando={st.revisionCargando} onIrAlBloque={irAlBloque} /> : null}
          </div>
          {dialecto === "surveymonkey" ? (
            <PanelSurveyMonkey
              template={template}
              envio={envio}
              revision={st.revision}
              exportacion={st.exportacion}
              exportando={st.ocupado === "exportando-plantilla"}
              ocupado={ocupado}
              onEditar={editar}
              onHtml={acciones.htmlParaLaPlataforma}
              onExportar={() => {
                void acciones.exportar("plantilla").then((resultado) => { if (resultado === "revision") irAPestana("revision"); });
              }}
              onGuardarJunto={() => { void acciones.guardarJuntoAlProyecto(); }}
              onVerRevision={irAlPrimerError}
            />
          ) : (
          <PanelMailchimp
            envio={st.envios.length > 1 ? envio.label : null}
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
            onVerRevision={irAlPrimerError}
          />
          )}
        </aside>
      </div>
    </div>
    </>
  );
}
