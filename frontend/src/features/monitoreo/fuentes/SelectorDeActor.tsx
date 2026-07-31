import { Check, Plus } from "../../../vendor/lucide-react";

import { inicialesDeActor } from "./inicialesDeActor";

/**
 * Elegir el actor con el mismo objeto con que la app ya lo dibuja.
 *
 * Antes esto era un `<input list=datalist>`: un campo de texto que no se
 * parecía a nada del módulo y donde el roster —cuatro nombres conocidos— solo
 * aparecía si desplegabas el autocompletado. Debajo, una frase enumeraba
 * cuáles ya tenían la pieza. Es decir, el estado de cada actor se contaba en
 * prosa en vez de verse en el actor.
 *
 * Ahora el roster son tarjetas con la inicial —el mismo objeto de Fuentes ›
 * Actores— y el «ya la tiene» es una marca en la tarjeta que la tiene. La
 * frase desaparece porque ya no hace falta leerla.
 *
 * Se conserva el texto libre, que sí hacía falta: un actor puede no estar en
 * el roster. Vive detrás de «Otro actor», y se abre solo cuando el valor
 * actual no es ninguno de los conocidos —el caso de editar una fuente vieja—.
 */
export function SelectorDeActor({
  valor,
  sugeridos,
  yaConectados,
  onElegir,
  textoLibreAbierto,
  onAbrirTextoLibre,
}: {
  valor: string;
  sugeridos: string[];
  yaConectados: string[];
  onElegir: (actor: string) => void;
  textoLibreAbierto: boolean;
  onAbrirTextoLibre: () => void;
}) {
  const comparable = (nombre: string) => nombre.trim().toLocaleLowerCase("es-PE");
  const conectados = new Set(yaConectados.map(comparable));

  return (
    <div className="fuentes-conectar-actores" role="radiogroup" aria-label="Actor">
      {sugeridos.map((nombre) => {
        const elegido = !textoLibreAbierto && comparable(nombre) === comparable(valor);
        const yaTiene = conectados.has(comparable(nombre));
        return (
          <button
            key={nombre}
            type="button"
            role="radio"
            aria-checked={elegido}
            className={`fuentes-conectar-actor${elegido ? " is-elegido" : ""}`}
            onClick={() => onElegir(nombre)}
          >
            <span className="fuentes-conectar-actor-inicial" aria-hidden="true">
              {inicialesDeActor(nombre)}
            </span>
            <strong>{nombre}</strong>
            {yaTiene ? (
              <Check
                size={13}
                className="fuentes-conectar-actor-marca"
                aria-label="Ya conectado"
              />
            ) : null}
          </button>
        );
      })}
      <button
        type="button"
        role="radio"
        aria-checked={textoLibreAbierto}
        className={`fuentes-conectar-actor is-otro${textoLibreAbierto ? " is-elegido" : ""}`}
        onClick={onAbrirTextoLibre}
      >
        <span className="fuentes-conectar-actor-inicial" aria-hidden="true">
          <Plus size={13} />
        </span>
        <strong>Otro actor</strong>
      </button>
    </div>
  );
}
