/**
 * Facultades que no participan del estudio, declaradas a mano.
 *
 * Antes esta exclusión no existía como criterio: posgrado y las escuelas de
 * estudios especiales quedaban fuera de rebote, porque sus aulas son pequeñas y
 * caían por el mínimo de elegibles. El filtro que decía excluirlas buscaba las
 * palabras «posgrado» o «maestría» dentro de la columna de nivel, que en las
 * bases reales es un número de ciclo: no coincidía nunca. Bastaba bajar el
 * mínimo para que volvieran a entrar y pudieran salir sorteadas.
 *
 * La lista es explícita porque una decisión de diseño tiene que verse y poder
 * corregirse. Deducirla vuelve a depender de que los datos vengan bien, que es
 * exactamente como se rompió.
 */
import { useMemo } from "react";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../api/calcMuestra";
import type { FacultadRef } from "./facultades";
import { fmtInt } from "../../sharedCore";

export type FacultadesExcluidasCardProps = {
  config: CalcMuestraWorkspaceAulasConfig;
  /** Facultades DEL MARCO (perfil del motor), no del catálogo de alumno. */
  facultades: FacultadRef[];
  onPatch: (patch: Partial<CalcMuestraWorkspaceAulasConfig>) => void;
};

/** Misma normalización que el motor: sin acentos, sin mayúsculas, sin espacios de más. */
export function claveFacultad(valor: string): string {
  return valor
    .toUpperCase()
    .replace(/[ÁÀÂÄ]/g, "A")
    .replace(/[ÉÈÊË]/g, "E")
    .replace(/[ÍÌÎÏ]/g, "I")
    .replace(/[ÓÒÔÖ]/g, "O")
    .replace(/[ÚÙÛÜ]/g, "U")
    .replace(/Ñ/g, "N")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function estaExcluida(nombre: string, excluidas: string[]): boolean {
  const clave = claveFacultad(nombre);
  return excluidas.some((candidata) => claveFacultad(candidata) === clave);
}

export function FacultadesExcluidasCard({
  config,
  facultades,
  onPatch,
}: FacultadesExcluidasCardProps) {
  const excluidas = useMemo(() => config.excluded_faculties ?? [], [config.excluded_faculties]);

  const filas = useMemo(
    () =>
      facultades.map((f) => ({
        key: f.key,
        label: f.label,
        excluida: estaExcluida(f.label, excluidas),
      })),
    [facultades, excluidas],
  );

  function alternar(label: string, excluir: boolean) {
    const resto = excluidas.filter((nombre: string) => claveFacultad(nombre) !== claveFacultad(label));
    onPatch({ excluded_faculties: excluir ? [...resto, label] : resto });
  }

  return (
    <section className="cmv2-crit-card" data-criterio="facultades-excluidas">
      <div className="cmv2-subhead">
        <strong>Facultades excluidas</strong>
        <small>
          No participan del estudio. Sus aulas salen del marco por decisión, no por
          quedarse cortas de alumnos.
        </small>
      </div>

      {filas.length === 0 ? (
        <p className="cmv2-facultades-excluidas-vacio">
          El marco todavía no declara facultades. Construye la base para elegir cuáles
          quedan fuera.
        </p>
      ) : (
        <>
          <ul className="cmv2-facultades-excluidas-lista">
            {filas.map((f) => (
              <li key={f.key} data-excluida={f.excluida || undefined}>
                <label>
                  <input
                    type="checkbox"
                    checked={f.excluida}
                    onChange={(e) => alternar(f.label, e.currentTarget.checked)}
                  />
                  <span>{f.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="cmv2-facultades-excluidas-pie">
            {excluidas.length === 0
              ? "Ninguna facultad excluida: el marco las considera todas."
              : `${fmtInt(excluidas.length)} ${
                  excluidas.length === 1
                    ? "facultad excluida del marco"
                    : "facultades excluidas del marco"
                }.`}
          </p>
        </>
      )}
    </section>
  );
}
