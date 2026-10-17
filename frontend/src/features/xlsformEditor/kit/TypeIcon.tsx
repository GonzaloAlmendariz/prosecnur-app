import { Sello } from "./Sello";
import "./kit.css";

// Fachada del tipo de pregunta junto a un texto (listas, esquema, referencias). Desde «Señales» (2026-10-17) pinta
// el sello. `size` conserva su sentido de antes (el alto del ícono que acompañaba al texto): el sello mide 1,3 veces
// eso para que su glifo se lea igual que el ícono viejo. `boxed` es el sello de 22 px de las cabeceras de tarjeta.

export function selloDesdeIcono(size: number): number {
  return Math.round(size * 1.3);
}

export function TypeIcon({ baseType, size = 14, boxed }: { baseType: string; size?: number; boxed?: boolean }) {
  return <Sello baseType={baseType} size={boxed ? 22 : selloDesdeIcono(size)} />;
}
