import type { ReactNode } from "react";

/**
 * Grupo 8 de «Ajustes del diseño», Fase y piloto (M6): la regla del piloto para el campo real (la arma la
 * página con ReglaPiloto, que guarda por su cuenta). La fase misma se mira y se crea desde la barra.
 */
export function GrupoFase({ fase, reglaPiloto }: { fase: string; reglaPiloto: ReactNode }) {
  return (
    <div className="hr-ajustes-grupo-cuerpo">
      <dl className="hr-ajustes-formula" aria-label="Fase vigente">
        <div><dt>Fase</dt><dd>{fase === "pilot" ? "Piloto" : "Campo real"}</dd></div>
      </dl>
      {reglaPiloto ? <section className="hr-ajustes-bloque">{reglaPiloto}</section> : <p className="hr-mapa-nota">{fase === "pilot" ? "La regla del piloto se decide en el campo real." : "Este estudio no tiene corrida piloto."}</p>}
    </div>
  );
}
