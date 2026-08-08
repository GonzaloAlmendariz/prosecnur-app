import type { GraficosReportScope } from "./reportScope";

export type SlideCompositionRevisionInput = {
  presets: unknown;
  debugPh: unknown;
  scopeRules: unknown;
};

type PersistWithAckOptions<T> = {
  sid: string | null;
  scope: GraficosReportScope;
  config: unknown;
  persist: () => Promise<T>;
};

const ackBySessionScope = new Map<string, { revision: string; generation: number }>();
const listeners = new Set<() => void>();
let nextGeneration = 0;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  const valueRecord = record(value);
  if (valueRecord !== value) return value ?? null;
  return Object.fromEntries(
    Object.keys(valueRecord)
      .sort()
      .map((key) => [key, canonicalValue(valueRecord[key])]),
  );
}

function compositionScopeRules(value: unknown): Record<string, unknown> {
  const rules = record(value);
  const normalized = { ...rules };
  const global = { ...record(rules.global) };
  for (const mirror of [
    "presets",
    "debug_ph",
    "debugPh",
    "paletas",
    "overrides_reusables",
    "overridesReusables",
  ]) {
    delete global[mirror];
  }
  if (Object.keys(global).length > 0) normalized.global = global;
  else delete normalized.global;
  return normalized;
}

function configRecord(value: unknown): Record<string, unknown> {
  const envelope = record(value);
  return envelope.config && typeof envelope.config === "object" && !Array.isArray(envelope.config)
    ? envelope.config as Record<string, unknown>
    : envelope;
}

function canonicalField(
  source: Record<string, unknown>,
  canonical: string,
  alias: string,
): unknown {
  return source[canonical] !== undefined ? source[canonical] : source[alias];
}

function ackKey(sid: string | null, scope: GraficosReportScope): string {
  return JSON.stringify([sid ?? "", scope]);
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function slideCompositionRevision(
  input: SlideCompositionRevisionInput,
): string {
  return JSON.stringify(canonicalValue({
    presets: input.presets,
    debugPh: input.debugPh,
    scopeRules: compositionScopeRules(input.scopeRules),
  }));
}

export function slideCompositionRevisionFromConfig(config: unknown): string {
  const source = configRecord(config);
  return slideCompositionRevision({
    presets: source.presets ?? {},
    debugPh: canonicalField(source, "debug_ph", "debugPh") ?? {},
    scopeRules: canonicalField(source, "scope_rules", "scopeRules") ?? {},
  });
}

export function getSlideCompositionPersistenceAck(
  sid: string | null,
  scope: GraficosReportScope,
): string | null {
  return ackBySessionScope.get(ackKey(sid, scope))?.revision ?? null;
}

export function getSlideCompositionPersistenceAckToken(
  sid: string | null,
  scope: GraficosReportScope,
): string | null {
  const ack = ackBySessionScope.get(ackKey(sid, scope));
  return ack ? `${ack.generation}:${ack.revision}` : null;
}

export function hasExactSlideCompositionPersistenceAck(
  sid: string | null,
  scope: GraficosReportScope,
  revision: string,
): boolean {
  return revision.length > 0
    && getSlideCompositionPersistenceAck(sid, scope) === revision;
}

export function acknowledgeSlideCompositionRevision(
  sid: string | null,
  scope: GraficosReportScope,
  revision: string,
): void {
  if (!revision || getSlideCompositionPersistenceAck(sid, scope) === revision) return;
  nextGeneration += 1;
  ackBySessionScope.set(ackKey(sid, scope), { revision, generation: nextGeneration });
  emit();
}

export function acknowledgeSlideCompositionConfig(
  sid: string | null,
  scope: GraficosReportScope,
  config: unknown,
): string {
  const revision = slideCompositionRevisionFromConfig(config);
  acknowledgeSlideCompositionRevision(sid, scope, revision);
  return revision;
}

export function invalidateSlideCompositionPersistenceAck(
  sid: string | null,
  scope: GraficosReportScope,
): void {
  if (!ackBySessionScope.delete(ackKey(sid, scope))) return;
  emit();
}

export function subscribeSlideCompositionPersistenceAck(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function persistWithSlideCompositionAck<T>({
  sid,
  scope,
  config,
  persist,
}: PersistWithAckOptions<T>): Promise<T> {
  const revision = slideCompositionRevisionFromConfig(config);
  const result = await persist();
  acknowledgeSlideCompositionRevision(sid, scope, revision);
  return result;
}

export function clearSlideCompositionPersistenceAcks(): void {
  const hadAcks = ackBySessionScope.size > 0;
  ackBySessionScope.clear();
  nextGeneration = 0;
  if (hadAcks) emit();
}
