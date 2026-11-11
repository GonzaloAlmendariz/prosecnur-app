import { forwardRef, useCallback, useId, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { MarcaPrevia } from "../../../api/codificacion";
import { PulsoInput } from "../../../components/PulsoInput";
import { ListaCodigos, idDeOpcion } from "../tabla/ListaCodigos";
import { opcionesDeLista, type CodigoTabla, type FilaTabla } from "../tabla/tablaCodificarModelo";

export type AsignarACodigoProps = {
  codigos: readonly CodigoTabla[];
  /** Códigos que ya llevan todas las respuestas del lote: no se ofrecen. */
  comunes: readonly CodigoTabla[];
  /** Marcas previas del lote y las veces que suma, para el aviso de "ya marcada" de cada código. */
  marcas: readonly MarcaPrevia[];
  veces: number;
  /** Cuántas respuestas recibirán el código, para el nombre accesible. */
  seleccionadas: number;
  onAsignar: (grupoId: string) => void;
  onCrear: (nombre: string) => void;
  /** Escape con el campo vacío y la lista cerrada: el foco vuelve a la lista de respuestas. */
  onSalir: () => void;
};

export type AsignarACodigoRef = { enfocar: () => void };

/**
 * El campo de la barra de selección: se escribe el número o parte del nombre de un código y la lista se
 * filtra, igual que en la vista de tabla (misma lista, mismas opciones y la misma opción de crear).
 */
export const AsignarACodigo = forwardRef<AsignarACodigoRef, AsignarACodigoProps>(function AsignarACodigo(
  { codigos, comunes, marcas, veces, seleccionadas, onAsignar, onCrear, onSalir },
  ref,
) {
  const [texto, setTexto] = useState("");
  const [abierta, setAbierta] = useState(false);
  const [cursorElegido, setCursorElegido] = useState(0);
  const campo = useRef<HTMLInputElement | null>(null);
  const listaId = `${useId()}-codigos`;

  useImperativeHandle(ref, () => ({
    enfocar: () => {
      campo.current?.focus({ preventScroll: true });
      setAbierta(true);
    },
  }));

  const lote: FilaTabla = useMemo(
    () => ({ clave: "", texto: "", titulo: "", veces, variantes: 1, codigos: [...comunes], noResponde: false, yaMarcadas: marcas }),
    [comunes, marcas, veces],
  );
  const opciones = useMemo(() => (abierta ? opcionesDeLista(codigos, lote, texto) : []), [abierta, codigos, lote, texto]);
  const cursor = opciones.length ? Math.min(cursorElegido, opciones.length - 1) : 0;

  // Estable: la lista se recoloca cada vez que cambia esta función.
  const cerrar = useCallback(() => {
    setAbierta(false);
    setCursorElegido(0);
  }, []);

  function elegir(indice: number) {
    const opcion = opciones[indice];
    if (!opcion) return;
    setTexto("");
    cerrar();
    if (opcion.tipo === "crear") onCrear(opcion.nombre);
    else onAsignar(opcion.codigo.id);
  }

  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.nativeEvent.isComposing) return;
    // Las teclas del campo no llegan a la lista de respuestas ni al deshacer de la mesa.
    evento.stopPropagation();
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      if (!abierta) setAbierta(true);
      else if (opciones.length) setCursorElegido((cursor + (evento.key === "ArrowDown" ? 1 : -1) + opciones.length) % opciones.length);
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      if (abierta && opciones.length) elegir(cursor);
      else setAbierta(true);
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      if (abierta) cerrar();
      else if (texto) setTexto("");
      else onSalir();
    }
  }

  return (
    <>
      <PulsoInput
        ref={campo}
        size="sm"
        className="pulso-cc-asignar"
        role="combobox"
        aria-label={seleccionadas === 1 ? "Asignar la respuesta seleccionada a un código" : `Asignar las ${seleccionadas} respuestas seleccionadas a un código`}
        aria-expanded={abierta}
        aria-controls={abierta && opciones.length ? listaId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={abierta && opciones.length ? idDeOpcion(listaId, cursor) : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder="Asignar a un código"
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value);
          setAbierta(true);
          setCursorElegido(0);
        }}
        onKeyDown={alTeclear}
        onClick={() => setAbierta(true)}
        onBlur={cerrar}
      />
      {abierta && (opciones.length > 0 || texto.trim() !== "") ? (
        <ListaCodigos
          id={listaId}
          ancla={campo}
          opciones={opciones}
          cursor={cursor}
          consulta={texto}
          etiqueta="Códigos de la pregunta"
          onCursor={setCursorElegido}
          onElegir={(indice) => elegir(indice)}
          onCerrar={cerrar}
        />
      ) : null}
    </>
  );
});
