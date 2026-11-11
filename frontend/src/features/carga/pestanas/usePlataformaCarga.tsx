import { useEffect, useState, type ComponentProps } from "react";
import {
  apiCargaKoboAssets,
  apiConnectionsList,
  apiSurveyMonkeyMultibaseListSurveys,
  CargaPlatformProvider,
  ConnectionTokenState,
  EstudioPayload,
  MonitoreoKoboAssetItem,
  SurveyMonkeyMultibaseListItem,
} from "../../../api/client";
import { apiCargaAgregarFuenteSm, apiCargaVistaPreviaFuenteSm, type VistaPreviaFuente } from "../../../api/xlsformEditor";
import { nombreCortoDeEncuesta, nombreLibreDeBase } from "../importSeparadoModel";
import type { MultiBaseStrategy } from "../store";
import { ImportadorPlataforma } from "../plataforma/ImportadorPlataforma";
import type { UseImportsDeCarga } from "../plataforma/useImportsDeCarga";
import { connectedProfiles, type DetectedKoboSource } from "./cargaPaginaModelo";
import type { PlatformImportPanel } from "./PanelPlataforma";

/** Lo que el import necesita saber del estudio en el momento de pulsar, no al montar. */
export type ContextoImportPlataforma = {
  estudio: EstudioPayload | null;
  /** La topología resuelta es de varias bases. */
  esVarias: boolean;
  estrategia: MultiBaseStrategy;
};

/**
 * Catálogo y import de plataforma (SurveyMonkey y KoboToolbox) de la pestaña
 * Fuentes: conexiones, perfil, búsqueda, selección y los pedidos de import. El
 * job corre en `importsPlataforma`; aquí solo se arma el pedido.
 */
export function usePlataformaCarga({
  importsPlataforma,
  leerContexto,
  ocupado,
  setBusy,
  setError,
  onEstudioChanged,
  refresh,
}: {
  importsPlataforma: UseImportsDeCarga;
  leerContexto: () => ContextoImportPlataforma;
  ocupado: boolean;
  setBusy: (mensaje: string) => void;
  setError: (mensaje: string) => void;
  onEstudioChanged: (payload: EstudioPayload) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const [platformProvider, setPlatformProvider] = useState<CargaPlatformProvider>("surveymonkey");
  // "Agregar otra fuente a esta base" (F2): mientras está puesto, el import del catálogo se suma a esa base.
  const [fuenteDestino, setFuenteDestino] = useState<{ base: string; canal: string } | null>(null);
  // Antes de unir se muestra qué calza, qué trae de más y qué le falta; se une al confirmar.
  const [vistaPreviaFuente, setVistaPreviaFuente] = useState<{ surveyId: string; datos: VistaPreviaFuente } | null>(null);
  const [connections, setConnections] = useState<ConnectionTokenState[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [platformQuery, setPlatformQuery] = useState("");
  const [smSurveys, setSmSurveys] = useState<SurveyMonkeyMultibaseListItem[]>([]);
  const [koboAssets, setKoboAssets] = useState<MonitoreoKoboAssetItem[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState("");
  const [selectedAssetUid, setSelectedAssetUid] = useState("");
  const [selectedSmProfileId, setSelectedSmProfileId] = useState("");
  const [selectedKoboProfileId, setSelectedKoboProfileId] = useState("");
  const [includePartials, setIncludePartials] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [platformError, setPlatformError] = useState("");
  const [platformMessage, setPlatformMessage] = useState("");
  const [detectedKoboSource] = useState<DetectedKoboSource | null>(null);

  const smConnection = connections.find((connection) => connection.provider === "surveymonkey");
  const koboConnection = connections.find((connection) => connection.provider === "kobo");
  const smProfiles = connectedProfiles(smConnection);
  const koboProfiles = connectedProfiles(koboConnection);
  const activeSmProfile = smProfiles.find((profile) => profile.id === selectedSmProfileId) ?? smProfiles.find((profile) => profile.is_default) ?? smProfiles[0] ?? null;
  const activeKoboProfile = koboProfiles.find((profile) => profile.id === selectedKoboProfileId) ?? koboProfiles.find((profile) => profile.is_default) ?? koboProfiles[0] ?? null;

  useEffect(() => {
    let alive = true;
    setConnectionsLoading(true);
    apiConnectionsList()
      .then((result) => {
        if (!alive) return;
        setConnections(result.connections);
      })
      .catch((e) => {
        if (alive) setPlatformError((e as Error).message);
      })
      .finally(() => {
        if (alive) setConnectionsLoading(false);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selectedSmProfileId && activeSmProfile?.id) setSelectedSmProfileId(activeSmProfile.id);
    if (!selectedKoboProfileId && activeKoboProfile?.id) setSelectedKoboProfileId(activeKoboProfile.id);
  }, [activeKoboProfile?.id, activeSmProfile?.id, selectedKoboProfileId, selectedSmProfileId]);

  async function loadPlatformCatalog(forceRefresh = false) {
    setPlatformError("");
    setPlatformMessage("");
    setCatalogLoading(true);
    try {
      if (platformProvider === "surveymonkey") {
        if (!smConnection?.has_token) {
          setSmSurveys([]);
          setPlatformError("Conecta SurveyMonkey en Configuración para leer encuestas.");
          return;
        }
        const result = await apiSurveyMonkeyMultibaseListSurveys(platformQuery, 80, 36, {
          forceRefresh,
          profile_id: activeSmProfile?.id || "",
        });
        setSmSurveys(result.surveys);
        if (result.surveys.length && !result.surveys.some((survey) => survey.id === selectedSurveyId)) {
          setSelectedSurveyId(result.surveys[0].id);
        }
        setPlatformMessage(`${result.surveys.length} encuesta${result.surveys.length === 1 ? "" : "s"} disponibles.`);
      } else {
        if (!koboConnection?.has_token) {
          setKoboAssets([]);
          setPlatformError("Conecta KoboToolbox en Configuración para leer proyectos.");
          return;
        }
        const baseUrl = activeKoboProfile?.base_url || koboConnection.active_profile_base_url || "https://kf.kobotoolbox.org";
        const result = await apiCargaKoboAssets(baseUrl, 100, {
          profile_id: activeKoboProfile?.id || "",
        });
        const query = platformQuery.trim().toLowerCase();
        const assets = query
          ? result.assets.filter((asset) => `${asset.name} ${asset.uid}`.toLowerCase().includes(query))
          : result.assets;
        setKoboAssets(assets);
        if (assets.length && !assets.some((asset) => asset.uid === selectedAssetUid)) {
          setSelectedAssetUid(assets[0].uid);
        }
        setPlatformMessage(`${assets.length} proyecto${assets.length === 1 ? "" : "s"} disponibles.`);
      }
    } catch (e: unknown) {
      setPlatformError((e as Error).message);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function onPlatformImport() {
    const { estudio, esVarias, estrategia } = leerContexto();
    setError("");
    setPlatformError("");
    setPlatformMessage("");
    try {
      if (platformProvider === "surveymonkey") {
        const survey = smSurveys.find((item) => item.id === selectedSurveyId);
        if (!survey) {
          setPlatformError("Selecciona una encuesta SurveyMonkey.");
          return;
        }
        if (fuenteDestino) {
          const pedido = {
            base_name: fuenteDestino.base,
            survey_id: survey.id,
            title: survey.title,
            source_channel: fuenteDestino.canal.trim(),
            connection_profile_id: activeSmProfile?.id || "",
          };
          if (vistaPreviaFuente?.surveyId !== survey.id) {
            setBusy(`Comparando las preguntas de ${survey.title} con "${fuenteDestino.base}"`);
            setVistaPreviaFuente({ surveyId: survey.id, datos: await apiCargaVistaPreviaFuenteSm(pedido) });
            return;
          }
          setBusy(`Uniendo ${survey.title} a la base "${fuenteDestino.base}"`);
          const r = await apiCargaAgregarFuenteSm({
            base_name: fuenteDestino.base,
            survey_id: survey.id,
            title: survey.title,
            source_channel: fuenteDestino.canal.trim(),
            connection_profile_id: activeSmProfile?.id || "",
          });
          await onEstudioChanged(r.estudio);
          const extra = r.agregadas.length ? ` Se sumaron ${r.agregadas.length === 1 ? "la pregunta" : "las preguntas"} ${r.agregadas.map((a) => `"${a.etiqueta}"`).join(", ")}.` : "";
          setPlatformMessage(`"${r.base_name}" ahora une ${r.n_fuentes} fuentes: ${r.n_nuevas} respuestas nuevas, ${r.n_filas} en total.${extra}`);
          setVistaPreviaFuente(null);
          setFuenteDestino(null);
          return;
        }
        // "Bases separadas": la encuesta entra como una base NUEVA con nombre corto ("docentes"), sin tocar las demás.
        if (esVarias && estrategia === "separate") {
          const baseName = nombreLibreDeBase(nombreCortoDeEncuesta(survey.nickname || survey.title), Object.keys(estudio?.bases ?? {}));
          await importsPlataforma.lanzar("surveymonkey", "separada", {
            id: survey.id,
            titulo: survey.title,
            alias: survey.nickname || survey.title,
            perfilId: activeSmProfile?.id || "",
            baseUrl: "",
            baseNombre: baseName,
            incluirParciales: includePartials,
          });
          return;
        }
        await importsPlataforma.lanzar("surveymonkey", "unica", {
          id: survey.id,
          titulo: survey.title,
          alias: survey.nickname || survey.title,
          perfilId: activeSmProfile?.id || "",
          baseUrl: "",
          baseNombre: "",
          incluirParciales: includePartials,
        });
        return;
      } else {
        const asset = koboAssets.find((item) => item.uid === selectedAssetUid);
        if (!asset) {
          setPlatformError("Selecciona un proyecto Kobo.");
          return;
        }
        const baseUrl = activeKoboProfile?.base_url || koboConnection?.active_profile_base_url || "https://kf.kobotoolbox.org";
        if (esVarias && estrategia === "separate") {
          const baseName = nombreLibreDeBase(nombreCortoDeEncuesta(asset.name), Object.keys(estudio?.bases ?? {}));
          await importsPlataforma.lanzar("kobo", "separada", {
            id: asset.uid,
            titulo: asset.name,
            alias: null,
            perfilId: activeKoboProfile?.id || "",
            baseUrl,
            baseNombre: baseName,
            incluirParciales: false,
          });
          return;
        }
        await importsPlataforma.lanzar("kobo", "unica", {
          id: asset.uid,
          titulo: asset.name,
          alias: null,
          perfilId: activeKoboProfile?.id || "",
          baseUrl,
          baseNombre: "",
          incluirParciales: false,
        });
        return;
      }
      await refresh();
    } catch (e: unknown) {
      setPlatformError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function seedDetectedKoboAsset(source: DetectedKoboSource) {
    setPlatformProvider("kobo");
    setSelectedAssetUid(source.asset_uid);
    setPlatformQuery(source.name || source.source_title || "");
    setKoboAssets((prev) => {
      const exists = prev.some((asset) => asset.uid === source.asset_uid);
      const detectedAsset: MonitoreoKoboAssetItem = {
        uid: source.asset_uid,
        name: source.name || source.source_title || source.asset_uid,
        version_id: source.version_id || "",
        date_modified: source.date_modified || null,
        deployment_active: source.deployment_active === true,
      };
      return exists ? prev : [detectedAsset, ...prev];
    });
  }

  async function onImportDetectedKoboSource() {
    const source = detectedKoboSource;
    if (!source) return;
    setError("");
    setPlatformError("");
    setPlatformMessage("");
    seedDetectedKoboAsset(source);
    if (!koboConnection?.has_token) {
      setPlatformError("Conecta KoboToolbox en Configuración para importar la fuente detectada.");
      return;
    }
    try {
      await importsPlataforma.lanzar("kobo", "unica", {
        id: source.asset_uid,
        titulo: source.name || source.source_title || source.asset_uid,
        alias: null,
        perfilId: source.connection_profile_id || activeKoboProfile?.id || "",
        baseUrl: source.base_url || activeKoboProfile?.base_url || "https://kobo.unhcr.org",
        baseNombre: "",
        incluirParciales: false,
      });
    } catch (e: unknown) {
      setPlatformError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const plataforma: ComponentProps<typeof PlatformImportPanel> = {
    provider: platformProvider,
    onProviderChange: (provider) => {
      setPlatformProvider(provider);
      setPlatformError("");
      setPlatformMessage("");
    },
    connectionsLoading,
    smConnection,
    koboConnection,
    smProfiles,
    koboProfiles,
    selectedSmProfileId: activeSmProfile?.id || "",
    selectedKoboProfileId: activeKoboProfile?.id || "",
    onSmProfileChange: (profileId) => {
      setSelectedSmProfileId(profileId);
      setSmSurveys([]);
      setSelectedSurveyId("");
    },
    onKoboProfileChange: (profileId) => {
      setSelectedKoboProfileId(profileId);
      setKoboAssets([]);
      setSelectedAssetUid("");
    },
    query: platformQuery,
    onQueryChange: setPlatformQuery,
    catalogLoading,
    onLoadCatalog: (force) => void loadPlatformCatalog(force),
    smSurveys,
    koboAssets,
    selectedSurveyId,
    selectedAssetUid,
    onSurveySelect: setSelectedSurveyId,
    onAssetSelect: setSelectedAssetUid,
    includePartials,
    onIncludePartialsChange: setIncludePartials,
    busy: ocupado || importsPlataforma.jobEnCurso,
    error: platformError,
    message: platformMessage,
    importador: importsPlataforma.activo ? (
      <ImportadorPlataforma
        proveedor={importsPlataforma.activo.proveedor}
        estrategia={importsPlataforma.activo.estrategia}
        importacion={importsPlataforma.activo.importacion}
      />
    ) : null,
    detectedKoboSource,
    onImportDetectedKoboSource: () => void onImportDetectedKoboSource(),
    onImport: () => void onPlatformImport(),
  };

  return {
    plataforma,
    setPlatformProvider,
    setFuenteDestino,
    vistaPreviaFuente,
    setVistaPreviaFuente,
    onPlatformImport,
  };
}
