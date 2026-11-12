/**
 * Columna "Familias" de Reglas (prototipo `pp-panel--cola pp-fam`,
 * `vistas.js:623-628`): las reglas del formulario por tipo, las del operativo,
 * las propias y, al pie, las preguntas fuera de la auditoría (D-F7c). Elegir
 * una familia la escribe en la dirección (`familia=`).
 *
 * El grupo "Del operativo" lleva también la entrada a sus dos paneles (D-F7b):
 * los controles del operativo y cómo se identifica un caso.
 */
import { Layers } from "../../../../vendor/lucide-react";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { GrupoDeFamilias } from "./modeloCatalogo";

export function ColumnaDeFamilias({
  grupos,
  abierta,
  onElegir,
  onControlesDelOperativo,
  onRoles,
}: {
  grupos: readonly GrupoDeFamilias[];
  abierta: string;
  onElegir: (clave: string) => void;
  onControlesDelOperativo: () => void;
  onRoles: () => void;
}) {
  return (
    <PanelDeMesa zona="familias" titulo="Familias" icono={<Layers size={15} />}>
      <nav aria-label="Familias de reglas" className="pulso-rl-familias">
        {grupos.map((g) => (
          <section key={g.id} className="pulso-rl-familias-grupo" aria-labelledby={`pulso-rl-grupo-${g.id}`}>
            <h3 id={`pulso-rl-grupo-${g.id}`} className="pulso-rl-familias-rotulo">
              <span>{g.rotulo}</span>
              {g.n !== null ? <span className="pulso-rl-familias-n">{formatoConteo(g.n)}</span> : null}
            </h3>
            <ul
              className="pulso-rl-familias-lista"
              data-qa-geometry-group={`validacion/reglas-familias-${g.id}`}
              data-qa-geometry-contract="equal"
            >
              {g.entradas.map((e) => (
                <li key={e.clave} data-qa-geometry-member="">
                  <button
                    type="button"
                    className="pulso-rl-familia"
                    aria-current={e.clave === abierta ? "true" : undefined}
                    onClick={() => onElegir(e.clave)}
                  >
                    <span className="pulso-rl-familia-nombre">
                      {e.nombre}
                      {e.aviso ? <span className="pulso-rl-punto" data-tono="aviso" aria-hidden="true" /> : null}
                    </span>
                    <span className="pulso-rl-familia-n">{formatoConteo(e.n)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {g.id === "operativo" ? (
              <div className="pulso-rl-familias-accesos">
                <PulsoButton variant="link" size="sm" onClick={onControlesDelOperativo}>
                  Controles del operativo
                </PulsoButton>
                <PulsoButton variant="link" size="sm" onClick={onRoles}>
                  Cómo se identifica un caso
                </PulsoButton>
              </div>
            ) : null}
          </section>
        ))}
      </nav>
    </PanelDeMesa>
  );
}
