import type { MonitoreoMailchimpRitmo } from "../../../../api/monitoreoMailchimp";
import { Popover } from "../../../../components/Popover";
import { RITMO } from "./avanceCorreoModelo";

// Chip del ritmo sugerido para los recordatorios. Es un botón: al apuntarlo o
// enfocarlo con el teclado abre el motivo completo que publica el backend.

export function AvanceCorreoRitmo({
  ritmo,
  motivo,
  publico,
}: {
  ritmo: MonitoreoMailchimpRitmo;
  motivo: string;
  publico: string;
}) {
  const r = RITMO[ritmo];
  const chip = (
    <button type="button" className={`mon-correo-ritmo is-${r.tono}`} aria-label={`Ritmo de ${publico}: ${r.etiqueta}`}>
      {r.etiqueta}
    </button>
  );
  if (!motivo) return <span className={`mon-correo-ritmo is-${r.tono}`}>{r.etiqueta}</span>;
  return (
    <Popover trigger={chip} openOn="hover" side="bottom" align="start" maxWidth={340} ariaLabel={`Motivo del ritmo de ${publico}`}>
      <div className="mon-correo-ritmo-motivo">
        <span className={`mon-correo-ritmo is-${r.tono}`}>{r.etiqueta}</span>
        <p>{motivo}</p>
      </div>
    </Popover>
  );
}
