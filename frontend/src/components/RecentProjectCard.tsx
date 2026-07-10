// =============================================================================
// RecentProjectCard — card horizontal de proyecto reciente (compartida)
// =============================================================================
// La usa BootGate (chooser de arranque).
//
// RESTRICCIÓN CRÍTICA DE BUNDLE: BootGate vive en el chunk de ENTRADA
// (main.tsx) y se ejecuta ANTES de cargar la suite. Este componente solo
// puede importar React, el shim de iconos ("lucide-react" resuelve a
// src/vendor/lucide-react.ts) y su propio CSS. Nada de stores, api,
// features ni utilidades pesadas — todo helper vive aquí adentro.

import { Folder, Loader2, X } from "lucide-react";
import "./recent-project-card.css";

type RecentProjectCardProps = {
  name: string;
  path: string;
  openedAt?: string | null;
  busy?: boolean;
  onOpen: () => void;
  onRemove?: () => void;
};

const RELATIVE_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** Fecha relativa corta en español: "hace 2 h", "ayer", "hace 3 días", "12 mar". */
export function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const time = date.getTime();
  if (Number.isNaN(time)) return "";
  const now = new Date();
  const diffMs = now.getTime() - time;
  if (diffMs < 0) return "hace un momento";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && date.getDate() === now.getDate()) return `hace ${hours} h`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayDiff = Math.ceil((startOfToday - time) / 86400000);
  if (dayDiff <= 0) return `hace ${Math.max(1, hours)} h`;
  if (dayDiff === 1) return "ayer";
  if (dayDiff < 7) return `hace ${dayDiff} días`;
  const month = RELATIVE_MONTHS[date.getMonth()] ?? "";
  const yearSuffix = date.getFullYear() === now.getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${month}${yearSuffix}`;
}

export default function RecentProjectCard({
  name,
  path,
  openedAt,
  busy,
  onOpen,
  onRemove,
}: RecentProjectCardProps) {
  const dateLabel = formatRelativeDate(openedAt);
  return (
    <div className={`rpc-card ${busy ? "is-busy" : ""}`}>
      <button
        type="button"
        className="rpc-open"
        onClick={onOpen}
        disabled={busy}
        title={path}
        aria-label={`Abrir ${name}`}
      >
        <span className="rpc-icon" aria-hidden="true">
          {busy ? <Loader2 size={17} className="rpc-spinner" /> : <Folder size={17} />}
        </span>
        <span className="rpc-body">
          <strong className="rpc-name">{name}</strong>
          <span className="rpc-path" dir="rtl">{path}</span>
          {dateLabel ? <span className="rpc-date">{dateLabel}</span> : null}
        </span>
      </button>
      {onRemove ? (
        <button
          type="button"
          className="rpc-remove"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Quitar ${name} de recientes`}
          title="Quitar de recientes"
        >
          <X size={13} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
