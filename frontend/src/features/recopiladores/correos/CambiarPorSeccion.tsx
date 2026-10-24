// «Cambiar por» en el inspector de una sección (GOAL editor profesional, L8;
// maqueta aprobada CambiarPor): la lista de secciones a las que puede pasar,
// cada una con lo que queda guardado. Elegir una la cambia; se deshace como
// cualquier edición.

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

export function CambiarPorSeccion({ block, onEditarBloque }: Props) {
  const [abierto, setAbierto] = useState(false);
  const destinos = TIPOS_INTERCAMBIABLES.filter((t) => t !== block.type);
  return (
    <section className="rec-sec-cambiar" aria-label="Cambiar por otra sección">
      <button type="button" className="rec-sec-icono" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        <ArrowLeftRight size={15} aria-hidden />
        <span>Cambiar por otra sección</span>
        <span className="rec-sec-icono-accion">{abierto ? "Cerrar" : "Elegir"}</span>
      </button>
      {abierto ? (
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
                    setAbierto(false);
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
      ) : null}
      {abierto ? <p className="rec-capa-img-ayuda">Lo guardado vuelve si regresas a la sección anterior. Se puede deshacer.</p> : null}
    </section>
  );
}
