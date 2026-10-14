// Disparador de los paneles de Carga › Fuentes: escribe `panel` y `foco` en la
// dirección (el panel se abre porque la URL lo pide). Fuera de un router
// (renders estáticos) no hay dirección que escribir y no se pinta.

import type { ReactNode } from "react";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";
import { PulsoButton, type PulsoButtonVariant } from "../../../components/PulsoButton";

type Props = {
  /** Recibe el `search` actual y devuelve el que abre el panel. */
  destino: (search: string) => string;
  /** Clave a la que el panel devuelve el foco al cerrar. */
  clave: string;
  variant: Exclude<PulsoButtonVariant, "icon">;
  className?: string;
  children: ReactNode;
  etiqueta?: string;
};

function ConDireccion({ destino, clave, variant, className, children, etiqueta }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <PulsoButton
      variant={variant}
      size="sm"
      className={className}
      aria-haspopup="dialog"
      aria-label={etiqueta}
      data-plf-abrir={clave}
      onClick={() => navigate({ pathname: location.pathname, search: destino(location.search) }, { replace: true })}
    >
      {children}
    </PulsoButton>
  );
}

export function AbrirPanelFuentes(props: Props) {
  return useInRouterContext() ? <ConDireccion {...props} /> : null;
}
