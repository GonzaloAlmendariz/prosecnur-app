export type AcreditacionQualityAlertTone = "danger" | "warning" | "info" | "ok";

export type AcreditacionPhoneAlertSignalKind =
  | "link_confusion"
  | "short_duration"
  | "platform_gap"
  | "assignment_gap"
  | "sweep_gap"
  | "contact_trace"
  | "other";

export type AcreditacionPhoneAlertSignal = {
  kind: AcreditacionPhoneAlertSignalKind;
  label: string;
  detail: string;
};

export const ACREDITACION_PHONE_ALERT_RULES: AcreditacionPhoneAlertSignal[] = [
  {
    kind: "link_confusion",
    label: "Enlace o llave",
    detail: "Casos donde el enlace, código o llave puede apuntar a otra persona o no cruza con el universo.",
  },
  {
    kind: "short_duration",
    label: "Duración corta",
    detail: "Encuestas extremadamente breves, especialmente menores a 2 o 5 minutos.",
  },
  {
    kind: "platform_gap",
    label: "Plataforma vs barrido",
    detail: "Diferencias entre efectivas, parciales o rechazos de la plataforma y lo reportado en barrido.",
  },
  {
    kind: "assignment_gap",
    label: "Asignación",
    detail: "Casos sin responsable o con trazabilidad insuficiente para validar quién debía trabajarlos.",
  },
];

export type AcreditacionQualityAlertItem = {
  id: string;
  level: string;
  tone: AcreditacionQualityAlertTone;
  signal: AcreditacionPhoneAlertSignal;
  title: string;
  source: string;
  where: string;
  detail: string;
  owner: string;
  code: string;
  type: string;
  count: number | null;
  total: number | null;
};

export type AcreditacionQualityAlertLocation = {
  where: string;
  count: number;
  tone: AcreditacionQualityAlertTone;
  percent: number;
};

export type AcreditacionPhoneSupervisionPriorityGroup = {
  key: string;
  title: string;
  count: number;
  tone: AcreditacionQualityAlertTone;
  detail: string;
};

export type AcreditacionPhoneSupervisionModel = {
  alerts: AcreditacionQualityAlertItem[];
  activeAlerts: AcreditacionQualityAlertItem[];
  activeAlertCount: number;
  highest: AcreditacionQualityAlertTone;
  locations: AcreditacionQualityAlertLocation[];
  priorityGroups: AcreditacionPhoneSupervisionPriorityGroup[];
};

export function buildAcreditacionPhoneSupervisionModel({
  alertRows,
  pendingRows,
  insistenceRows,
  reattemptRows,
}: {
  alertRows: Array<Record<string, unknown>>;
  pendingRows: Array<Record<string, unknown>>;
  insistenceRows: Array<Record<string, unknown>>;
  reattemptRows: Array<Record<string, unknown>>;
}): AcreditacionPhoneSupervisionModel {
  const alerts = buildAcreditacionQualityAlertItems(alertRows).filter(isAcreditacionTelephoneQualityAlert);
  const activeAlerts = alerts.filter((alert) => alert.tone !== "ok");
  const priorityGroups = buildAcreditacionPhoneSupervisionPriorityGroups(
    activeAlerts,
    pendingRows,
    insistenceRows,
    reattemptRows,
  );
  const hasCanonicalActiveAlerts = activeAlerts.length > 0;
  const fallbackActiveAlertCount = priorityGroups.reduce((sum, group) => sum + group.count, 0);
  const activeAlertCount = hasCanonicalActiveAlerts ? acreditacionQualityAlertItemTotal(activeAlerts) : fallbackActiveAlertCount;
  const highest = hasCanonicalActiveAlerts
    ? acreditacionQualityHighestTone(activeAlerts)
    : priorityGroups.reduce<AcreditacionQualityAlertTone>((tone, group) => acreditacionQualityStrongerTone(tone, group.tone), "ok");
  const locations = hasCanonicalActiveAlerts
    ? buildAcreditacionQualityAlertLocations(activeAlerts)
    : buildAcreditacionQualityAlertLocationsFromPriorityGroups(priorityGroups);
  return {
    alerts,
    activeAlerts,
    activeAlertCount,
    highest,
    locations,
    priorityGroups,
  };
}

export function buildAcreditacionPhoneRealAlertModel({
  alertRows,
}: {
  alertRows: Array<Record<string, unknown>>;
}): AcreditacionPhoneSupervisionModel {
  const alerts = buildAcreditacionQualityAlertItems(alertRows).filter(isAcreditacionTelephoneQualityAlert);
  const activeAlerts = alerts.filter((alert) => alert.tone !== "ok");
  return {
    alerts,
    activeAlerts,
    activeAlertCount: acreditacionQualityAlertItemTotal(activeAlerts),
    highest: activeAlerts.length ? acreditacionQualityHighestTone(activeAlerts) : "ok",
    locations: activeAlerts.length ? buildAcreditacionQualityAlertLocations(activeAlerts) : [],
    priorityGroups: buildAcreditacionPhoneAlertPriorityGroups(activeAlerts),
  };
}

export function acreditacionQualityStatusLabel(tone: AcreditacionQualityAlertTone) {
  if (tone === "danger") return "Revisión prioritaria";
  if (tone === "warning") return "Requiere seguimiento";
  if (tone === "info") return "Observaciones leves";
  return "Consistencia lista";
}

export function acreditacionQualityPriorityValue(tone: AcreditacionQualityAlertTone) {
  if (tone === "danger") return "Alta";
  if (tone === "warning") return "Media";
  if (tone === "info") return "Leve";
  return "Lista";
}

export function acreditacionQualityHeroTitle(activeAlerts: number, tone: AcreditacionQualityAlertTone) {
  if (!activeAlerts || tone === "ok") return "No hay alertas reales activas";
  return `${activeAlerts.toLocaleString("es-PE")} alerta${activeAlerts === 1 ? "" : "s"} localizada${activeAlerts === 1 ? "" : "s"}`;
}

export function acreditacionQualityHeroCopy(activeAlerts: number, locations: number) {
  if (!activeAlerts) return "El reporte canónico no trae señales reales de enlace, duración, asignación o conciliación plataforma-barrido.";
  return locations
    ? "Las alertas separan señales de enlace, duración y conciliación para decidir qué debe pasar a supervisión."
    : "Las alertas están listas para revisión de calidad.";
}

export function acreditacionQualityLevelLabel(level: string, tone: AcreditacionQualityAlertTone) {
  if (tone === "ok") return "Correcto";
  const key = normalizeAcreditacionAlertMatch(level);
  if (key.includes("alta")) return "Atención alta";
  if (key.includes("media")) return "Atención media";
  return "Seguimiento";
}

export function acreditacionQualityActionLabel(alert: AcreditacionQualityAlertItem) {
  const key = normalizeAcreditacionAlertMatch(`${alert.title} ${alert.detail} ${alert.type}`);
  if (alert.signal.kind === "link_confusion") return "Contrastar persona, enlace enviado y llave de cruce.";
  if (alert.signal.kind === "short_duration") return "Enviar a supervisión por duración atípica.";
  if (alert.signal.kind === "platform_gap") return "Conciliar plataforma contra base de barrido.";
  if (key.includes("sin responsable")) return "Asignar responsable antes de evaluar producción.";
  if (key.includes("no barrido") || key.includes("por iniciar") || key.includes("por barrer")) return "Priorizar barrido pendiente.";
  if (key.includes("efectivo telefonico") || key.includes("rechazo telefonico")) return "Verificar llamada y respuesta de plataforma.";
  if (key.includes("estado") || key.includes("estatus")) return "Revisar estado operativo.";
  if (key.includes("sin cruce con base") || key.includes("fuera del cruce")) return "Buscar candidato en base antes de confirmar.";
  if (key.includes("llave") || key.includes("codigo")) return "Corregir cruce entre base y respuestas.";
  if (alert.tone === "danger") return "Corregir antes del cierre.";
  if (alert.tone === "warning") return "Revisar en el siguiente corte.";
  return "Mantener seguimiento.";
}

function buildAcreditacionQualityAlertItems(rows: Array<Record<string, unknown>>): AcreditacionQualityAlertItem[] {
  const items = rows.map((row, index) => {
    const level = cleanAcreditacionQualityText(rowValue(row, ["nivel"]) ?? "");
    const type = cleanAcreditacionQualityText(rowValue(row, ["tipo alerta", "alerta", "tipo"]) ?? "");
    const owner = cleanAcreditacionQualityText(rowValue(row, ["responsable"]) ?? "");
    const code = cleanAcreditacionQualityText(rowValue(row, ["codpulso", "codigo", "código"]) ?? "");
    const rawDetail = cleanAcreditacionQualityText(rowValue(row, ["detalle", "detalle del tipo de alerta", "observacion"]) ?? "");
    const source = cleanAcreditacionQualityText(
      rowValue(row, ["fuente", "source", "source label", ".source_label", "origen", "canal", "collector", "recopilador"])
      ?? acreditacionQualitySourceFromDetail(rawDetail)
      ?? "",
    );
    const { count, total } = acreditacionQualityAlertCounts(row, type, rawDetail);
    const signal = acreditacionPhoneAlertSignal(type, rawDetail, owner);
    const tone = acreditacionQualityAlertTone(level, type, rawDetail);
    return {
      id: `quality-alert-${index}-${normalizeAcreditacionAlertMatch(type)}`,
      level,
      tone,
      signal,
      title: acreditacionQualityAlertTitle(type, rawDetail, owner),
      source,
      where: acreditacionQualityAlertWhere(type, owner, code, rawDetail),
      detail: acreditacionQualityAlertDetail(type, rawDetail, owner),
      owner,
      code,
      type,
      count,
      total,
    };
  });
  return groupAcreditacionQualityAlertItems(items);
}

function groupAcreditacionQualityAlertItems(items: AcreditacionQualityAlertItem[]) {
  const groups = new Map<string, AcreditacionQualityAlertItem & { _items?: AcreditacionQualityAlertItem[] }>();
  items.forEach((item) => {
    const key = acreditacionQualityAlertGroupKey(item);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...item, _items: [item] });
      return;
    }
    existing.count = (existing.count ?? 0) + (item.count ?? 1);
    existing.total = existing.total ?? item.total;
    const nextTone = acreditacionQualityStrongerTone(existing.tone, item.tone);
    if (nextTone !== existing.tone) existing.signal = item.signal;
    existing.tone = nextTone;
    existing.code = existing.code === item.code ? existing.code : "";
    existing._items?.push(item);
  });
  return Array.from(groups.values()).map(({ _items, ...item }) => {
    if (_items && _items.length > 1) {
      return {
        ...item,
        id: `${item.id}-group-${_items.length}`,
        detail: acreditacionQualityGroupedAlertDetail(item, _items.length),
      };
    }
    return item;
  });
}

function acreditacionQualityAlertGroupKey(alert: AcreditacionQualityAlertItem) {
  const key = normalizeAcreditacionAlertMatch(alert.type);
  const groupable =
    key.includes("sin cruce base")
    || key.includes("respuesta sin llave")
    || key.includes("llave faltante respuesta")
    || key.includes("parcial plataforma");
  if (groupable) return `${key}|${normalizeAcreditacionAlertMatch(alert.where)}`;
  if (key.includes("responsable no barridos")) return `${key}|${normalizeAcreditacionAlertMatch(alert.owner || alert.where)}`;
  return `${key}|${normalizeAcreditacionAlertMatch(alert.where)}|${normalizeAcreditacionAlertMatch(alert.code)}|${normalizeAcreditacionAlertMatch(alert.detail)}`;
}

function acreditacionQualityGroupedAlertDetail(alert: AcreditacionQualityAlertItem, rows: number) {
  const key = normalizeAcreditacionAlertMatch(alert.type);
  const count = alert.count ?? rows;
  if (key.includes("efectiva sin cruce base")) {
    return `${formatAlertMetric(count)} respuestas completas de ${alert.where} no cruzan con el universo base. Revisar candidatos por código, correo o nombre antes de excluirlas del avance.`;
  }
  if (key.includes("parcial sin cruce base")) {
    return `${formatAlertMetric(count)} respuestas parciales de ${alert.where} no cruzan con la base. Son pistas de contacto; no cuentan como efectivas.`;
  }
  if (key.includes("rechazo plataforma sin cruce base")) {
    return `${formatAlertMetric(count)} rechazos por filtro inicial de ${alert.where} no cruzan con la base. Deben tratarse como conciliación pendiente.`;
  }
  if (key.includes("respuesta sin llave") || key.includes("llave faltante respuesta")) {
    return `${formatAlertMetric(count)} respuestas de ${alert.where} no traen una llave utilizable. Revisar si existe código, correo o nombre suficiente para proponer cruce.`;
  }
  if (key.includes("parcial plataforma")) {
    return `${formatAlertMetric(count)} respuestas parciales deben permanecer fuera de efectivas y separadas para seguimiento.`;
  }
  return alert.detail;
}

function buildAcreditacionQualityAlertLocations(alerts: AcreditacionQualityAlertItem[]) {
  const counts = new Map<string, { where: string; count: number; tone: AcreditacionQualityAlertTone }>();
  alerts.forEach((alert) => {
    const key = normalizeAcreditacionAlertMatch(alert.where) || "estudio";
    const alertCount = alert.count ?? 1;
    const existing = counts.get(key);
    if (existing) {
      existing.count += alertCount;
      existing.tone = acreditacionQualityStrongerTone(existing.tone, alert.tone);
    } else {
      counts.set(key, { where: alert.where, count: alertCount, tone: alert.tone });
    }
  });
  const max = Math.max(1, ...Array.from(counts.values()).map((item) => item.count));
  return Array.from(counts.values())
    .map((item) => ({ ...item, percent: Math.max(8, Math.round((item.count / max) * 100)) }))
    .sort((a, b) => b.count - a.count || acreditacionQualityToneWeight(b.tone) - acreditacionQualityToneWeight(a.tone) || a.where.localeCompare(b.where, "es"));
}

function buildAcreditacionQualityAlertLocationsFromPriorityGroups(groups: AcreditacionPhoneSupervisionPriorityGroup[]) {
  const max = Math.max(1, ...groups.map((group) => group.count));
  return groups
    .map((group) => ({
      where: group.title,
      count: group.count,
      tone: group.tone,
      percent: Math.max(8, Math.round((group.count / max) * 100)),
    }))
    .sort((a, b) => b.count - a.count || acreditacionQualityToneWeight(b.tone) - acreditacionQualityToneWeight(a.tone) || a.where.localeCompare(b.where, "es"));
}

function acreditacionQualityAlertItemTotal(alerts: AcreditacionQualityAlertItem[]) {
  return alerts.reduce((sum, alert) => sum + (alert.count ?? 1), 0);
}

function acreditacionQualityHighestTone(alerts: AcreditacionQualityAlertItem[]) {
  return alerts.reduce<AcreditacionQualityAlertTone>((tone, alert) => acreditacionQualityStrongerTone(tone, alert.tone), "ok");
}

function acreditacionQualityStrongerTone(a: AcreditacionQualityAlertTone, b: AcreditacionQualityAlertTone) {
  return acreditacionQualityToneWeight(b) > acreditacionQualityToneWeight(a) ? b : a;
}

function acreditacionQualityToneWeight(tone: AcreditacionQualityAlertTone) {
  if (tone === "danger") return 3;
  if (tone === "warning") return 2;
  if (tone === "info") return 1;
  return 0;
}

function acreditacionQualityAlertTone(level: string, type: string, detail = ""): AcreditacionQualityAlertTone {
  const levelKey = normalizeAcreditacionAlertMatch(level);
  const typeKey = normalizeAcreditacionAlertMatch(type);
  const detailKey = normalizeAcreditacionAlertMatch(detail);
  if (typeKey.includes("sin alertas") || levelKey === "ok") return "ok";
  if (phoneAlertDurationMinutes(type, detail) != null) {
    const minutes = phoneAlertDurationMinutes(type, detail) ?? 0;
    if (minutes <= 2) return "danger";
    if (minutes <= 5) return "warning";
  }
  if (typeKey.includes("confusion") || typeKey.includes("enlace mal") || detailKey.includes("enlace mal")) return "danger";
  if (typeKey.includes("efectiva") && typeKey.includes("plataforma") && (typeKey.includes("barrido") || typeKey.includes("base"))) return "danger";
  if (levelKey.includes("alta") || typeKey.includes("llave")) return "danger";
  if (levelKey.includes("media") || typeKey.includes("sin responsable")) return "warning";
  return "info";
}

function acreditacionQualityAlertTitle(type: string, detail: string, owner = "") {
  const key = normalizeAcreditacionAlertMatch(type);
  const detailKey = normalizeAcreditacionAlertMatch(detail);
  const ownerKey = normalizeAcreditacionAlertMatch(owner);
  if (key.includes("sin alertas") || detailKey.includes("no muestran")) return "Sin alertas de consistencia";
  if (key.includes("confusion") && key.includes("enlace")) return "Posible confusión de enlace";
  if (key.includes("enlace mal") || detailKey.includes("enlace mal")) return "Posible enlace mal marcado";
  if (phoneAlertDurationMinutes(type, detail) != null) {
    const minutes = phoneAlertDurationMinutes(type, detail) ?? 0;
    if (minutes <= 2) return "Encuesta extremadamente corta";
    return "Encuesta muy corta";
  }
  if (key.includes("diferencia") && key.includes("efectiv")) return "Diferencia de efectivas plataforma-barrido";
  if (key.includes("efectivas plataforma") || key.includes("efectivas en plataforma")) return "Efectivas de plataforma por conciliar";
  if (key.includes("casos sin responsable")) return "Casos sin responsable";
  if (key.includes("responsable no barridos") && (ownerKey === "sin responsable" || detailKey.includes("sin responsable"))) return "Casos sin responsable por barrer";
  if (key.includes("responsable no barridos")) return "Responsable con casos por iniciar";
  if (key.includes("llave faltante barrido")) return "Registros del barrido sin código de cruce";
  if (key.includes("llave no detectada")) return "No se reconoce el código de cruce del barrido";
  if (key.includes("llave faltante respuesta")) return "Respuestas sin código de cruce";
  if (key.includes("efectiva sin cruce base")) return "Efectiva sin cruce con base";
  if (key.includes("efectivo telefonico sin plataforma")) return "Efectivo telefónico sin plataforma completa";
  if (key.includes("efectivo telefonico parcial plataforma")) return "Efectivo telefónico con plataforma parcial";
  if (key.includes("rechazo telefonico con respuesta")) return "Rechazo telefónico con respuesta de plataforma";
  if (key.includes("parcial sin cruce base")) return "Parcial sin cruce con base";
  if (key.includes("rechazo plataforma sin cruce base")) return "Rechazo sin cruce con base";
  if (key.includes("respuesta sin llave")) return "Respuesta sin llave de cruce";
  if (key.includes("parcial plataforma")) return "Respuesta parcial de plataforma";
  return "Observación de consistencia";
}

function acreditacionQualityAlertWhere(type: string, owner: string, code: string, detail = "") {
  const ownerKey = normalizeAcreditacionAlertMatch(owner);
  const typeKey = normalizeAcreditacionAlertMatch(type);
  const source = acreditacionQualitySourceFromDetail(detail);
  if (owner && ownerKey !== "sin responsable" && ownerKey !== "sin asignar") return owner;
  if (ownerKey === "sin responsable" || typeKey.includes("sin responsable")) return "Sin responsable";
  if (typeKey.includes("sin cruce base")) return source || "Cruce base ↔ plataforma";
  if (typeKey.includes("respuesta sin llave") || typeKey.includes("llave faltante respuesta")) return source || "Respuestas sin llave";
  if (typeKey.includes("parcial plataforma")) return source || "Parciales de plataforma";
  if (code) return `Código ${code}`;
  if (typeKey.includes("respuesta")) return "Respuestas SurveyMonkey";
  if (typeKey.includes("barrido") || typeKey.includes("responsable")) return "Base de barrido telefónico";
  return "Estudio";
}

function acreditacionQualityAlertDetail(type: string, detail: string, owner = "") {
  const key = normalizeAcreditacionAlertMatch(type);
  const ownerKey = normalizeAcreditacionAlertMatch(owner);
  const nums = acreditacionQualityNumbersFromText(detail);
  if (key.includes("sin alertas")) return "No hay observaciones pendientes entre barrido y respuestas.";
  if (key.includes("confusion") && key.includes("enlace")) {
    return "La trazabilidad sugiere que la persona pudo responder con un enlace que no le correspondía. Revisar código, enlace enviado y responsable antes de contarla como válida.";
  }
  if (key.includes("enlace mal") || normalizeAcreditacionAlertMatch(detail).includes("enlace mal")) {
    return "El reporte marca un posible enlace mal usado o mal asignado. Requiere contrastar la persona esperada contra la respuesta recibida.";
  }
  if (phoneAlertDurationMinutes(type, detail) != null) {
    const minutes = phoneAlertDurationMinutes(type, detail) ?? 0;
    return minutes <= 2
      ? "La duración cae por debajo de 2 minutos. Debe entrar a supervisión prioritaria antes de defender la efectiva."
      : "La duración cae por debajo de 5 minutos. Conviene revisar consistencia, saltos y trazabilidad de la respuesta.";
  }
  if (key.includes("diferencia") && key.includes("efectiv")) {
    return "Las efectivas de plataforma y las efectivas reportadas en la base de barrido no coinciden. Conciliar antes de cerrar avance.";
  }
  if (key.includes("casos sin responsable") && nums[0] != null) {
    return `${formatAlertMetric(nums[0])} caso${nums[0] === 1 ? "" : "s"} de la base telefónica no tienen responsable asignado.`;
  }
  if (key.includes("responsable no barridos") && (ownerKey === "sin responsable" || normalizeAcreditacionAlertMatch(detail).includes("sin responsable")) && nums[0] != null) {
    return `${formatAlertMetric(nums[0])} caso${nums[0] === 1 ? "" : "s"} no se pueden evaluar por responsable porque todavía están sin asignar.`;
  }
  if (key.includes("responsable no barridos") && nums[0] != null && nums[1] != null) {
    return `${formatAlertMetric(nums[0])} de ${formatAlertMetric(nums[1])} caso${nums[1] === 1 ? "" : "s"} asignados siguen por barrer.`;
  }
  if (key.includes("llave faltante barrido")) return "Hay registros del barrido que no tienen código para cruzarse con respuestas.";
  if (key.includes("llave no detectada")) return "La base de barrido no muestra una columna de código reconocible para cruzar casos.";
  if (key.includes("llave faltante respuesta") || key.includes("respuesta sin llave")) {
    return "La respuesta de plataforma no trae una llave utilizable para contrastarla con el universo. Debe revisarse antes de decidir si entra al avance.";
  }
  if (key.includes("efectiva sin cruce base")) {
    return "SurveyMonkey trae una respuesta completa, pero la llave detectada no aparece en la base. No se invalida automáticamente: requiere revisar código, correo o nombre contra el universo.";
  }
  if (key.includes("efectivo telefonico sin plataforma")) {
    return "El barrido marca el caso como efectivo, pero la plataforma no tiene una respuesta completa conciliada.";
  }
  if (key.includes("efectivo telefonico parcial plataforma")) {
    return "El barrido marca el caso como efectivo, pero SurveyMonkey conserva una respuesta parcial.";
  }
  if (key.includes("rechazo telefonico con respuesta")) {
    return "El barrido registra rechazo telefónico, pero existe una respuesta en plataforma que debe revisarse.";
  }
  if (key.includes("parcial sin cruce base")) {
    return "SurveyMonkey trae una respuesta parcial fuera del cruce con la base. Sirve como pista de contacto, pero no cuenta como efectiva.";
  }
  if (key.includes("rechazo plataforma sin cruce base")) {
    return "SurveyMonkey registra un rechazo por filtro inicial, pero sin cruce con la base. Debe quedar como alerta de conciliación, no como rechazo confirmado del universo.";
  }
  if (key.includes("parcial plataforma")) return "Respuesta parcial de plataforma; no cuenta como efectiva y debe mantenerse separada del avance final.";
  return detail || "Observación pendiente de revisión.";
}

function isAcreditacionTelephoneQualityAlert(alert: AcreditacionQualityAlertItem) {
  const typeKey = normalizeAcreditacionAlertMatch(alert.type);
  const key = normalizeAcreditacionAlertMatch(`${alert.type} ${alert.title} ${alert.detail} ${alert.where} ${alert.owner}`);
  const sourceKey = normalizeAcreditacionAlertMatch(`${alert.source} ${acreditacionQualitySourceFromDetail(alert.detail)} ${alert.where}`);
  if (isAcreditacionTelephoneText(key) || isAcreditacionTelephoneText(sourceKey)) return true;
  if (typeKey.includes("barrido") || typeKey.includes("responsable")) return true;
  if (typeKey.includes("llave faltante barrido") || typeKey.includes("llave no detectada")) return true;
  return false;
}

function isAcreditacionTelephoneText(value: unknown) {
  const key = normalizeAcreditacionAlertMatch(value);
  return Boolean(
    key.includes("telefon")
    || key.includes("phone")
    || key.includes("call")
    || key.includes("llamada")
    || /\btel\b/.test(key)
    || /\btelf\b/.test(key),
  );
}

function acreditacionPhoneAlertSignal(type: string, detail: string, owner = ""): AcreditacionPhoneAlertSignal {
  const key = normalizeAcreditacionAlertMatch(`${type} ${detail} ${owner}`);
  if (
    key.includes("confusion enlace")
    || key.includes("enlace mal")
    || key.includes("link mal")
    || key.includes("llave")
    || key.includes("codigo")
    || key.includes("codpulso")
    || key.includes("sin cruce")
  ) {
    return {
      kind: "link_confusion",
      label: "Enlace o llave",
      detail: "Revisar si la respuesta corresponde a la persona y enlace esperados.",
    };
  }
  if (phoneAlertDurationMinutes(type, detail) != null || key.includes("duracion") || key.includes("tiempo corto")) {
    return {
      kind: "short_duration",
      label: "Duración corta",
      detail: "Revisar duración, saltos y consistencia antes de defender la efectiva.",
    };
  }
  if (
    (key.includes("plataforma") && (key.includes("barrido") || key.includes("base")))
    || key.includes("efectivo telefonico sin plataforma")
    || key.includes("efectivo telefonico parcial plataforma")
    || key.includes("rechazo telefonico con respuesta")
  ) {
    return {
      kind: "platform_gap",
      label: "Plataforma vs barrido",
      detail: "Conciliar estado de plataforma contra la base de barrido.",
    };
  }
  if (key.includes("sin responsable") || key.includes("responsable")) {
    return {
      kind: "assignment_gap",
      label: "Asignación",
      detail: "Confirmar responsable antes de evaluar producción o supervisión.",
    };
  }
  if (key.includes("no barrido") || key.includes("por barrer")) {
    return {
      kind: "sweep_gap",
      label: "Barrido pendiente",
      detail: "Resolver la cobertura del barrido antes del control de calidad.",
    };
  }
  if (key.includes("no contesta") || key.includes("reintento") || key.includes("rechazo")) {
    return {
      kind: "contact_trace",
      label: "Trazabilidad de contacto",
      detail: "Contrastar llamada, resultado y evidencia de contacto.",
    };
  }
  return {
    kind: "other",
    label: "Otra alerta",
    detail: "Revisar el detalle del reporte canónico.",
  };
}

function buildAcreditacionPhoneSupervisionPriorityGroups(
  alerts: AcreditacionQualityAlertItem[],
  pendingRows: Array<Record<string, unknown>>,
  insistenceRows: Array<Record<string, unknown>>,
  reattemptRows: Array<Record<string, unknown>>,
): AcreditacionPhoneSupervisionPriorityGroup[] {
  const fromAlerts = buildAcreditacionPhoneAlertPriorityGroups(alerts);
  if (fromAlerts.length) return fromAlerts;
  return buildAcreditacionPhoneFallbackPriorityGroups(pendingRows, insistenceRows, reattemptRows);
}

function buildAcreditacionPhoneAlertPriorityGroups(alerts: AcreditacionQualityAlertItem[]) {
  const groups = new Map<string, AcreditacionPhoneSupervisionPriorityGroup>();
  alerts.forEach((alert) => {
    const title = alert.owner || alert.where || "Supervisión telefónica";
    const key = normalizeAcreditacionAlertMatch(title) || "supervision";
    const current = groups.get(key);
    const count = alert.count ?? 1;
    if (current) {
      current.count += count;
      current.tone = acreditacionQualityStrongerTone(current.tone, alert.tone);
      return;
    }
    groups.set(key, {
      key,
      title,
      count,
      tone: alert.tone,
      detail: acreditacionQualityActionLabel(alert),
    });
  });
  return Array.from(groups.values())
    .sort((a, b) => acreditacionQualityToneWeight(b.tone) - acreditacionQualityToneWeight(a.tone) || b.count - a.count || a.title.localeCompare(b.title, "es"))
    .slice(0, 8);
}

function buildAcreditacionPhoneFallbackPriorityGroups(
  pendingRows: Array<Record<string, unknown>>,
  insistenceRows: Array<Record<string, unknown>>,
  reattemptRows: Array<Record<string, unknown>>,
) {
  const groups = new Map<string, AcreditacionPhoneSupervisionPriorityGroup>();
  const add = (keySource: string, title: string, count: number, tone: AcreditacionQualityAlertTone, detail: string) => {
    if (count <= 0) return;
    const key = normalizeAcreditacionAlertMatch(keySource || title) || `priority-${groups.size}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += count;
      existing.tone = acreditacionQualityStrongerTone(existing.tone, tone);
      return;
    }
    groups.set(key, { key, title, count, tone, detail });
  };

  pendingRows.forEach((row, index) => {
    const name = phoneAlertResponsibleName(row, index);
    if (phoneAlertIsUnassignedResponsible(name)) return;
    add(name, name, rowNumber(row, ["No barridos", "Por barrer"], 0), "warning", "Priorizar barrido pendiente.");
  });

  insistenceRows.forEach((row, index) => {
    const name = phoneAlertResponsibleName(row, index);
    if (phoneAlertIsUnassignedResponsible(name)) return;
    add(name, name, rowNumber(row, ["Casos no contesta"], 0), "info", "Revisar insistencia y próximos reintentos.");
  });

  reattemptRows.forEach((row, index) => {
    const name = phoneAlertResponsibleName(row, index);
    if (phoneAlertIsUnassignedResponsible(name)) return;
    add(name, name, rowNumber(row, ["Reintentos bajos"], 0), "warning", "Subir la fuerza de contacto antes del cierre.");
  });

  return Array.from(groups.values())
    .sort((a, b) => acreditacionQualityToneWeight(b.tone) - acreditacionQualityToneWeight(a.tone) || b.count - a.count || a.title.localeCompare(b.title, "es"))
    .slice(0, 8);
}

function acreditacionQualityAlertCounts(row: Record<string, unknown>, type: string, detail: string) {
  const explicit = optionalRowNumber(row, ["casos", "caso", "alertas", "conteo", "count", "n"]);
  if (explicit != null) return { count: explicit, total: null };
  const key = normalizeAcreditacionAlertMatch(type);
  const nums = acreditacionQualityNumbersFromText(detail);
  if (key.includes("casos sin responsable") && nums[0] != null) return { count: nums[0], total: null };
  if (key.includes("responsable no barridos") && nums[0] != null) return { count: nums[0], total: nums[1] ?? null };
  return { count: 1, total: null };
}

function rowValue(row: Record<string, unknown>, candidates: string[]) {
  const entry = Object.entries(row).find(([key]) => {
    const normalized = normalizeAcreditacionAlertMatch(key);
    return candidates.some((candidate) => normalized === normalizeAcreditacionAlertMatch(candidate));
  });
  return entry?.[1] ?? null;
}

function rowNumber(row: Record<string, unknown>, candidates: string[], fallback = 0) {
  return optionalRowNumber(row, candidates) ?? fallback;
}

function optionalRowNumber(row: Record<string, unknown>, candidates: string[]) {
  const value = rowValue(row, candidates);
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(/%/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function phoneAlertResponsibleName(row: Record<string, unknown>, index: number) {
  const name = cleanAcreditacionQualityText(rowValue(row, ["Responsable", "Encuestador", "Operador", "Agente"]) ?? "");
  return name || `Responsable ${index + 1}`;
}

function phoneAlertIsUnassignedResponsible(name: string) {
  const key = normalizeAcreditacionAlertMatch(name);
  return !key || key === "sin responsable" || key === "sin asignar" || key.includes("sin responsable");
}

function phoneAlertDurationMinutes(type: string, detail: string) {
  const key = normalizeAcreditacionAlertMatch(`${type} ${detail}`);
  if (!key.includes("duracion") && !key.includes("tiempo") && !key.includes("minuto") && !key.includes("min")) return null;
  const explicit = key.match(/(?:menor(?:es)?\s*a|menos\s*de|<)\s*(\d+(?:[.,]\d+)?)\s*(?:min|minuto|minutos)?/);
  if (explicit) {
    const parsed = Number(explicit[1].replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  const nums = acreditacionQualityNumbersFromText(`${type} ${detail}`);
  const candidate = nums.find((num) => num > 0 && num <= 60);
  return candidate ?? null;
}

function acreditacionQualitySourceFromDetail(detail: string) {
  const match = detail.match(/Fuente:\s*([^.]*)/i);
  return match ? cleanAcreditacionQualityText(match[1]) : "";
}

function acreditacionQualityNumbersFromText(value: string) {
  return Array.from(value.matchAll(/\d+(?:[.,]\d+)?/g))
    .map((match) => Number(match[0].replace(",", ".")))
    .filter((num) => Number.isFinite(num));
}

function cleanAcreditacionQualityText(value: unknown) {
  return String(value ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeAcreditacionAlertMatch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatAlertMetric(value: number) {
  return value.toLocaleString("es-PE", { maximumFractionDigits: 0 });
}
