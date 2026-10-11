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
 *
 * Desde L27 cada facultad es un switch chico (K1: todo booleano es un switch)
 * y el switch dice si la facultad ENTRA al marco: encendido = participa,
 * apagado = excluida. El dato guardado sigue siendo la lista de excluidas.
 * Por eso el título visible habla de las que PARTICIPAN (lo que dice el
 * switch encendido) y el pie ofrece «Ninguna | Todas» como acciones de texto
 * fuera de la prosa, con su altura de control (≥24 px).
 */
import { useMemo } from "react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
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

  const ningunaParticipa = filas.length > 0 && filas.every((f) => f.excluida);

  function alternar(label: string, excluir: boolean) {
    const resto = excluidas.filter((nombre: string) => claveFacultad(nombre) !== claveFacultad(label));
    onPatch({ excluded_faculties: excluir ? [...resto, label] : resto });
  }

  return (
    <section className="cmv2-crit-card" data-criterio="facultades-excluidas">
      <div className="cmv2-subhead">
        <strong>Facultades que participan</strong>
        <small>
          Apaga una facultad para excluirla: sus aulas salen del marco por decisión,
          no por quedarse cortas de alumnos.
        </small>
      </div>

      {filas.length === 0 ? (
        <p className="cmv2-facultades-excluidas-vacio">
          El marco todavía no declara facultades. Construye la base para elegir cuáles
          quedan fuera.
        </p>
      ) : (
        <>
          <ul
            className="cmv2-facultades-excluidas-lista"
            aria-label="Facultades que participan del estudio"
            data-qa-geometry-group="calc-muestra/facultades-participan"
            data-qa-geometry-contract="equal"
          >
            {filas.map((f) => (
              <li key={f.key} data-excluida={f.excluida || undefined}>
                <PulsoSwitch
                  size="sm"
                  label={f.label}
                  ariaLabel={`${f.label} participa del estudio`}
                  checked={!f.excluida}
                  onCheckedChange={(participa) => alternar(f.label, !participa)}
                />
              </li>
            ))}
          </ul>
          <div className="cmv2-facultades-excluidas-pie">
            <span>
              {excluidas.length === 0
                ? "Ninguna facultad excluida: el marco las considera todas."
                : `${fmtInt(excluidas.length)} ${
                    excluidas.length === 1
                      ? "facultad excluida del marco"
                      : "facultades excluidas del marco"
                  }.`}
            </span>
            <span
              className="cmv2-facultades-excluidas-acciones"
              role="group"
              aria-label="Participación de todas las facultades"
            >
              <PulsoButton
                variant="link"
                size="sm"
                disabled={ningunaParticipa}
                title="Excluir todas las facultades del marco"
                onClick={() => onPatch({ excluded_faculties: filas.map((f) => f.label) })}
              >
                Ninguna
              </PulsoButton>
              <PulsoButton
                variant="link"
                size="sm"
                disabled={excluidas.length === 0}
                title="Incluir todas las facultades en el marco"
                onClick={() => onPatch({ excluded_faculties: [] })}
              >
                Todas
              </PulsoButton>
            </span>
          </div>
        </>
      )}
    </section>
  );
}
