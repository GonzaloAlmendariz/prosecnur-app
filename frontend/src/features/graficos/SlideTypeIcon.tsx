// Envoltorio heredado (F6.1b): delega en el sistema de íconos por tipo (`iconos/IconoTipo`). Se borra en F6.5,
// cuando el editor v2 deje de usarlo. Sólo un tipo que no está en el registro cae en el ícono lucide de su
// `icono_ui`; los tipos del registro nunca.
import type { SlideType } from "../../api/client";
import { SvgIconoTipo, tieneIcono } from "./iconos/IconoTipo";
import { resolveGraphLucideIcon } from "./lucideRegistry";

type IconProps = {
  tipo?: SlideType | string;
  iconoUi?: string;
  size?: number;
  className?: string;
};

export function SlideTypeIcon({ tipo, iconoUi, size = 16, className }: IconProps) {
  const id = tipo ?? "";
  if (tieneIcono("lamina", id)) {
    return <SvgIconoTipo clase="lamina" tipo={id} px={size} className={className} />;
  }
  const Icon = resolveGraphLucideIcon(iconoUi, "FileText");
  return <Icon size={size} className={className} aria-hidden={true} focusable="false" />;
}
