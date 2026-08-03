import { createContext, useContext, useEffect, useState } from "react";

/**
 * G39 · Plegar y desplegar todos los criterios, sin quitarles su plegado propio.
 *
 * Gonzalo: «si bien todos están abiertos por defecto, también deberían poder
 * comprimirse, y arriba debe haber un botón para comprimir todos o descomprimir
 * todos de forma elegante».
 *
 * Cada tarjeta guarda su estado abierto/cerrado en su propio `useState`. Eso es
 * lo correcto —el plegado es asunto de la tarjeta— pero deja al botón global sin
 * a quién hablarle.
 *
 * Dos formas de resolverlo, y la elegida importa:
 *
 * - **Subir el estado al padre** obligaría a la página a conocer cada criterio,
 *   inventar una clave por tarjeta y enrutar un `onToggle` por cada una. Cada
 *   criterio nuevo tendría que acordarse de registrarse, y el que lo olvidara
 *   dejaría de responder al botón sin que nada avisara.
 * - **La orden como contexto** deja el estado donde está. La tarjeta escucha si
 *   quiere; una que no use el hook simplemente no obedece, y eso se ve.
 *
 * La orden viaja **sellada**: un booleano con una versión. La tarjeta se
 * sincroniza cuando la versión cambia y conserva el mando el resto del tiempo,
 * así que plegar todo y volver a abrir uno son gestos compatibles — que es como
 * se usa de verdad.
 *
 * El sello es lo que hace que funcione pulsar «plegar todos» dos veces seguidas
 * tras haber abierto uno a mano: sin versión, el efecto sólo reaccionaría al
 * cambio del booleano —que no cambió— y la segunda pulsación no haría nada.
 */
export type OrdenPlegado = {
  /** Qué se pide: abierto o cerrado. */
  abierto: boolean;
  /** Cambia en cada pulsación, incluso si `abierto` repite. */
  version: number;
};

export const PlegadoContexto = createContext<OrdenPlegado | null>(null);

/** Orden inicial: nadie ha pulsado todavía, así que nada se fuerza. */
export const ORDEN_PLEGADO_INICIAL: OrdenPlegado = { abierto: true, version: -1 };

/**
 * La siguiente orden al pulsar el control.
 *
 * La versión **siempre** avanza, aunque `abierto` repita. Ese es el sello: si
 * sólo cambiara el booleano, pulsar «plegar todos», abrir una tarjeta a mano y
 * volver a pulsar no haría nada —el booleano seguiría en `false` y el efecto no
 * reaccionaría—. Con la versión, la segunda pulsación se obedece.
 */
export function siguienteOrden(orden: OrdenPlegado): OrdenPlegado {
  return { abierto: !orden.abierto, version: orden.version + 1 };
}

export function usarPlegado(inicial: boolean) {
  const orden = useContext(PlegadoContexto);
  const [abierto, setAbierto] = useState(inicial);
  const version = orden?.version ?? -1;
  const pedido = orden?.abierto ?? inicial;
  useEffect(() => {
    // Sin orden todavía (versión -1) no se toca nada: la tarjeta abre como diga
    // su valor inicial y no como el de un control que nadie ha usado.
    if (version < 0) return;
    setAbierto(pedido);
    // `pedido` fuera de las dependencias a propósito: la orden se obedece cuando
    // llega, no cuando cambia su contenido. Con `pedido` dentro, reabrir una
    // tarjeta a mano y luego cambiar de facultad la volvería a plegar sola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  return [abierto, setAbierto] as const;
}
