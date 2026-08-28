/**
 * Un aviso de «esto caducó» que sobrevive a la reparación miente.
 *
 * EL CASO, medido en la app el 2026-08-25 sobre HSVG 2026. La mesa de Cálculo
 * pinta UN mensaje global que cada acción escribe y sólo se borra al empezar
 * otra o al pulsar la X. Los errores de caducidad —`E_CALC_MUESTRA_ALUMNOS_CH_-
 * DECISION` y sus hermanos— dicen que el estado quedó desfasado y hay que
 * rehacer algo. Cuando el analista lo rehace, el aviso SIGUE EN PANTALLA:
 * describe un mundo que ya no existe.
 *
 * Lo que costó: Gonzalo, con el marco reconstruido, la decisión reconfirmada y
 * las 179 aulas ya calculadas, preguntó «sigo sin entender si estamos en el
 * .pulso definitivo porque esto sigue saliendo». Un aviso obsoleto no es ruido
 * cosmético — le hizo dudar de si el trabajo estaba hecho. Y en la misma
 * pantalla convivía con «Cálculo listo» y «marco vigente», que decían lo
 * contrario.
 *
 * POR QUÉ SE RESUELVE MIRANDO EL ESTADO Y NO CON UN TEMPORIZADOR. Un aviso que
 * se desvanece solo a los N segundos también borra los que SÍ siguen vigentes.
 * Aquí la condición es comprobable: el mensaje caduca cuando el hash del marco,
 * el del contrato de alumnos por CH y el de la decisión que firmó el resultado
 * vuelven a coincidir. Si no coinciden, el aviso se queda —que es su trabajo.
 *
 * Sólo se retiran los códigos de caducidad. Un error de verdad (no se pudo
 * calcular, el job falló) no lo borra nadie salvo el usuario.
 */
import { useEffect } from "react";

/** Códigos cuyo mensaje deja de ser cierto en cuanto el estado se realinea. */
const CODIGOS_CADUCIDAD = [
  "E_CALC_MUESTRA_ALUMNOS_CH_DECISION",
  "E_CALC_MUESTRA_AULAS_FRAME_STALE",
];

type AvisoMinimo = { kind: string; text: string } | null;

/** ¿Este mensaje es uno de los que caducan al realinearse el estado? */
export function esAvisoDeCaducidad(msg: AvisoMinimo): boolean {
  if (!msg || !msg.text) return false;
  return CODIGOS_CADUCIDAD.some((codigo) => msg.text.includes(codigo));
}

type EstadoDeAlineacion = {
  /** `frame_hash` del marco vigente. */
  frameHash?: string | null;
  /** `frame_hash` del contrato de alumnos por CH que trae ese marco. */
  contratoHash?: string | null;
  /** `frame_hash` de la decisión que firmó cada resultado publicado. */
  decisionHashes: readonly (string | null | undefined)[];
};

/**
 * ¿El estado volvió a estar alineado?
 *
 * Exige que haya al menos un resultado firmado: sin resultados no hay nada que
 * demuestre que la caducidad se resolvió, y borrar el aviso ahí sería cantar
 * victoria por ausencia de evidencia.
 */
export function estadoAlineado(estado: EstadoDeAlineacion): boolean {
  const frame = estado.frameHash ?? "";
  if (!frame) return false;
  if ((estado.contratoHash ?? "") !== frame) return false;
  const firmas = estado.decisionHashes.filter(
    (h): h is string => typeof h === "string" && h.length > 0,
  );
  if (!firmas.length) return false;
  return firmas.every((h) => h === frame);
}

/**
 * Retira el aviso de caducidad en cuanto el estado que lo motivó se realinea.
 *
 * No toca ningún otro mensaje ni reintroduce uno retirado por el usuario.
 */
export function useAvisoCaducidadResuelta(
  msg: AvisoMinimo,
  limpiar: () => void,
  estado: EstadoDeAlineacion,
): void {
  const caduco = esAvisoDeCaducidad(msg);
  const alineado = estadoAlineado(estado);
  useEffect(() => {
    if (caduco && alineado) limpiar();
  }, [caduco, alineado, limpiar]);
}
