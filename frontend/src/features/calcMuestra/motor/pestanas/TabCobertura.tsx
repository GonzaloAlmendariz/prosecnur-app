/**
 * Pestaña Cobertura (sección Marco): elegibles alcanzables por el marco de
 * aulas y prueba de factibilidad por unidad (alcanzables ≥ sobremuestra).
 * El cierre del cruce población × marco.
 */
import { CheckCircle2, TriangleAlert } from "lucide-react";
import type { FilaCobertura, PerfilInstitucional } from "../../dominio";
import { fmtInt, fmtPct } from "../../sharedCore";
import { CifraFila, CifraMotor } from "../../universidad/ui";
import { BarrasFacultad } from "../componentes/BarrasFacultad";
import { NotaPorQue } from "../componentes/NotaPorQue";

export function TabCobertura({
  perfil,
  cob,
}: {
  perfil: PerfilInstitucional;
  cob: { filas: FilaCobertura[]; totalElegibles: number; totalAlcanzables: number | null; pctGlobal: number | null };
}) {
  if (cob.totalAlcanzables == null) {
    return (
      <div className="rec-cap">
        <p className="rec-chip-ilustrativo">
          La cobertura se mide cruzando población y marco sobre la base del proyecto: qué parte de
          los elegibles está matriculada en al menos un aula incluida. Disponible al construir el
          marco (pestañas Población y Aulas) o con el caso de ejemplo.
        </p>
      </div>
    );
  }

  const noAlcanzables = cob.totalElegibles - cob.totalAlcanzables;

  return (
    <div className="rec-cap">
      <CifraFila>
        <CifraMotor
          label="Cobertura del marco"
          value={fmtPct(cob.pctGlobal)}
          detalle={`${fmtInt(cob.totalAlcanzables)} de ${fmtInt(cob.totalElegibles)} elegibles alcanzables`}
          hero
          tono="ok"
        />
        <CifraMotor
          label="No alcanzables"
          value={fmtInt(noAlcanzables)}
          detalle="solo aparecen en aulas excluidas del marco"
        />
        <CifraMotor
          label="Factibilidad"
          value={`${cob.filas.filter((f) => f.factible === true).length} / ${cob.filas.length}`}
          detalle="unidades con alcanzables ≥ sobremuestra"
          tono={cob.filas.every((f) => f.factible !== false) ? "ok" : "alerta"}
        />
      </CifraFila>

      <section className="rec-bloque">
        <h3>Elegibles y alcanzables por {perfil.etiquetaUnidad}</h3>
        <p className="rec-bloque-sub">
          Barra completa: elegibles. Franja sólida: alcanzables por el marco. A la derecha, la
          prueba de factibilidad frente a la sobremuestra de cada unidad.
        </p>
        <BarrasFacultad
          ariaLabel={`Cobertura por ${perfil.etiquetaUnidad}`}
          filas={[...cob.filas]
            .sort((a, b) => b.elegibles - a.elegibles)
            .map((fila) => ({
              id: fila.facultadId,
              nombre: fila.nombre,
              valor: fila.elegibles,
              overlay: fila.alcanzables ?? undefined,
              etiqueta: `${fmtPct(fila.pct)} · ${fmtInt(fila.alcanzables)}`,
              anotacion:
                fila.factible == null ? null : fila.factible ? (
                  <span className="rec-factible" data-ok>
                    <CheckCircle2 size={13} aria-hidden="true" /> cubre {fmtInt(fila.sobremuestra)}
                  </span>
                ) : (
                  <span className="rec-factible">
                    <TriangleAlert size={13} aria-hidden="true" /> no llega a {fmtInt(fila.sobremuestra)}
                  </span>
                ),
            }))}
        />
      </section>

      <NotaPorQue pregunta="Lectura de la factibilidad">
        Una cobertura global alta no basta: cada unidad debe conservar población alcanzable
        suficiente para llenar su sobremuestra. Si una unidad no llega, el diseño requiere ajustar
        criterios del marco o el reparto antes de ir a campo.
      </NotaPorQue>
    </div>
  );
}
