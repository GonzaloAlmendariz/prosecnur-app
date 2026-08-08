import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  apiGraficosSlideLayoutMatrix,
  type GraficosSlideLayoutMatrix,
  type GraficosSlideLayoutMatrixOptions,
  type SlideMetadata,
} from "../../api/client";
import { getSession } from "../../api/core";
import { useOptionalSession } from "../../lib/SessionContext";
import {
  resolveSlideCompositionMap,
  type SlideCompositionMap,
} from "./slideCompositionModel";
import {
  clearSlideCompositionPersistenceAcks,
  getSlideCompositionPersistenceAck,
  getSlideCompositionPersistenceAckToken,
  hasExactSlideCompositionPersistenceAck,
  invalidateSlideCompositionPersistenceAck,
  subscribeSlideCompositionPersistenceAck,
} from "./slideCompositionPersistence";

export {
  acknowledgeSlideCompositionConfig,
  acknowledgeSlideCompositionRevision,
  getSlideCompositionPersistenceAck,
  getSlideCompositionPersistenceAckToken,
  hasExactSlideCompositionPersistenceAck,
  invalidateSlideCompositionPersistenceAck,
  persistWithSlideCompositionAck,
  slideCompositionRevision,
  slideCompositionRevisionFromConfig,
} from "./slideCompositionPersistence";
export type { SlideCompositionRevisionInput } from "./slideCompositionPersistence";

const PUBLIC_MATRIX_ERROR =
  "No pudimos consultar la composición efectiva; se conserva la referencia nominal.";

export type SlideCompositionIdentity = GraficosSlideLayoutMatrixOptions;

export type SlideCompositionsSnapshot = {
  requestKey: string;
  matrix: GraficosSlideLayoutMatrix | null;
  loading: boolean;
  error: string;
};

export type SlideCompositionsState = {
  matrix: GraficosSlideLayoutMatrix | null;
  compositions: SlideCompositionMap;
  loading: boolean;
  error: string;
  fingerprint: string | null;
};

export type SlideLayoutMatrixLoader = (
  options: GraficosSlideLayoutMatrixOptions,
) => Promise<GraficosSlideLayoutMatrix>;

const matricesByFingerprint = new Map<string, GraficosSlideLayoutMatrix>();
const latestFingerprintByRequest = new Map<string, string>();
const pendingByRequest = new Map<string, Promise<GraficosSlideLayoutMatrix>>();

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalScope(value: unknown): "active" | "consolidated" | undefined {
  return value === "active" || value === "consolidated" ? value : undefined;
}

export function slideCompositionIdentityFromScopeRules(
  scopeRules: unknown,
): SlideCompositionIdentity {
  const global = record(record(scopeRules).global);
  return {
    profile_id: optionalString(global.profile_id) ?? optionalString(global.profileId),
    template_id: optionalString(global.template_id) ?? optionalString(global.templateId),
  };
}

export function slideCompositionMatrixIdentityIssue(
  matrix: GraficosSlideLayoutMatrix,
  options: SlideCompositionIdentity,
): string | null {
  const responseId = matrix.template?.id;
  if (typeof responseId !== "string" || !responseId.trim()) {
    return "La matriz no declara una identidad de plantilla válida.";
  }
  const templateId = optionalString(options.template_id);
  const profileId = optionalString(options.profile_id);
  if (templateId) {
    if (responseId !== templateId || matrix.template.identity_source !== "template_id") {
      return "La matriz contradice la identidad de plantilla solicitada.";
    }
    return null;
  }
  if (profileId && matrix.template.identity_source !== "profile_id") {
    return "La matriz contradice la identidad de perfil solicitada.";
  }
  return null;
}

export function slideCompositionRequestKey(
  sid: string | null,
  options: SlideCompositionIdentity,
  cacheRevision = "",
  persistenceToken = "",
): string {
  return JSON.stringify([
    sid ?? "",
    optionalString(options.profile_id) ?? "",
    optionalString(options.template_id) ?? "",
    optionalScope(options.scope) ?? "",
    cacheRevision,
    persistenceToken,
  ]);
}

export function slideCompositionMatrixCacheKey(
  sid: string | null,
  options: SlideCompositionIdentity,
  fingerprint: string,
  cacheRevision = "",
  persistenceToken = "",
): string {
  return JSON.stringify([
    sid ?? "",
    optionalString(options.profile_id) ?? "",
    optionalString(options.template_id) ?? "",
    optionalScope(options.scope) ?? "",
    cacheRevision,
    persistenceToken,
    fingerprint,
  ]);
}

function cachedMatrix(
  sid: string | null,
  options: SlideCompositionIdentity,
  cacheRevision: string,
  persistenceToken: string,
): GraficosSlideLayoutMatrix | null {
  const requestKey = slideCompositionRequestKey(
    sid,
    options,
    cacheRevision,
    persistenceToken,
  );
  const fingerprint = latestFingerprintByRequest.get(requestKey);
  if (!fingerprint) return null;
  return matricesByFingerprint.get(
    slideCompositionMatrixCacheKey(
      sid,
      options,
      fingerprint,
      cacheRevision,
      persistenceToken,
    ),
  ) ?? null;
}

function normalizedOptions(
  options: SlideCompositionIdentity,
): GraficosSlideLayoutMatrixOptions {
  return {
    ...(optionalString(options.profile_id)
      ? { profile_id: optionalString(options.profile_id) }
      : {}),
    ...(optionalString(options.template_id)
      ? { template_id: optionalString(options.template_id) }
      : {}),
    ...(optionalScope(options.scope) ? { scope: optionalScope(options.scope) } : {}),
  };
}

export function requestSlideCompositionMatrix(
  sid: string | null,
  options: SlideCompositionIdentity,
  cacheRevision = "",
  load: SlideLayoutMatrixLoader = apiGraficosSlideLayoutMatrix,
  expectedPersistenceToken?: string,
): Promise<GraficosSlideLayoutMatrix> {
  const scope = optionalScope(options.scope) ?? "active";
  const persistenceToken = getSlideCompositionPersistenceAckToken(sid, scope);
  if (
    !hasExactSlideCompositionPersistenceAck(sid, scope, cacheRevision)
    || !persistenceToken
    || (expectedPersistenceToken !== undefined
      && persistenceToken !== expectedPersistenceToken)
  ) {
    return Promise.reject(new Error("La revisión de composición aún no fue persistida."));
  }
  const cached = cachedMatrix(sid, options, cacheRevision, persistenceToken);
  if (cached) return Promise.resolve(cached);

  const requestKey = slideCompositionRequestKey(
    sid,
    options,
    cacheRevision,
    persistenceToken,
  );
  const existing = pendingByRequest.get(requestKey);
  if (existing) return existing;

  const request = load(normalizedOptions(options)).then((matrix) => {
    if (
      !hasExactSlideCompositionPersistenceAck(sid, scope, cacheRevision)
      || getSlideCompositionPersistenceAckToken(sid, scope) !== persistenceToken
    ) {
      throw new Error("La revisión persistida cambió durante la carga de composición.");
    }
    const identityIssue = slideCompositionMatrixIdentityIssue(matrix, options);
    if (identityIssue) throw new Error(identityIssue);
    const fingerprint = optionalString(matrix.template?.fingerprint);
    if (fingerprint) {
      const cacheKey = slideCompositionMatrixCacheKey(
        sid,
        options,
        fingerprint,
        cacheRevision,
        persistenceToken,
      );
      matricesByFingerprint.set(cacheKey, matrix);
      latestFingerprintByRequest.set(requestKey, fingerprint);
    }
    return matrix;
  });
  pendingByRequest.set(requestKey, request);
  const release = () => {
    if (pendingByRequest.get(requestKey) === request) {
      pendingByRequest.delete(requestKey);
    }
  };
  request.then(release, release);
  return request;
}

export function visibleSlideCompositionsSnapshot(
  requestKey: string,
  snapshot: SlideCompositionsSnapshot,
): SlideCompositionsSnapshot {
  if (snapshot.requestKey === requestKey) return snapshot;
  return { requestKey, matrix: null, loading: true, error: "" };
}

export function publicSlideCompositionError(_cause: unknown): string {
  return PUBLIC_MATRIX_ERROR;
}

export function clearSlideCompositionCache(): void {
  matricesByFingerprint.clear();
  latestFingerprintByRequest.clear();
  pendingByRequest.clear();
  clearSlideCompositionPersistenceAcks();
}

export function useSlideCompositions(
  metadata: readonly SlideMetadata[],
  identity: SlideCompositionIdentity = {},
  cacheRevision = "",
): SlideCompositionsState {
  const optionalSession = useOptionalSession();
  const sid = optionalSession ? optionalSession.sessionId || null : getSession();
  const profileId = optionalString(identity.profile_id);
  const templateId = optionalString(identity.template_id);
  const scope = optionalScope(identity.scope) ?? "active";
  const requestIdentity = useMemo<SlideCompositionIdentity>(() => ({
    profile_id: profileId,
    template_id: templateId,
    scope,
  }), [profileId, scope, templateId]);
  const persistenceAckToken = useSyncExternalStore(
    subscribeSlideCompositionPersistenceAck,
    () => getSlideCompositionPersistenceAckToken(sid, scope),
    () => null,
  );
  const persistenceAck = getSlideCompositionPersistenceAck(sid, scope);
  const persistenceAcknowledged = cacheRevision.length > 0
    && persistenceAck === cacheRevision;
  const requestKey = slideCompositionRequestKey(
    sid,
    requestIdentity,
    cacheRevision,
    persistenceAckToken ?? "",
  );
  const [snapshot, setSnapshot] = useState<SlideCompositionsSnapshot>(() => {
    const matrix = persistenceAcknowledged
      ? cachedMatrix(
        sid,
        requestIdentity,
        cacheRevision,
        persistenceAckToken ?? "",
      )
      : null;
    return {
      requestKey,
      matrix,
      loading: matrix === null,
      error: "",
    };
  });
  const visibleSnapshot = persistenceAcknowledged
    ? visibleSlideCompositionsSnapshot(requestKey, snapshot)
    : { requestKey, matrix: null, loading: true, error: "" };

  useEffect(() => {
    let alive = true;
    if (!persistenceAcknowledged) {
      if (persistenceAck !== null) {
        invalidateSlideCompositionPersistenceAck(sid, scope);
      }
      setSnapshot({ requestKey, matrix: null, loading: true, error: "" });
      return () => { alive = false; };
    }
    const matrix = cachedMatrix(
      sid,
      requestIdentity,
      cacheRevision,
      persistenceAckToken ?? "",
    );
    if (matrix) {
      setSnapshot({ requestKey, matrix, loading: false, error: "" });
      return () => { alive = false; };
    }
    setSnapshot({ requestKey, matrix: null, loading: true, error: "" });
    requestSlideCompositionMatrix(
      sid,
      requestIdentity,
      cacheRevision,
      apiGraficosSlideLayoutMatrix,
      persistenceAckToken ?? undefined,
    )
      .then((nextMatrix) => {
        if (!alive) return;
        setSnapshot({ requestKey, matrix: nextMatrix, loading: false, error: "" });
      })
      .catch((cause: unknown) => {
        if (!alive) return;
        setSnapshot({
          requestKey,
          matrix: null,
          loading: false,
          error: publicSlideCompositionError(cause),
        });
      });
    return () => {
      alive = false;
    };
  }, [
    cacheRevision,
    persistenceAck,
    persistenceAckToken,
    persistenceAcknowledged,
    requestIdentity,
    requestKey,
    scope,
    sid,
  ]);

  const compositions = useMemo(
    () => resolveSlideCompositionMap(metadata, visibleSnapshot.matrix),
    [metadata, visibleSnapshot.matrix],
  );

  return {
    matrix: visibleSnapshot.matrix,
    compositions,
    loading: visibleSnapshot.loading,
    error: visibleSnapshot.error,
    fingerprint: visibleSnapshot.matrix?.template.fingerprint ?? null,
  };
}
