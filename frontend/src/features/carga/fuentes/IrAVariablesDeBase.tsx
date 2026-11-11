// Botón "Variables" de la tarjeta de una base: lleva a la pestaña Variables
// con esa base elegida (ADR 0142). Fuera de un router (renders estáticos) no
// hay dirección a la que ir y no se pinta.

import type { ReactNode } from "react";
import { useInRouterContext, useNavigate } from "react-router-dom";
import { PulsoButton } from "../../../components/PulsoButton";
import { hrefVariablesBase } from "../direccionesDeCarga";

function ConDireccion({ base, etiqueta, children }: { base: string; etiqueta?: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <PulsoButton
      variant="secondary"
      size="sm"
      aria-label={`Variables de la base ${etiqueta ?? base}`}
      onClick={() => navigate(hrefVariablesBase(base))}
    >
      {children}
    </PulsoButton>
  );
}

/** `etiqueta` nombra la base para el lector de pantalla ("Base única" y no `default`). */
export function IrAVariablesDeBase(props: { base: string; etiqueta?: string; children: ReactNode }) {
  return useInRouterContext() ? <ConDireccion {...props} /> : null;
}
