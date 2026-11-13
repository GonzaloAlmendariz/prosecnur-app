/**
 * "Sugeridas al mirar la base" bajo la lista de las propias (prototipo
 * `pp-v-sug`, `vistas.js:639-642`): lo que el motor propone tras leer la base,
 * con su porqué, los casos que marca hoy (si el motor los mide) y "Añadir".
 * Añadir abre el panel de regla armado con ella, como "Usar" dentro del panel;
 * se guarda desde ahí.
 *
 * Ítem 40: cada sugerida va en su tarjeta; el enunciado de la pregunta se
 * muestra una vez, en su ficha, y el título y el porqué la nombran por su
 * código. Mientras el motor calcula (`semillas === undefined`), siluetas.
 */
import { Plus } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { ReglaSemilla } from "../../types";
import { BloqueDelRecomendador } from "./BloqueDelRecomendador";
import { presentarSugerida, type IndiceDePreguntas } from "./modeloRecomendador";
import { FraseDelRecomendador, TarjetaDelRecomendador } from "./PiezasDelRecomendador";

export function SugeridasDeLaBase({
  semillas,
  ocupada,
  indice,
  onAnadir,
}: {
  /** `undefined` mientras se calculan; `null` si el pedido falló. */
  semillas: readonly ReglaSemilla[] | null | undefined;
  ocupada: boolean;
  indice?: IndiceDePreguntas;
  onAnadir: (semilla: ReglaSemilla) => void;
}) {
  if (semillas === undefined) {
    return (
      <BloqueDelRecomendador
        id="pulso-rl-sugeridas-titulo"
        className="pulso-rl-sugeridas"
        titulo="Sugeridas al mirar la base"
        grupo="validacion/reglas-sugeridas"
        cargando
        etiquetaDeCarga="Buscando reglas sugeridas en la base"
      />
    );
  }
  if (semillas === null) {
    return (
      <BloqueDelRecomendador
        id="pulso-rl-sugeridas-titulo"
        className="pulso-rl-sugeridas"
        titulo="Sugeridas al mirar la base"
        grupo="validacion/reglas-sugeridas"
        estado="No se pudieron leer las reglas sugeridas."
        estadoEsAviso
      />
    );
  }
  if (!semillas.length) return null;
  return (
    <BloqueDelRecomendador
      id="pulso-rl-sugeridas-titulo"
      className="pulso-rl-sugeridas"
      titulo="Sugeridas al mirar la base"
      conteo={semillas.length}
      grupo="validacion/reglas-sugeridas"
    >
      {semillas.map((s, i) => {
        const vista = presentarSugerida(s, indice);
        return (
          <TarjetaDelRecomendador
            key={`${s.nombre}-${i}`}
            titulo={<FraseDelRecomendador piezas={vista.titulo} />}
            preguntas={vista.pregunta ? [vista.pregunta] : undefined}
            pie={vista.casosHoy !== null ? (
              <span className="pulso-rl-rec-cifra">
                Casos que marca hoy: <b>{formatoConteo(vista.casosHoy)}</b>
              </span>
            ) : undefined}
            acciones={(
              <PulsoButton
                variant="secondary"
                size="sm"
                disabled={ocupada}
                aria-label={`Añadir la sugerida ${s.nombre}`}
                onClick={() => onAnadir(s)}
              >
                <Plus size={13} aria-hidden="true" />
                Añadir
              </PulsoButton>
            )}
          >
            {vista.porque.length ? (
              <p className="pulso-rl-rec-frase"><FraseDelRecomendador piezas={vista.porque} /></p>
            ) : null}
          </TarjetaDelRecomendador>
        );
      })}
    </BloqueDelRecomendador>
  );
}
