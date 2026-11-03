// Aulas › Paquetes con el kit (pasada de diseño, 2 nov 2026, «Sí, extiéndelo»). Era
// el n.º 4 del ranking: tres botones apagados en fila sin jerarquía y un vacío que
// repetía el motivo. Cada formato de salida es ahora una tarjeta que dice qué
// produce; el botón lo sigue montando `MaterialsSection` (un solo `motivoBloqueo`
// alimenta los tres, contrato de fichasDenominador.test.ts).

import type { ReactNode } from "react";

import "./styles/paquetesAulasTablero.css";

export function FormatoDeSalida({ icono, titulo, descripcion, principal, children }: {
  icono: ReactNode;
  titulo: string;
  descripcion: string;
  principal?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="rec-paq-formato" data-principal={principal || undefined}>
      <span className="rec-paq-formato-icono" aria-hidden>{icono}</span>
      <strong>{titulo}</strong>
      <p>{descripcion}</p>
      <div className="rec-paq-formato-accion">{children}</div>
    </article>
  );
}

export function FormatosDeSalida({ children }: { children: ReactNode }) {
  return <div className="rec-paq-formatos">{children}</div>;
}
