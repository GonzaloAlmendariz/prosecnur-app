import { EquivalenciasPanel } from "../EquivalenciasPanel";

/** Equivalencias entre públicos: solo existe con bases separadas, así que no tiene variante. */
export function PestanaEquivalencias({ onDeclaradas }: { onDeclaradas: (filas: number | "error") => void }) {
  return <EquivalenciasPanel onDeclaradas={onDeclaradas} />;
}
