// «Cambiar por» (GOAL editor profesional, L8; maqueta aprobada CambiarPor): la
// lista de secciones a las que puede pasar una sección, cada una con lo que
// queda guardado. Elegir una la cambia; se deshace como cualquier edición. Vive
// en el inspector (CambiarPorSeccion) y en la barra del lienzo (L10), con la
// misma lista (ListaDeDestinos).

import { useState } from "react";

import type { MailBlock } from "../../../api/materialMail";
import { ArrowLeftRight, Check } from "../../../vendor/lucide-react";
import { ICONO_DE_BLOQUE } from "./iconos";
import { cambiarPor, fraseDeCambio, rotuloDeDestino, TIPOS_INTERCAMBIABLES, type TipoIntercambiable } from "./modeloCambiarPor";
import "./correosSecciones.css";

type Props = {
  block: MailBlock & { type: TipoIntercambiable };
  onEditarBloque: (update: (b: MailBlock) => MailBlock, grupo?: string) => void;
};

/** Las secciones a las que puede pasar `block`, con su frase. Elegir una avisa con `onElegido`. */
export function ListaDeDestinos({ block, onEditarBloque, onElegido }: Props & { onElegido?: () => void }) {
  const destinos = TIPOS_INTERCAMBIABLES.filter((t) => t !== block.type);
  return (
    <ul className="rec-sec-destinos">
      {destinos.map((tipo) => {
        const Icono = ICONO_DE_BLOQUE[tipo];
        const frase = fraseDeCambio(block, tipo);
        const todo = frase === "Pasa todo";
        return (
          <li key={tipo}>
            <button
              type="button"
              className="rec-sec-destino"
              onClick={() => {
                onEditarBloque((b) => cambiarPor(b, tipo));
                onElegido?.();
              }}
            >
              <Icono size={16} aria-hidden />
              <span className="rec-sec-destino-texto">
                <span className="rec-sec-destino-nombre">{rotuloDeDestino(tipo)}</span>
                <span className={todo ? "rec-sec-destino-ok" : "rec-sec-destino-nota"}>
                  {todo ? <Check size={12} aria-hidden /> : null} {frase}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function CambiarPorSeccion({ block, onEditarBloque }: Props) {
  const [abierto, setAbierto] = useState(false);
  return (
    <section className="rec-sec-cambiar" aria-label="Cambiar por otra sección">
      <button type="button" className="rec-sec-icono" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        <ArrowLeftRight size={15} aria-hidden />
        <span>Cambiar por otra sección</span>
        <span className="rec-sec-icono-accion">{abierto ? "Cerrar" : "Elegir"}</span>
      </button>
      {abierto ? <ListaDeDestinos block={block} onEditarBloque={onEditarBloque} onElegido={() => setAbierto(false)} /> : null}
      {abierto ? <p className="rec-capa-img-ayuda">Lo guardado vuelve si regresas a la sección anterior. Se puede deshacer.</p> : null}
    </section>
  );
}
