import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type { MailBlock, MailGreetingBlock, MailPlatform, MailPreset, MailTemplate } from "../../../api/materialMail";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { GlidingTabList } from "../../../components/GlidingTabList";
import { PulsoButton } from "../../../components/PulsoButton";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { AlertTriangle, LayoutList, ListChecks, Palette, RefreshCw, Send, Users, type LucideIcon } from "../../../vendor/lucide-react";
import { BarraDelCorreo } from "./BarraDelCorreo";
import { alcanceDelPaqueteSM, conTratoPorSexo, ofertaDelTrato } from "./modeloTrato";
import { mostrarInicioDelPanel, useConCajon } from "./anchoDelEditor";
import { CajonDeBloques } from "./CajonDeBloques";
import { MenuExportar } from "./MenuExportar";
import { ColumnaDeBloques } from "./ColumnaDeBloques";
import {
  CABECERA,
  CAMPO_NOMBRE,
  SOBRE,
  agregarBloque,
  cabeceraSinAlt,
  conTexto,
  editarBloque,
  insertarToken,
  moverBloque,
  quitarBloque,
  repartirProblemas,
  rotuloDeBloque,
  textoDe,
} from "./modeloCorreo";
import { AvisoDeshacer, type Deshacible } from "./AvisoDeshacer";
import { CapaDeEdicion } from "./CapaDeEdicion";
import { rotuloDeClave } from "./camposDeclarados";
import { GuiaDelEditor } from "./GuiaDelEditor";
import { etiquetaDeCampo } from "./dialectos";
import { DialogoImportarHtml } from "./DialogoImportarHtml";
import { agregarRecordatorio, asuntoDelEnvio, cerrarApertura, conApertura, editarEnvio, quitarEnvio } from "./modeloEnvios";
import { PanelEnvios } from "./PanelEnvios";
import { PanelSurveyMonkey } from "./PanelSurveyMonkey";
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
import { conArchivoDeImagen, srcsDelPar, type LadoDelPar, type TipoInsertable } from "./piezasGraficas";
import { PanelDestinatarios } from "./PanelDestinatarios";
import { PanelIdentidad } from "./PanelIdentidad";
import { CHEQUEOS_DE_ESTILO, IDENTIDAD } from "./modeloEstilo";
import { PanelMailchimp } from "./PanelMailchimp";
import { PanelRevision } from "./PanelRevision";
import { VistaPreviaDelCorreoConectada } from "./VistaPreviaDelCorreo";
import {
  PANEL_CORREO_DESTINATARIOS,
  PANEL_CORREO_ENVIOS,
  PANEL_CORREO_IDENTIDAD,
  PANEL_CORREO_IMPORTAR,
  PANEL_CORREO_REVISION,
} from "./panelesCorreos";
import { envioElegido, hayCambios, hayQueGuardar, useCorreosStore } from "./store";
import { useCampanaDelFoco } from "./useCampanaDelFoco";
import type { AccionesDeCampanas } from "./useCampanas";
import { useCorreos } from "./useCorreos";
import "./correos.css";
import "./correosCampanas.css";
import "./correosCapa.css";
import "./correosEnvios.css";
import "./correosGuia.css";
import "./correosInspector.css";
import "./correosIconos.css";

type Props = {
  /** Avisa al shell mientras el correo o su vista previa no han llegado. */
  onCargando?: (cargando: boolean) => void;
  /**
   * Cada escritura (guardar, crear, duplicar, renombrar, borrar) sube la
   * revisión global del estado: el shell la relee para que las otras secciones
   * no escriban con una vieja (H-f).
   */
  onStateRefresh?: () => void | Promise<void>;
  /**
   * Las escrituras de campañas (crear desde un HTML importado, sobre todo). El
   * dueño del ciclo de vida de la lista es el shell del módulo: la lista de
   * campañas y este editor leen el mismo store (ADR 0111).
   */
  campanasAcc: AccionesDeCampanas;
  /** La miga de la campaña abierta: va dentro de la barra del correo, que es la única. */
  cabecera?: ReactNode;
  /** Cuándo se exportó cada envío (`send_id` → ISO), del registro de campañas (F16). */
  exportados?: Readonly<Record<string, string>>;
};

type Pestana = "bloque" | "envios" | "identidad" | "destinatarios" | "revision";

const PARECE_CORREO = /[^\s@]+@[^\s@]+/;

/**
 * La campaña de correo abierta (ADR 0111 §3; antes Catálogo › Correos, ADR 0110
 * §2): el correo se compone aquí con bloques del registro cerrado y sale como
 * insumo para Mailchimp o SurveyMonkey. El envío masivo se hace en la
 * plataforma; esta vista no envía nada. Crear, duplicar, renombrar y borrar la
 * campaña viven en la lista y en la cabecera de la campaña.
 */
export function CorreosEditor({ onCargando, onStateRefresh, campanasAcc, cabecera = null, exportados = {} }: Props) {
  const onEscrito = useCallback(() => { void onStateRefresh?.(); }, [onStateRefresh]);
  const cerrarDeshacible = useCallback(() => setDeshacible(null), []);
  const acciones = useCorreos({ onEscrito });
  const st = useCorreosStore();
  const { ir } = useCampanaDelFoco();
  const [deshacible, setDeshacible] = useState<Deshacible | null>(null);
  const identidad = usePanelDireccionable(PANEL_CORREO_IDENTIDAD);
  const destinatariosPanel = usePanelDireccionable(PANEL_CORREO_DESTINATARIOS);
  const revisionPanel = usePanelDireccionable(PANEL_CORREO_REVISION);
  const enviosPanel = usePanelDireccionable(PANEL_CORREO_ENVIOS);
  const importarPanel = usePanelDireccionable(PANEL_CORREO_IMPORTAR);
  const [presetPendiente, setPresetPendiente] = useState<MailPreset | null>(null);
  // #8: el punto de aviso del correo lleva al chequeo de su zona en Revisión.
  const [zonaDeRevision, setZonaDeRevision] = useState<string | null>(null);
  // F3: por debajo de 1200 px de ancho útil la columna de bloques va a un cajón.
  const [refDelContenedor, conCajon] = useConCajon();

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
    // F8: la pestaña nueva se ve desde su comienzo, bajo las pestañas pegadas.
    window.requestAnimationFrame(() => {
      const panel = document.getElementById("rec-mail-inspector");
      mostrarInicioDelPanel(panel, panel?.previousElementSibling instanceof HTMLElement ? panel.previousElementSibling : null);
    });
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
      rotuloDeCampo: (k: string) => porClave.get(k)?.label ?? rotuloDeClave(k),
      // Sin llaves ni etiquetas de plataforma: el chip se explica en palabras (#5).
      ayudaDeCampo: (k: string) => `${porClave.get(k)?.label ?? rotuloDeClave(k)}: cambia con cada persona`,
      // N5: un campo que la campaña no declara sale en tono de error.
      campoValido: (k: string) => porClave.has(k),
    };
  }, [camposDelMenu]);
  useEffect(() => () => onCargando?.(false), [onCargando]);

  const editar = useCallback((update: (t: MailTemplate) => MailTemplate, grupo?: string) => st.editar(update, grupo), [st]);
  const editarUnBloque = useCallback((id: string, update: (b: MailBlock) => MailBlock, grupo?: string) => {
    st.editar((t) => editarBloque(t, id, update), grupo);
  }, [st]);

  /**
   * Sube el archivo de un bloque imagen (o de un lado de un par). El id sale
   * del nombre del archivo y no choca con otra imagen del correo; el bloque
   * pasa a nombrarlo (`conArchivoDeImagen`, piezasGraficas.ts).
   */
  const subirImagenDeBloque = (blockId: string, file: File, lado?: LadoDelPar) => {
    const actual = useCorreosStore.getState().borrador;
    const out = actual ? conArchivoDeImagen(actual, blockId, file.name, lado) : null;
    if (!actual || !out) return;
    if (out.template !== actual) st.editar(() => out.template);
    void acciones.subirImagen(out.id, file);
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
        onVerRevision={(zona) => { setZonaDeRevision(zona); irAPestana("revision"); }}
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
        onArchivoDeLogo={(id, file) => { void acciones.subirImagen(id, file); }}
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

  const agregar = (type: TipoInsertable) => {
    if (!template) return;
    const seleccionActual = template.blocks.some((b) => b.block_id === st.seleccion) ? st.seleccion : null;
    const out = agregarBloque(template, type, seleccionActual);
    // Cada imagen (y cada lado de un par) nombra su propio archivo: ids que no choquen.
    const plantilla = editarBloque(out.template, out.block_id, () => bloqueParaInsertar(template, type));
    st.reemplazarBorrador(plantilla);
    seleccionar(out.block_id);
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

  /**
   * Elige el bloque del chequeo: lo marca en el correo y muestra su inspector.
   * `foco` (un `data-foco`) nombra el control que hay que tocar allí.
   */
  const irAlBloque = (id: string, foco?: string) => {
    const t = useCorreosStore.getState().borrador;
    // Una cabecera sin descripción se corrige donde se escribe: en Identidad, con el campo listo.
    const sinAlt = id === CABECERA && t ? cabeceraSinAlt(t) : null;
    if (sinAlt) {
      st.setPedirAlt(sinAlt);
      identidad.abrir();
      return;
    }
    // E1n: los chequeos de Campaña llevan a Identidad › Estilo, al control del color.
    if (id === IDENTIDAD) {
      identidad.abrir();
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const control = foco ? document.querySelector<HTMLElement>(`[data-foco="${CSS.escape(foco)}"]`) : null;
        control?.scrollIntoView({ block: "center" });
        control?.focus({ preventScroll: true });
      }));
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
      const campo = (foco ? insp?.querySelector<HTMLElement>(`[data-foco="${CSS.escape(foco)}"]`) : null)
        ?? insp?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? insp?.querySelector<HTMLElement>("input, textarea");
      // Con el scroll hasta él: en compacto el dueño del scroll es el panel, no el inspector.
      campo?.scrollIntoView({ block: "center" });
      campo?.focus({ preventScroll: true });
    }));
  };

  const agregarEnvio = () => {
    const actual = useCorreosStore.getState();
    // F16: el recordatorio nace con «Recordatorio: <asunto>» del envío que se miraba.
    const out = agregarRecordatorio(actual.envios, actual.borrador ? asuntoDelEnvio(envioElegido(actual), actual.borrador) : null);
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
  // C8: con lista, el paquete de SurveyMonkey es `completo` y trae
  // contactos_surveymonkey.csv con el saludo ya escrito; sin ella, la plantilla.
  const alcanceDelPaquete = alcanceDelPaqueteSM(dialecto, Boolean(st.destinatarios?.loaded));
  const imagenesSinArchivo = st.revision?.checks.find((c) => c.code === "images_available")?.items
    .filter((i): i is string => typeof i === "string") ?? [];
  const bannerCheck = st.revision?.checks.find((c) => c.code === "banner_size") ?? null;
  const chequeosDeEstilo = Object.fromEntries((st.revision?.checks ?? [])
    .filter((c) => (CHEQUEOS_DE_ESTILO as readonly string[]).includes(c.code))
    .map((c) => [c.code, c]));
  const ocupado = st.ocupado !== null;
  const bloqueElegido = template.blocks.find((b) => b.block_id === st.seleccion);
  const imagenDelBloque = bloqueElegido?.type === "image"
    ? st.imagenesLocales[bloqueElegido.image_ref] ?? srcDeImagenDelBloque(st.vistaPrevia?.html, bloqueElegido.block_id)
    : null;
  // Un par: lo que ya se ve de cada lado (recién subido o pintado por la vista previa).
  const parDelBloque = bloqueElegido?.type === "two_images" ? srcsDelPar(st.vistaPrevia?.html, bloqueElegido.block_id) : null;
  const imagenesDelPar = bloqueElegido?.type === "two_images" && parDelBloque
    ? { left: st.imagenesLocales[bloqueElegido.left] ?? parDelBloque.left, right: st.imagenesLocales[bloqueElegido.right] ?? parDelBloque.right }
    : null;
  const tabs: { id: Pestana; label: string; icono: LucideIcon; cuenta?: number }[] = [
    { id: "bloque", label: "Bloque", icono: LayoutList },
    // Sin cuenta: la cuenta de las pestañas es de lo que falta corregir, no de cuántos envíos hay.
    { id: "envios", label: "Envíos", icono: Send },
    { id: "identidad", label: "Identidad", icono: Palette },
    { id: "destinatarios", label: "Personas", icono: Users },
    { id: "revision", label: "Revisión", icono: ListChecks, cuenta: st.revision ? st.revision.errors : undefined },
  ];
  // F2: el saludo por sexo se ofrece en Personas, donde se carga la lista.
  const saludo = template.blocks.find((b): b is MailGreetingBlock => b.type === "greeting") ?? null;
  const oferta = ofertaDelTrato(saludo, st.destinatarios?.loaded ? st.destinatarios.columns : []);
  const exportarYVer = (scope: "plantilla" | "completo") => {
    void acciones.exportar(scope).then((resultado) => {
      if (resultado !== "revision") return;
      st.setExportarAbierto(false);
      irAPestana("revision");
    });
  };
  const verRevisionDesdeExportar = () => {
    st.setExportarAbierto(false);
    irAPestana("revision");
  };
  const elegirEnLaColumna = (id: string) => {
    seleccionar(id);
    // En compacto, elegir un bloque cierra el cajón: el inspector pasa a mostrarlo.
    if (conCajon) st.setCajonAbierto(false);
  };
  const columna = (
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
      onSeleccionar={elegirEnLaColumna}
      onAgregar={agregar}
      onInsertarCampo={insertarCampo}
      hayDestino={Boolean(st.destino) && pestana === "bloque"}
      ejemploDeNombre={persona?.nombre && !PARECE_CORREO.test(persona.nombre) ? persona.nombre : undefined}
      onMover={(id, indice) => st.editar((t) => moverBloqueA(t, id, indice))}
    />
  );
  const conProblemas = problemas.sobre.length + problemas.cabecera.length
    + Object.values(problemas.porBloque).filter((lista) => lista.length > 0).length;

  return (
    <>
    {dialogos}
    <AvisoDeshacer key={deshacible?.clave} aviso={deshacible} onCerrar={cerrarDeshacible} />
    <div className="rec-mail-contenedor" ref={refDelContenedor}>
      <div
        className={`rec-mail${conCajon ? " is-cajon" : ""}`}
        data-qa-geometry-group="material-campo/correo/editor"
        data-qa-geometry-contract="intrinsic"
      >
        <BarraDelCorreo
          cabecera={cabecera}
          cajon={conCajon ? (
            <CajonDeBloques abierto={st.cajonAbierto} onAbierto={st.setCajonAbierto} conProblemas={conProblemas}>
              {columna}
            </CajonDeBloques>
          ) : null}
          exportar={(
            <MenuExportar plataforma={dialecto} abierto={st.exportarAbierto} onAbierto={st.setExportarAbierto} listo={Boolean(st.exportacion?.zip)}>
              {dialecto === "surveymonkey" ? (
                <PanelSurveyMonkey
                  envio={envio}
                  revision={st.revision}
                  exportacion={st.exportacion}
                  exportando={st.ocupado === "exportando-plantilla" || st.ocupado === "exportando"}
                  ocupado={ocupado}
                  conLista={alcanceDelPaquete === "completo"}
                  onHtml={acciones.htmlParaLaPlataforma}
                  onExportar={() => exportarYVer(alcanceDelPaquete)}
                  onGuardarJunto={() => { void acciones.guardarJuntoAlProyecto(); }}
                  onVerRevision={verRevisionDesdeExportar}
                />
              ) : (
                <PanelMailchimp
                  envio={st.envios.length > 1 ? envio.label : null}
                  revision={st.revision}
                  exportacion={st.exportacion}
                  exportando={st.ocupado === "exportando" ? "completo" : st.ocupado === "exportando-plantilla" ? "plantilla" : null}
                  ocupado={ocupado}
                  htmlActual={st.vistaPrevia?.html ?? null}
                  onExportar={exportarYVer}
                  onGuardarJunto={() => { void acciones.guardarJuntoAlProyecto(); }}
                  onVerRevision={verRevisionDesdeExportar}
                />
              )}
            </MenuExportar>
          )}
          plataforma={dialecto}
          envios={st.envios}
          envio={envio}
          exportados={exportados}
          onElegirEnvio={st.setEnvio}
          onAgregarEnvio={agregarEnvio}
          onGestionarEnvios={() => irAPestana("envios")}
          puedeDeshacer={st.historial.pasado.length > 0}
          puedeRehacer={st.historial.futuro.length > 0}
          onDeshacer={st.deshacer}
          onRehacer={st.rehacer}
          vista={st.vista}
          onVista={st.setVista}
          explicaciones={st.explicaciones}
          onExplicaciones={st.setExplicaciones}
          persona={persona ? { nombre: persona.nombre, ejemplo: persona.source === "synthetic" } : null}
          puedeSiguientePersona={Boolean(totalPersonas)}
          onSiguientePersona={st.siguientePersona}
          asunto={asuntoDelEnvio(envio, template)}
          onIrAlAsunto={() => { if (envio.subject?.trim()) irAPestana("envios"); else seleccionar(SOBRE); }}
          estadoGuardado={st.builtin ? "Plantilla de fábrica" : "Guardado"}
          guardando={st.ocupado === "guardando"}
          porGuardar={porGuardar}
          puedeGuardar={porGuardar && !ocupado}
          onGuardar={() => { void acciones.guardar(); }}
        />

        {st.aviso ? (
          <p className={`rec-mail-aviso is-${st.aviso.tono}`} role={st.aviso.tono === "error" ? "alert" : "status"}>
            {st.aviso.texto}
            {st.aviso.texto.includes("Vuelve a cargar") ? (
              <button type="button" className="rec-mail-link" onClick={() => { void acciones.cargar(); }}>Volver a cargar</button>
            ) : avisoCampanas}
          </p>
        ) : null}

        {conCajon ? null : columna}

        {/* La guía de la primera visita va arriba del correo, dentro del lienzo:
            reserva su alto y no tapa la hoja (caber no es no pisarse). */}
        <VistaPreviaDelCorreoConectada capa={capa} encabezado={!st.aviso ? <GuiaDelEditor /> : null} />

        <aside className="rec-mail-col rec-mail-col--inspector" aria-label="Inspector del correo">
          <GlidingTabList
            className="rec-mail-tabs rec-mail-tabs--secciones"
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
                <tab.icono size={16} aria-hidden className="rec-mail-tab-icono" />
                <span className="rec-mail-tab-rotulo">{tab.label}</span>
                {tab.cuenta ? (
                  <span className="rec-mail-tab-cuenta" aria-label={`${tab.cuenta} por corregir`}>{tab.cuenta}</span>
                ) : null}
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
                vistasDelPar={imagenesDelPar}
                ocupado={ocupado}
                onSubirImagen={subirImagenDeBloque}
                onSubirLogo={(id, file) => { void acciones.subirImagen(id, file); }}
                destinatarios={st.destinatarios}
                onIrAPersonas={() => irAPestana("destinatarios")}
              />
            ) : null}
            {pestana === "identidad" ? (
              <PanelIdentidad
                template={template}
                imagenesLocales={st.imagenesLocales}
                htmlDeLaVista={st.vistaPrevia?.html ?? null}
                sinArchivo={imagenesSinArchivo}
                bannerCheck={bannerCheck}
                chequeosDeEstilo={chequeosDeEstilo}
                ocupado={ocupado}
                onEditar={editar}
                onSubir={(id, file) => { void acciones.subirImagen(id, file); }}
                pedirAlt={st.pedirAlt}
                onAltListo={() => st.setPedirAlt(null)}
                plataforma={dialecto}
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
                exportados={exportados}
                onElegir={st.setEnvio}
                onAgregar={agregarEnvio}
                onQuitar={(id) => {
                  const antes = useCorreosStore.getState().envios;
                  const quitado = antes.find((e) => e.send_id === id);
                  st.editarEnvios((lista) => quitarEnvio(lista, id));
                  avisarDeshacer(`${quitado?.label ?? "Recordatorio"} quitado`, () => st.editarEnvios(() => antes));
                }}
                onEditar={(id, cambio) => st.editarEnvios((lista) => editarEnvio(lista, id, cambio))}
                onExportar={() => exportarYVer(alcanceDelPaquete)}
              />
            ) : null}
            {pestana === "destinatarios" ? (
              <PanelDestinatarios
                template={template}
                destinatarios={st.destinatarios}
                persona={st.persona}
                ocupado={ocupado}
                dialecto={dialecto}
                oferta={oferta}
                onUsarColumnaDeSexo={(columna) => {
                  if (!saludo) return;
                  editarUnBloque(saludo.block_id, (b) => (b.type === "greeting" ? conTratoPorSexo(b, columna) : b));
                }}
                onVerSaludo={saludo ? () => irAlBloque(saludo.block_id) : undefined}
                onEditar={editar}
                onImportar={(file) => { void acciones.importar(file); }}
                onMapear={(mapping) => { void acciones.mapear(mapping); }}
                onOlvidar={() => { void acciones.olvidar(); }}
                onVerComo={st.setPersona}
              />
            ) : null}
            {pestana === "revision" ? (
              <PanelRevision
                revision={st.revision}
                cargando={st.revisionCargando}
                onIrAlBloque={irAlBloque}
                template={template}
                resaltar={zonaDeRevision}
                onResaltado={() => setZonaDeRevision(null)}
              />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
    </>
  );
}
