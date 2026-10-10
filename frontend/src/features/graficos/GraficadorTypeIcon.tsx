// Envoltorio heredado (F6.1b): delega en el sistema de íconos por tipo (`iconos/IconoTipo`). Se borra en F6.5,
// cuando el editor v2 deje de usarlo. Un tipo del registro nunca cae en lucide: los retirados del selector (FODA)
// muestran el marco con ranura punteada. Sólo un graficador que no está en el registro usa el lucide de `icono_ui`.
import { SvgIconoTipo, tieneIcono } from "./iconos/IconoTipo";
import { GRAFICOS_RETIRADOS } from "./iconos/iconosGrafico";
import { resolveGraphLucideIcon } from "./lucideRegistry";

type IconProps = {
  name?: string;
  iconoUi?: string;
  size?: number;
  className?: string;
};

export function GraficadorTypeIcon({ name, iconoUi, size = 16, className }: IconProps) {
  const id = name ?? "";
  if (tieneIcono("grafico", id) || GRAFICOS_RETIRADOS.has(id)) {
    return <SvgIconoTipo clase="grafico" tipo={id} px={size} className={className} />;
  }
  const Icon = resolveGraphLucideIcon(iconoUi, "BarChart");
  return <Icon size={size} className={className} aria-hidden={true} focusable="false" />;
}
