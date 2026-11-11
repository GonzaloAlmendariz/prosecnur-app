// El detalle de la pregunta elegida: su ficha, el campo que se crea y la tabla de
// sus códigos (código, categoría, origen y respuestas). Es el desglose por código:
// los totales de la pregunta están en su fila de la lista y aquí no se repiten.
//
// La tabla es una rejilla con roles de tabla, como la vista de tabla de Codificar,
// y no `PulsoTable`: la categoría tiene que leerse entera y partir en renglones
// (PulsoTable deja una línea por celda), las columnas reparten el ancho del panel
// (PulsoTable las fija en px) y el dueño del scroll es el panel, sin tope propio.
//
// C1: el cuerpo de la tabla es el contenedor de datos y declara su contrato. La
// tabla es la dueña del scroll de este panel y su cabecera queda fija; como no
// tiene controles dentro, recibe el foco para desplazarla con el teclado.

import type { CSSProperties } from "react";

import type { PlanPregunta } from "../../../api/dashboard";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { Tags } from "../../../vendor/lucide-react";
import { FichaDePlan } from "./FichaDePlan";
import { codigosDeDetalle, etiquetaDePregunta, ROTULO_DE_ORIGEN, tipoDeFicha } from "./modeloAplicar";
import { PanelAplicar } from "./PanelAplicar";

export function DetalleAplicar({ id, pregunta }: { id: string; pregunta: PlanPregunta }) {
  const codigos = codigosDeDetalle(pregunta);
  const campo = (pregunta.nueva_variable ?? "").trim();
  return (
    <PanelAplicar
      id={id}
      variante="detalle"
      titulo="Códigos de la pregunta"
      icono={<Tags size={16} />}
      aria-label={`Códigos de ${pregunta.parent}`}
    >
      <div className="pulso-aplicar-detalle-cab">
        <FichaDePlan tipo={tipoDeFicha(pregunta.tipo)} codigo={pregunta.parent} etiqueta={etiquetaDePregunta(pregunta)} />
        {campo ? (
          <p className="pulso-aplicar-detalle-campo">
            <span className="pulso-aplicar-rotulo">{pregunta.tipo === "select_multiple" ? "Campos nuevos" : "Campo nuevo"}</span>
            <code className="pulso-aplicar-campo">{campo}</code>
          </p>
        ) : null}
      </div>
      {codigos.length > 0 ? (
        <div
          className="pulso-aplicar-codigos"
          role="table"
          aria-label={`Códigos de ${pregunta.parent}`}
          aria-rowcount={codigos.length + 1}
          tabIndex={0}
        >
          <div role="rowgroup" className="pulso-aplicar-codigos-cab">
            <div role="row" className="pulso-aplicar-codigos-fila">
              <span role="columnheader" className="pulso-aplicar-col-codigo">Código</span>
              <span role="columnheader" className="pulso-aplicar-col-categoria">Categoría</span>
              <span role="columnheader" className="pulso-aplicar-col-origen">Origen</span>
              <span role="columnheader" className="pulso-aplicar-col-respuestas">Respuestas</span>
            </div>
          </div>
          <div
            role="rowgroup"
            className="pulso-aplicar-codigos-cuerpo"
            data-qa-geometry-group="codificacion/aplicar-codigos"
            data-qa-geometry-contract="intrinsic"
          >
            {codigos.map((c) => (
              <div key={c.id} role="row" className="pulso-aplicar-codigos-fila pulso-aplicar-codigo" data-origen={c.origen}>
                <code role="cell" className="pulso-aplicar-col-codigo">{c.codigo}</code>
                <span role="cell" className="pulso-aplicar-col-categoria" data-sin-etiqueta={c.etiqueta ? undefined : ""}>
                  {c.etiqueta || "Sin etiqueta"}
                </span>
                <span role="cell" className="pulso-aplicar-col-origen">
                  <span className="pulso-aplicar-origen">{ROTULO_DE_ORIGEN[c.origen]}</span>
                </span>
                <span role="cell" className="pulso-aplicar-col-respuestas">
                  {/* La barra acompaña a la cifra, que es el dato: sin respuestas no hay barra. */}
                  <span className="pulso-aplicar-barra" aria-hidden="true">
                    {c.proporcion > 0 ? (
                      <span style={{ "--pulso-aplicar-proporcion": String(c.proporcion) } as CSSProperties} />
                    ) : null}
                  </span>
                  <span className="pulso-aplicar-cifra">{c.respuestas}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EstadoVacio
          icono={<Tags size={16} />}
          titulo="Sin desglose por código"
          descripcion="No se recibió la lista de códigos de esta pregunta."
        />
      )}
    </PanelAplicar>
  );
}
