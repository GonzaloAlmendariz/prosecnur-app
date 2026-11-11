import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { formatoConteo } from "../../../lib/formatoNumero";
import { Plus } from "../../../vendor/lucide-react";
import { RotuloCodigo } from "./RotuloCodigo";
import { posicionDeLista, type OpcionLista } from "./tablaCodificarModelo";
import "./tablaCodificar.css";

export type ListaCodigosProps = {
  /** Id del listbox: el campo lo nombra en `aria-controls` y arma con él `aria-activedescendant`. */
  id: string;
  /** El campo de la fila activa: la lista se coloca debajo, o encima si abajo no cabe. */
  ancla: RefObject<HTMLInputElement | null>;
  opciones: readonly OpcionLista[];
  cursor: number;
  /** Lo escrito, para decir qué no se encontró. */
  consulta: string;
  /** Nombre accesible de la lista. */
  etiqueta: string;
  onCursor: (indice: number) => void;
  onElegir: (indice: number, conMayus: boolean) => void;
  onCerrar: () => void;
};

/** Id de una opción a partir del id de su lista. */
export function idDeOpcion(lista: string, indice: number): string {
  return `${lista}-op-${indice}`;
}

/**
 * La lista de códigos de la fila activa. Va en portal y en `position: fixed`: la tabla desplaza dentro de
 * un marco que recortaría cualquier hijo posicionado. El foco no sale del campo; la opción resaltada se
 * anuncia por `aria-activedescendant`.
 */
export function ListaCodigos({ id, ancla, opciones, cursor, consulta, etiqueta, onCursor, onElegir, onCerrar }: ListaCodigosProps) {
  const [estilo, setEstilo] = useState<CSSProperties | null>(null);
  const lista = useRef<HTMLDivElement | null>(null);

  const colocar = useCallback(() => {
    const campo = ancla.current;
    if (!campo || !campo.isConnected) {
      onCerrar();
      return;
    }
    setEstilo(posicionDeLista(campo.getBoundingClientRect(), { ancho: window.innerWidth, alto: window.innerHeight }));
  }, [ancla, onCerrar]);

  useLayoutEffect(() => {
    colocar();
  }, [colocar]);

  // La lista sigue a su campo si algo desplaza o cambia de tamaño. No se cierra: cerrarla mientras se
  // escribe dejaría el Enter sin opción que asignar.
  useEffect(() => {
    const alMover = (evento: Event) => {
      if (evento.target instanceof Node && lista.current?.contains(evento.target)) return;
      colocar();
    };
    window.addEventListener("scroll", alMover, true);
    window.addEventListener("resize", alMover);
    return () => {
      window.removeEventListener("scroll", alMover, true);
      window.removeEventListener("resize", alMover);
    };
  }, [colocar]);

  useEffect(() => {
    const opcion = lista.current?.querySelector<HTMLElement>(`[data-indice="${cursor}"]`);
    if (opcion && typeof opcion.scrollIntoView === "function") opcion.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!estilo || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={lista}
      className="pulso-select-content pulso-ct-lista"
      style={estilo}
      // `mousedown` no le quita el foco al campo: ni al elegir ni al arrastrar la barra de la lista.
      onMouseDown={(evento) => evento.preventDefault()}
    >
      {opciones.length === 0 ? (
        <p className="pulso-ct-sin-codigos" role="status">
          Ningún código coincide con "{consulta.trim()}"
        </p>
      ) : (
        <div id={id} className="pulso-select-viewport" role="listbox" aria-label={etiqueta}>
          {opciones.map((opcion, i) => {
            const resaltada = i === cursor;
            return (
              <div
                key={opcion.tipo === "crear" ? "__crear" : opcion.codigo.id}
                id={idDeOpcion(id, i)}
                role="option"
                aria-selected={resaltada}
                data-indice={i}
                data-highlighted={resaltada ? "" : undefined}
                className={`pulso-select-item pulso-ct-opcion${opcion.tipo === "crear" ? " pulso-ct-opcion--crear" : ""}`}
                onMouseEnter={() => onCursor(i)}
                onClick={(evento) => onElegir(i, evento.shiftKey)}
              >
                {opcion.tipo === "crear" ? (
                  <>
                    <Plus size={13} aria-hidden="true" />
                    <span className="pulso-ct-nombre">Crear el código "{opcion.nombre}"</span>
                  </>
                ) : (
                  <>
                    <RotuloCodigo codigo={opcion.codigo} />
                    {opcion.aviso ? (
                      <span className={`pulso-cv2-qa-marcada${opcion.aviso.todas ? " is-todas" : ""}`} title={opcion.aviso.detalle}>
                        {opcion.aviso.etiqueta}
                      </span>
                    ) : null}
                    <span className="pulso-ct-casos">
                      {formatoConteo(opcion.codigo.casos)} {opcion.codigo.casos === 1 ? "caso" : "casos"}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>,
    document.body,
  );
}
