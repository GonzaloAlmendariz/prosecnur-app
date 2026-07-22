import type {
  EstudioProcessingSuggestionGroup,
  XlsformFormSource,
} from "../../../api/client";

export type InstrumentActorOption = {
  actor_key: string;
  actor: string;
};

export function instrumentActorOptions(
  groups: EstudioProcessingSuggestionGroup[],
): InstrumentActorOption[] {
  const options = new Map<string, InstrumentActorOption>();
  for (const group of groups) {
    const actorKey = group.actor_key.trim();
    if (!actorKey || options.has(actorKey)) continue;
    options.set(actorKey, { actor_key: actorKey, actor: group.actor || actorKey });
  }
  return Array.from(options.values());
}

export function formSourceWithActorKey(
  source: XlsformFormSource | null,
  actorKey: string,
): XlsformFormSource {
  return {
    ...(source ?? { kind: null, original_name: null }),
    actor_key: actorKey.trim() || null,
  };
}
