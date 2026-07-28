type MonitoreoRailLastUpdateProps = {
  value: string;
  label?: string;
  ariaLabel?: string;
  className?: string;
};

type CompactLastUpdate = {
  date: string;
  time: string;
  fullValue: string;
};

function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function compactLastUpdate(value: string): CompactLastUpdate {
  const normalized = value.trim();
  const normalizedLabel = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!normalized || normalizedLabel.startsWith("sin actualizacion")) {
    return {
      date: "Sin act.",
      time: "",
      fullValue: "Sin actualización",
    };
  }
  const localizedDate = normalized.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/)?.[0] ?? "";
  const localizedTime = normalized.match(/\b\d{1,2}:\d{2}\b/)?.[0] ?? "";

  if (localizedDate) {
    return {
      date: localizedDate,
      time: localizedTime,
      fullValue: normalized,
    };
  }

  const parsed = normalized ? new Date(normalized) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    const parts = new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(parsed);
    const date = [datePart(parts, "day"), datePart(parts, "month"), datePart(parts, "year")].join("/");
    const time = `${datePart(parts, "hour")}:${datePart(parts, "minute")}`;
    return { date, time, fullValue: `${date}, ${time}` };
  }

  return {
    date: "Sin hora",
    time: "",
    fullValue: normalized || "Sin actualización",
  };
}

export function MonitoreoRailLastUpdate({
  value,
  label = "Última actualización",
  ariaLabel = "Estado del monitoreo",
  className,
}: MonitoreoRailLastUpdateProps) {
  const compact = compactLastUpdate(value);

  return (
    <div className="pulso-context-tab-rail-meta" aria-label={ariaLabel}>
      <span
        className={className}
        title={`${label}: ${compact.fullValue}`}
        data-monitoring-last-update=""
      >
        <span>{label}</span>
        <strong>
          <span className="mon-rail-sync-date">{compact.date}</span>
          {compact.time ? <span className="mon-rail-sync-time">{compact.time}</span> : null}
        </strong>
      </span>
    </div>
  );
}
