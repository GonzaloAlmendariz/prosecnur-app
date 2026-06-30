import type { MonitoreoGoal } from "../../../../api/client";

export function normalizeAcreditacionGoalMatch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function goalMatchesActor(goal: MonitoreoGoal, actor: string) {
  const actorKey = normalizeAcreditacionGoalMatch(actor);
  return Object.values(goal.filters ?? {}).some((value) => normalizeAcreditacionGoalMatch(value) === actorKey);
}

export function upsertAcreditacionActorGoal({
  goals,
  actor,
  meta,
  metaPct,
  goalKey,
}: {
  goals: MonitoreoGoal[];
  actor: string;
  meta: number;
  metaPct?: number | null;
  goalKey: string;
}): MonitoreoGoal[] {
  const cleanActor = String(actor ?? "").trim();
  const cleanGoalKey = String(goalKey || "dim_actor").trim() || "dim_actor";
  if (!cleanActor) return goals;

  const cleanMeta = Math.max(0, Math.round(Number(meta) || 0));
  const cleanMetaPct = Number(metaPct);
  const nextGoal: MonitoreoGoal = {
    filters: { [cleanGoalKey]: cleanActor },
    meta: cleanMeta,
    ...(Number.isFinite(cleanMetaPct) && cleanMetaPct >= 0 ? { meta_pct: cleanMetaPct } : {}),
  };

  let replaced = false;
  const next = goals.reduce<MonitoreoGoal[]>((acc, goal) => {
    if (!goalMatchesActor(goal, cleanActor)) {
      acc.push(goal);
      return acc;
    }
    if (!replaced) {
      acc.push(nextGoal);
      replaced = true;
    }
    return acc;
  }, []);

  return replaced ? next : [...next, nextGoal];
}
