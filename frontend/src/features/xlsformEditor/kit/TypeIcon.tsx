import { iconForType } from "../helpers/icons";
import { typeTone } from "./typeTone";
import "./kit.css";

// Ícono del tipo de pregunta en el color de su familia. `boxed` lo enmarca (cabeceras de tarjeta).

export function TypeIcon({ baseType, size = 14, boxed }: { baseType: string; size?: number; boxed?: boolean }) {
  const Icon = iconForType(baseType);
  const glyph = <Icon size={size} strokeWidth={1.9} aria-hidden="true" style={{ color: typeTone(baseType), flex: "none" }} />;
  return boxed ? <span className="xfk-typebox">{glyph}</span> : glyph;
}
