// Vara V3 — qué van a hacer tus decisiones, antes de cerrar la base.
//
// El motor simula en cada guardado y devuelve el antes/después completo; ese
// payload llegaba a la pestaña sin que nadie lo mirara. Va junto al botón de
// cerrar, que es el momento en que la información sirve.
//
// El estado que justifica la banda es el segundo: decisiones marcadas listas
// cuyo impacto es cero. Ahí el tono cambia, porque no es un resumen sino un
// aviso — cerrar así invalida codificación y analítica para rehacerlas
// idénticas.

import type { CSSProperties } from "react";
import { AlertTriangle, Sigma } from "lucide-react";

import { detalleFilas, type ImpactoDecisiones as Impacto } from "../impactoDecisiones";

export default function ImpactoDecisiones({ impacto }: { impacto: Impacto | null }) {
  if (!impacto) return null;
  const detalle = detalleFilas(impacto);
  // El aviso vale para los dos casos: nada cambia, o los identificadores que
  // elegiste no existen en la base. El segundo es más específico y se dice.
  const alerta = impacto.nulo || impacto.exclusionSinEfecto;

  return (
    <div
      data-testid="limpieza-impacto"
      data-nulo={impacto.nulo ? "1" : undefined}
      data-sin-efecto={impacto.exclusionSinEfecto ? "1" : undefined}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 12px",
        borderRadius: "var(--pulso-radius-panel)",
        border: `1px solid ${alerta ? "var(--pulso-warn-border)" : "var(--pulso-border)"}`,
        background: alerta ? "var(--pulso-warn-bg)" : "var(--pulso-surface-2)",
        fontSize: 12,
        color: "var(--pulso-text)",
      }}
    >
      <span style={{ display: "flex", paddingTop: 1, flex: "0 0 auto", color: alerta ? "var(--pulso-warn-fg)" : "var(--pulso-text-soft)" }}>
        {alerta ? <AlertTriangle size={14} /> : <Sigma size={14} />}
      </span>
      <span style={{ lineHeight: 1.45 }}>
        <strong>{impacto.titular}</strong>
        {impacto.exclusionSinEfecto ? (
          <>
            {" "}
            Los identificadores que elegiste no aparecen en la base: revísalos contra la columna de
            código antes de cerrar.
          </>
        ) : impacto.nulo ? (
          <>
            {" "}
            Revisa los valores y los casos que elegiste: cerrar así rehace codificación y analítica
            para dejarlas igual que ahora.
          </>
        ) : detalle ? (
          <> {detalle}</>
        ) : null}
        {!alerta && impacto.reglasResueltas > 0 && (
          <span style={subtle}>
            {" · "}
            {impacto.reglasResueltas === 1
              ? "1 hallazgo queda resuelto"
              : `${impacto.reglasResueltas} hallazgos quedan resueltos`}
          </span>
        )}
      </span>
    </div>
  );
}

const subtle: CSSProperties = { color: "var(--pulso-text-soft)" };
