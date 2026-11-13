/**
 * Piezas del recomendador (ítem 40): la frase partida en texto, códigos de
 * pregunta y fichas de valores; la ficha de una pregunta con su enunciado; y la
 * tarjeta que comparten las sugeridas de la base y las sugerencias del detector.
 */
import type { ReactNode } from "react";
import { Panel } from "../../../../components/Panel";
import { FichaPregunta } from "../../../../components/procesamiento/FichaPregunta";
import "./recomendador.css";
import type { PiezaDeFrase, PreguntaDelRecomendador } from "./modeloRecomendador";

export function FraseDelRecomendador({ piezas }: { piezas: readonly PiezaDeFrase[] }) {
  return (
    <>
      {piezas.map((p, i) => {
        if (p.tipo === "codigo") return <code key={i} className="pulso-rl-rec-codigo">{p.texto}</code>;
        if (p.tipo === "valores") {
          return (
            <span key={i} className="pulso-rl-rec-valores">
              {p.valores.map((v, j) => <span key={j} className="pulso-rl-rec-valor">{v || "(vacío)"}</span>)}
            </span>
          );
        }
        return <span key={i}>{p.texto}</span>;
      })}
    </>
  );
}

export function FichaDelRecomendador({ pregunta }: { pregunta: PreguntaDelRecomendador }) {
  return (
    <FichaPregunta
      tipo={pregunta.tipo}
      codigo={pregunta.etiqueta ? pregunta.codigo : undefined}
      etiqueta={pregunta.etiqueta ?? pregunta.codigo}
    />
  );
}

/**
 * Una propuesta en su contenedor: título, fichas de las preguntas, cuerpo y,
 * a la derecha (abajo en una columna angosta), las acciones con el mismo ancho.
 * El pie (la cifra o la concentración) cruza la tarjeta entera.
 */
export function TarjetaDelRecomendador({
  titulo,
  preguntas,
  children,
  pie,
  acciones,
}: {
  titulo: ReactNode;
  preguntas?: readonly PreguntaDelRecomendador[];
  children?: ReactNode;
  pie?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <li className="pulso-rl-rec-item" data-qa-geometry-member="">
      <Panel noPadding className="pulso-rl-rec-tarjeta" data-sin-acciones={acciones ? undefined : ""}>
        <div className="pulso-rl-rec-cuerpo">
          <p className="pulso-rl-rec-titulo">{titulo}</p>
          {preguntas?.length ? (
            <div className="pulso-rl-rec-preguntas">
              {preguntas.map((p) => <FichaDelRecomendador key={p.codigo} pregunta={p} />)}
            </div>
          ) : null}
          {children}
        </div>
        {acciones ? <div className="pulso-rl-rec-acciones">{acciones}</div> : null}
        {pie ? <div className="pulso-rl-rec-pie">{pie}</div> : null}
      </Panel>
    </li>
  );
}
