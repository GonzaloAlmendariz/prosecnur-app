import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { ESTADOS_OPERATIVOS, STATUS_LABELS } from "./aulasPresentation";
import { COLOR_AULA_LISTA, TRAMOS_DE_APLICACION } from "./estadoDeAplicacion";

/**
 * El estado de una fila, como chip de color y no como texto plano.
 *
 * Las tablas de los otros perfiles —acreditación, telefónico— llevan chips de
 * estado desde hace tiempo (`mon-quality-alert-chip` y compañía) y las de aulas
 * eran texto corrido: para saber cuántas aulas están reemplazadas había que
 * leer la columna fila a fila. Un estado es una categoría cerrada y corta; el
 * color hace el conteo por el ojo.
 *
 * **Los colores son los de la franja por día**, no unos nuevos: la misma aula
 * tiene que verse del mismo color en la barra de su día y en su fila de la
 * tabla, o las dos superficies dejan de hablar entre sí.
 */

/**
 * Las columnas que son un ESTADO y no un dato libre.
 *
 * Era una lista de cuatro claves literales, y la capa de presentación decide lo
 * mismo con una regla más ancha —`status`, cualquier `*_status`, cualquier
 * `*_state`—. Dos criterios para la misma pregunta: medido sobre el corte, la
 * columna «Estado» de Cuotas tenía **40 celdas sin chip de 40**, porque su clave
 * es `status` a secas y no estaba en la lista.
 *
 * Ahora el chip pregunta lo mismo que la traducción. No hace falta que la lista
 * acierte: `colorDeEstado` no colorea lo que no reconoce, así que una columna
 * que no sea un estado se queda en texto plano igual que antes.
 */
export function esColumnaDeEstado(campo: string) {
  return campo === "status" || campo.endsWith("_status") || campo.endsWith("_state");
}

/** Compatibilidad: el `has` de antes, ahora resuelto por la regla. */
export const COLUMNAS_DE_ESTADO = { has: esColumnaDeEstado };

/**
 * El estado OPERATIVO, agrupado por desenlace.
 *
 * Son once estados y no once colores: el color dice de qué familia es el
 * desenlace —todavía no sale a campo, está en campo, se recogió, cayó, necesita
 * decisión— y la etiqueta, que va al lado, conserva el detalle. Inventar once
 * colores obligaría a distinguir a ojo «contactada» de «planificada» por un
 * matiz, que es justo lo que un chip no sabe hacer.
 *
 * Este vocabulario es DISTINTO del de `application_state`, y por eso necesita su
 * propia tabla: buscar por etiqueta contra los tramos acertaba en `sample_status`
 * por coincidencia de rótulos —«Agendada», «Reemplazada»— y fallaba entero acá.
 * Medido sobre HSVG2026: las 168 filas de Brechas enseñaban «Planificada» sin
 * color, en la misma pantalla que otra tabla sí coloreaba sus estados.
 */
const COLOR_OPERATIVO: Record<string, string> = {
  // Todavía no sale a campo.
  planificada: COLOR_RESULTADO.pendiente,
  contactada: COLOR_RESULTADO.pendiente,
  // Lista o ya en el aula.
  agendada: COLOR_AULA_LISTA,
  en_campo: COLOR_AULA_LISTA,
  // Se recogió algo y todavía no cierra.
  aplicada: COLOR_RESULTADO.parcial,
  parcial: COLOR_RESULTADO.parcial,
  // El aula cayó.
  sin_acceso: COLOR_RESULTADO.rechazo,
  cancelada: COLOR_RESULTADO.rechazo,
  // Pide o ya tuvo una decisión.
  reemplazo_pendiente: COLOR_RESULTADO.revision,
  reemplazada: COLOR_RESULTADO.revision,
  // Cerrada de verdad.
  cerrada: COLOR_RESULTADO.efectiva,
};

/**
 * El OTRO rótulo de cada tramo de aplicación.
 *
 * `application_state` tiene dos juegos de nombres: los de `TRAMOS_DE_APLICACION`
 * —que es lo que se lee en la franja por día— y los de `STATUS_LABELS`, que es
 * lo que llega a las celdas de la tabla. Buscar el color sólo por los primeros
 * dejaba sin colorear el valor mayoritario: medido sobre el corte, la columna
 * «Status de aplicación» tenía 76 celdas con chip de 236, y las 160 restantes
 * decían «Lista», que es el mismo estado que la franja llama «Agendada».
 *
 * No se unifican los nombres: la tabla convive con una columna `sample_status`
 * que ya usa «Agendada», y unificarlos pondría la misma palabra con dos
 * significados en la misma fila. Lo que se unifica es el color.
 */
const COLOR_POR_ROTULO_ALTERNO = new Map(
  TRAMOS_DE_APLICACION
    .map((t) => [String(STATUS_LABELS[t.clave] ?? "").toLowerCase(), t.color] as const)
    .filter(([rotulo]) => Boolean(rotulo)),
);

/** El mismo mapa, indexado por el rótulo que de verdad llega a la celda. */
const COLOR_OPERATIVO_POR_ETIQUETA = new Map(
  ESTADOS_OPERATIVOS.map((e) => [e.label.toLowerCase(), COLOR_OPERATIVO[e.value]]),
);

/**
 * El vocabulario de las CUOTAS, que es otro.
 *
 * `pendiente` ya tenía color por el rótulo alterno de su tramo, pero `cumplida`,
 * `en_riesgo` y `sin_meta` no aparecen en ningún tramo ni en los estados
 * operativos. Sin esto, la columna «Estado» de Cuotas coloreaba lo pendiente y
 * dejaba en texto plano lo cumplido: una columna donde sólo se ve la mala
 * noticia se lee peor que una sin color.
 *
 * Sobre el corte de prueba las 40 celdas están en «Pendiente», así que las otras
 * tres NO se pueden ver en pantalla todavía; se fijan por test.
 */
const COLOR_CUOTA: Record<string, string> = {
  pendiente: COLOR_RESULTADO.pendiente,
  cumplida: COLOR_RESULTADO.efectiva,
  en_riesgo: COLOR_RESULTADO.parcial,
  sin_meta: COLOR_RESULTADO.revision,
};

const COLOR_CUOTA_POR_ETIQUETA = new Map(
  Object.entries(COLOR_CUOTA).map(([clave, color]) => [
    String(STATUS_LABELS[clave] ?? clave).toLowerCase(),
    color,
  ]),
);

/**
 * El color de un estado, buscado por su ETIQUETA visible.
 *
 * Se busca por etiqueta y no por clave porque a la celda llega ya traducido por
 * la capa de presentación —«Reemplazada», no `reemplazada`—, y duplicar aquí la
 * tabla de traducción sería una segunda verdad. Un estado que no esté en la
 * lista no se colorea: mejor sin color que con un color que signifique otra cosa.
 */
export function colorDeEstado(valor: string): string | null {
  const texto = valor.trim().toLowerCase();
  if (!texto) return null;
  const tramo = TRAMOS_DE_APLICACION.find((t) => t.etiqueta.toLowerCase() === texto);
  if (tramo) return tramo.color;
  const operativo = COLOR_OPERATIVO_POR_ETIQUETA.get(texto);
  if (operativo) return operativo;
  const alterno = COLOR_POR_ROTULO_ALTERNO.get(texto);
  if (alterno) return alterno;
  const cuota = COLOR_CUOTA_POR_ETIQUETA.get(texto);
  if (cuota) return cuota;
  // «EN RESERVA 3» es el vocabulario del Excel: la reserva y su posición. El
  // número cambia la fila, no el estado.
  if (texto.startsWith("en reserva")) {
    return TRAMOS_DE_APLICACION.find((t) => t.clave === "en_reserva")?.color ?? null;
  }
  return null;
}

export function EstadoEnCelda({ valor }: { valor: string }) {
  const color = colorDeEstado(valor);
  if (!color) return <>{valor}</>;
  return (
    <span className="aulas-estado-chip" style={{ "--aulas-estado": color } as React.CSSProperties}>
      {valor}
    </span>
  );
}
