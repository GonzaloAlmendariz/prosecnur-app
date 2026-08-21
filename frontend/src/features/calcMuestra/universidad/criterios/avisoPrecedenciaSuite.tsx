/**
 * Aviso del cambio de régimen que produce declarar el primer criterio.
 *
 * Medido con los archivos reales (dos construcciones del marco en frío):
 * declarar un criterio en UNA facultad mueve las cifras de TODAS. Sin criterios
 * el marco incluye 3.142 cursos-horario; con un criterio sólo en Estudios
 * Generales Ciencias, 3.402 — esa facultad baja 26, y las otras quince suben
 * (Generales Letras +120, Posgrado +60, Derecho +19, Arquitectura +16…).
 *
 * El motor lo hace a propósito y lo razona en su código: con la suite activa
 * ELLA es la autoridad única de las dimensiones que cubre y los filtros
 * heredados se neutralizan, porque con el modelo anterior la suite sólo podía
 * restringir y nunca ampliar (calc_muestra_aulas.R, «Precedencia suite ⇒ flags
 * legacy»). Lo que faltaba era decirlo: restringir una facultad y ver crecer el
 * total, sin explicación, se lee como un error de cálculo.
 *
 * Se muestra justo cuando importa —hay criterios declarados y el marco está por
 * recalcularse—, no de forma permanente.
 */
import { AvisoModulo } from "../shared/AvisoModulo";

export function debeAvisarPrecedenciaSuite({
  suiteActiva,
  marcoDesactualizado,
}: {
  suiteActiva: boolean;
  marcoDesactualizado: boolean;
}): boolean {
  return Boolean(suiteActiva && marcoDesactualizado);
}

export function AvisoPrecedenciaSuite() {
  return (
    <AvisoModulo tone="info" title="Con criterios declarados manda tu selección, no los supuestos del diseño" compact>
      <p>
        Al recalcular, los criterios que declaraste gobiernan el marco y los supuestos heredados del
        diseño —pregrado, mayoría de edad, condición del alumno, modalidad— dejan de aplicarse por su
        cuenta. Por eso una facultad donde no declaraste nada puede quedar con más aulas que antes.
      </p>
    </AvisoModulo>
  );
}
