import { create } from "zustand";
import { KOBO_DEFAULT_BASE_URL, KOBO_PARAM_TEMPLATE, type ManualLinkRecord } from "./aulas";
import { captureUrlOk } from "../../lib/captureUrl";
import type { ConnectionTokenState, MonitoreoKoboAssetItem } from "../../api/client";

// =============================================================================
// Store local de Recopiladores
// =============================================================================
// Reemplaza el racimo de 22 `useState` que la página acumuló. Lo que se gana no
// es "menos líneas": es que las transiciones que SIEMPRE van juntas dejen de
// depender de que cada call site se acuerde de todas.
//
// El caso concreto: elegir otro perfil de Kobo tiene que limpiar los assets, el
// asset elegido, el enlace resuelto y el error del perfil anterior. Con cuatro
// `setKobo*` sueltos eso es una convención que se cumple si el que escribe el
// handler se acuerda; acá es una sola acción y no hay forma de olvidarse la
// mitad.
//
// Qué NO vive acá: el ciclo de fetch de la página (`state`, `calcState`,
// `loading`, `error`). Son el resultado de una carga que nace y muere con el
// montaje, no estado compartido, y subirlos a un store global solo agrega una
// forma de que sobrevivan a la vista que los pidió.
//
// El enlace generado tampoco: se deriva de la agenda más `manualLinks` en un
// `useMemo`. Guardarlo sería una segunda copia que puede desincronizarse.

/** Alcance de un reset. Un proyecto nuevo no hereda NADA del anterior. */
type KoboSlice = {
  koboConnection: ConnectionTokenState | null;
  koboProfileId: string;
  koboBaseUrl: string;
  koboAssets: MonitoreoKoboAssetItem[];
  koboAssetUid: string;
  koboBaseLink: string;
  koboParamTemplate: string;
  koboLoading: boolean;
  koboResolving: boolean;
  koboResolvedFrom: string;
  koboError: string;
};

type RecopiladoresState = KoboSlice & {
  // --- Filtro y selección de la agenda ---
  selectedFaculty: string;
  query: string;
  selectedKey: string;

  // --- Pegado manual de enlaces ---
  linkPaste: string;
  manualLinks: Map<string, ManualLinkRecord>;

  // --- Entrega a Monitoreo ---
  returnCopied: boolean;
  returnSaving: boolean;
  returnSaveMessage: string;
  returnSaveError: string;

  // --- Paquete imprimible ---
  printPreparedAt: string;

  setSelectedFaculty: (faculty: string) => void;
  setQuery: (query: string) => void;
  setSelectedKey: (key: string) => void;

  setLinkPaste: (text: string) => void;
  /**
   * Aplica lo pegado y CONSERVA el textarea: el operador tiene que poder ver qué
   * pegó, y el conteo de filas ignoradas solo se entiende junto al texto que las
   * produjo. Vaciarlo destruiría la evidencia de lo que se acaba de aplicar.
   *
   * Las tres acciones que cambian el conjunto de enlaces —pegar, limpiar y
   * generar— borran el mensaje y el error del guardado anterior, porque ese
   * feedback describía OTRO conjunto. Dejarlo puesto es cómo un "12 enlaces
   * guardados" sobrevive a un pegado que cambió los enlaces.
   */
  aplicarPegado: (links: Map<string, ManualLinkRecord>) => void;
  limpiarPegado: () => void;
  /** Generados desde Kobo: no toca el textarea, que es otra fuente. */
  aplicarEnlacesGenerados: (links: Map<string, ManualLinkRecord>) => void;

  setKoboConnection: (connection: ConnectionTokenState | null) => void;
  /** Elegir perfil descarta todo lo que era del perfil anterior. */
  elegirPerfilKobo: (profileId: string, baseUrl: string) => void;
  /**
   * Siembra los valores por defecto de la conexión SIN pisar una elección del
   * usuario: el perfil solo si todavía no hay uno, y la base solo si sigue en el
   * servidor por defecto. Es una acción y no dos `set` con updater porque el
   * "no pises lo elegido" es la regla, no un detalle del call site.
   */
  sembrarConexionKobo: (profileId: string, baseUrl: string) => void;
  setKoboBaseUrl: (baseUrl: string) => void;
  setKoboAssets: (assets: MonitoreoKoboAssetItem[]) => void;
  agregarAssetKobo: (asset: MonitoreoKoboAssetItem) => void;
  /**
   * Elegir formulario descarta la procedencia y el enlace del anterior, salvo
   * que el enlace actual sea una URL de captura válida: esa la puso el usuario a
   * mano y no se pierde por cambiar de formulario. Un enlace que NO captura sí se
   * limpia, para que no llegue al QR.
   */
  elegirAssetKobo: (uid: string) => void;
  setKoboBaseLink: (link: string) => void;
  setKoboParamTemplate: (template: string) => void;
  setKoboLoading: (loading: boolean) => void;
  /** Arrancar una resolución limpia el error y la procedencia previos. */
  empezarResolucionKobo: () => void;
  terminarResolucionKobo: (resultado: { link?: string; resolvedFrom?: string; error?: string }) => void;
  setKoboError: (error: string) => void;

  setReturnCopied: (copied: boolean) => void;
  /** Arrancar un guardado borra el mensaje y el error del intento anterior. */
  empezarGuardado: () => void;
  /**
   * Guardado exitoso: además del mensaje, descarta `manualLinks`. Ese mapa era el
   * overlay local de enlaces que todavía no estaban en el servidor; una vez
   * guardados, mantenerlo sería una segunda copia que puede contradecir a la
   * agenda que acaba de volver del backend.
   */
  guardadoConExito: (message: string) => void;
  guardadoConError: (error: string) => void;

  setPrintPreparedAt: (stamp: string) => void;

  /**
   * Sesión nueva: nada de la anterior sobrevive. Sin esto, los enlaces pegados y
   * el perfil de Kobo del proyecto A aparecerían en el B — el riesgo que un store
   * global agrega sobre un `useState` que moría con el montaje. Se dispara por
   * suscripción y no desde la página, para que no dependa de que alguien la llame.
   */
  resetForSession: () => void;
};

const KOBO_INICIAL: KoboSlice = {
  koboConnection: null,
  koboProfileId: "",
  koboBaseUrl: KOBO_DEFAULT_BASE_URL,
  koboAssets: [],
  koboAssetUid: "",
  koboBaseLink: "",
  koboParamTemplate: KOBO_PARAM_TEMPLATE,
  koboLoading: false,
  koboResolving: false,
  koboResolvedFrom: "",
  koboError: "",
};

const ESTADO_INICIAL = {
  selectedFaculty: "todas",
  query: "",
  selectedKey: "",
  linkPaste: "",
  manualLinks: new Map<string, ManualLinkRecord>(),
  returnCopied: false,
  returnSaving: false,
  returnSaveMessage: "",
  returnSaveError: "",
  printPreparedAt: "",
  ...KOBO_INICIAL,
};

export const useRecopiladoresStore = create<RecopiladoresState>((set) => ({
  ...ESTADO_INICIAL,

  setSelectedFaculty: (selectedFaculty) => set({ selectedFaculty }),
  setQuery: (query) => set({ query }),
  setSelectedKey: (selectedKey) => set({ selectedKey }),

  setLinkPaste: (linkPaste) => set({ linkPaste }),
  aplicarPegado: (manualLinks) =>
    set({ manualLinks, returnSaveMessage: "", returnSaveError: "" }),
  limpiarPegado: () =>
    set({ manualLinks: new Map(), linkPaste: "", returnSaveMessage: "", returnSaveError: "" }),
  aplicarEnlacesGenerados: (manualLinks) =>
    set({ manualLinks, koboError: "", returnSaveMessage: "", returnSaveError: "" }),

  setKoboConnection: (koboConnection) => set({ koboConnection }),
  elegirPerfilKobo: (koboProfileId, koboBaseUrl) =>
    set({
      koboProfileId,
      koboBaseUrl,
      koboAssets: [],
      koboAssetUid: "",
      koboBaseLink: "",
      koboResolvedFrom: "",
      koboError: "",
    }),
  sembrarConexionKobo: (profileId, baseUrl) =>
    set((s) => ({
      koboProfileId: s.koboProfileId || profileId,
      koboBaseUrl:
        s.koboBaseUrl && s.koboBaseUrl !== KOBO_DEFAULT_BASE_URL ? s.koboBaseUrl : baseUrl,
    })),
  setKoboBaseUrl: (koboBaseUrl) => set({ koboBaseUrl }),
  setKoboAssets: (koboAssets) => set({ koboAssets }),
  agregarAssetKobo: (asset) =>
    set((s) => ({
      koboAssets: s.koboAssets.some((a) => a.uid === asset.uid)
        ? s.koboAssets
        : [...s.koboAssets, asset],
    })),
  elegirAssetKobo: (koboAssetUid) =>
    set((s) => ({
      koboAssetUid,
      koboResolvedFrom: "",
      koboBaseLink: captureUrlOk(s.koboBaseLink) ? s.koboBaseLink : "",
    })),
  setKoboBaseLink: (koboBaseLink) => set({ koboBaseLink }),
  setKoboParamTemplate: (koboParamTemplate) => set({ koboParamTemplate }),
  setKoboLoading: (koboLoading) => set({ koboLoading }),
  empezarResolucionKobo: () => set({ koboResolving: true, koboError: "", koboResolvedFrom: "" }),
  terminarResolucionKobo: ({ link, resolvedFrom, error }) =>
    set((s) => ({
      koboResolving: false,
      koboBaseLink: link ?? s.koboBaseLink,
      koboResolvedFrom: resolvedFrom ?? "",
      koboError: error ?? "",
    })),
  setKoboError: (koboError) => set({ koboError }),

  setReturnCopied: (returnCopied) => set({ returnCopied }),
  empezarGuardado: () => set({ returnSaving: true, returnSaveMessage: "", returnSaveError: "" }),
  guardadoConExito: (returnSaveMessage) =>
    set({
      returnSaving: false,
      returnSaveMessage,
      returnSaveError: "",
      manualLinks: new Map(),
    }),
  guardadoConError: (returnSaveError) =>
    set({ returnSaving: false, returnSaveError, returnSaveMessage: "" }),

  setPrintPreparedAt: (printPreparedAt) => set({ printPreparedAt }),

  resetForSession: () => set({ ...ESTADO_INICIAL, manualLinks: new Map() }),
}));

// Misma suscripción que `carga` y `hojasRuta`: la guarda de `lastSid` evita
// resetear en el primer evento, que es el arranque normal y no un cambio.
let recopiladoresLastSid: string | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("pulso:session-changed", (ev) => {
    const detail = (ev as CustomEvent).detail as { new_sid?: string } | undefined;
    const newSid = detail?.new_sid;
    if (!newSid) return;
    if (recopiladoresLastSid !== null && recopiladoresLastSid !== newSid) {
      useRecopiladoresStore.getState().resetForSession();
    }
    recopiladoresLastSid = newSid;
  });
}
