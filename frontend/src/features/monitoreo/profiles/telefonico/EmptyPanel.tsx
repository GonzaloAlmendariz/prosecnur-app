import { ClipboardCheck } from "lucide-react";

// Estado vacío canónico del perfil, extraído del page-file congelado
// (TelefonicoMonitoreoPage.tsx). Copia por perfil deliberada (ver formato.ts).

export function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mon-profile-empty">
      <span className="mon-profile-empty__icon"><ClipboardCheck size={18} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
