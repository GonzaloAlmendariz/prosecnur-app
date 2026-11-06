// Cabecera del Home del proyecto (5 nov 2026, Gonzalo: «puede tener un homepage más elegante y que ocupe mejor
// el espacio»). Reemplaza la franja suelta «desde tu última apertura»: a la izquierda el estudio —su nombre en
// grande y la meta en una línea—, a la derecha lo que cambió desde la última apertura. Es UNA fila, la misma que
// ya ocupaba la franja, así que no le roba alto a las tarjetas. Sin porcentajes globales ni «avance» del estudio
// (los módulos son herramientas independientes: feedback_home_substancia_no_avance).

import type { ProjectOverview } from "../../api/client";
import { BloqueHoy } from "./BloqueHoy";
import { formatSavedAt } from "./moduleCardModel";
import "./home-hero.css";

export function metaDelEstudio(project: ProjectOverview["project"]): string[] {
  const nombre = (project.name || "").trim();
  const archivo = (project.project_file || "").trim();
  return [
    project.code?.trim(),
    project.client?.trim(),
    // El archivo sólo se nombra si dice algo distinto del nombre (en un .pulso sin Ficha, ambos son «acnur_acg»).
    archivo && archivo.replace(/\.pulso$/i, "") !== nombre ? archivo : "",
    formatSavedAt(project.saved_at),
  ].filter((parte): parte is string => Boolean(parte));
}

export function HomeHero({ overview }: { overview: ProjectOverview }) {
  const nombre = (overview.project.name || overview.project.project_file || "Proyecto").trim();
  const meta = metaDelEstudio(overview.project);
  return (
    <header className="home-hero">
      <div className="home-hero-estudio">
        <p className="home-hero-ceja">Estudio</p>
        <h1 className="home-hero-nombre" title={nombre}>{nombre}</h1>
        {meta.length ? (
          <p className="home-hero-meta">
            {meta.map((parte, idx) => (
              <span key={parte}>
                {idx > 0 ? <span className="home-hero-sep" aria-hidden="true" /> : null}
                {parte}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <BloqueHoy overview={overview} />
    </header>
  );
}
