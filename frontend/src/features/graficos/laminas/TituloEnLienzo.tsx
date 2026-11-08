// El título de la lámina editable en el lienzo (hallazgo 12, modeloTituloLienzo.ts). En reposo es un botón con borde del
// acento al pasar el cursor; con un clic se vuelve un campo en el mismo lugar: Enter guarda, Escape cancela y salir del
// campo guarda. El campo nace con lo escrito o vacío, con el marcador «Título»: nunca un título sugerido.
// `maqueta`: dentro de la cabecera de la maqueta, con su letra. `zona`: sobre la imagen del motor, en la caja del título.

import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { ControlTituloLienzo } from "./modeloTituloLienzo";
import "./tituloLienzo.css";

type Props = ControlTituloLienzo & {
  /** Lo que se ve en reposo (el título que sale, o el marcador si no hay ninguno). */
  mostrado: ReactNode;
  variante: "maqueta" | "zona";
  /** Caja de la zona sobre la imagen, en fracciones de la hoja. */
  estilo?: CSSProperties;
};

export function TituloEnLienzo({ valor, editando, onEditar, onGuardar, onCancelar, mostrado, variante, estilo }: Props) {
  const campoRef = useRef<HTMLInputElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  // Escape cierra el campo; el blur que sigue no debe guardar lo que se canceló.
  const cerrandoRef = useRef(false);
  const estabaEditando = useRef(editando);

  useEffect(() => {
    if (editando) {
      cerrandoRef.current = false;
      const campo = campoRef.current;
      campo?.focus({ preventScroll: true });
      campo?.select();
    } else if (estabaEditando.current) {
      // Al cerrar, el foco vuelve al título (si no se fue a otro control): el teclado no queda en el vacío.
      const activo = document.activeElement;
      if (!activo || activo === document.body) botonRef.current?.focus({ preventScroll: true });
    }
    estabaEditando.current = editando;
  }, [editando]);

  const onTecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // ⌘↵ / Ctrl+↵ también guarda, y el atajo «Siguiente sin título» lo atiende después en `document`: con ellos no se
      // llama a preventDefault. Enter solo sí (R5-3): al guardar vuelve el botón del título con el foco, y la acción por
      // defecto del Enter lo activaba y reabría el campo.
      if (!e.metaKey && !e.ctrlKey) e.preventDefault();
      cerrandoRef.current = true;
      onGuardar(e.currentTarget.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Que el Escape no cierre además el inspector ni suelte la ranura del lienzo.
      e.stopPropagation();
      cerrandoRef.current = true;
      onCancelar();
    }
  };

  // En reposo hereda la piel de las zonas que ya existen: la de la maqueta (borde del acento al pasar) o la de las zonas
  // sobre la imagen (marco y rótulo «Título» al pasar).
  const piel = variante === "maqueta" ? "pulso-f6-maqueta-zona pulso-f6-maqueta-titulo" : "pulso-f6-ranura-zona pulso-f6-texto-zona";
  const clase = `pulso-f6-titulo-lienzo is-${variante}`;
  if (editando) {
    return (
      <span className={`${clase} is-editando`} style={estilo}>
        <input
          ref={campoRef}
          className="pulso-f6-titulo-lienzo-campo"
          defaultValue={valor}
          placeholder="Título"
          aria-label="Título de la lámina"
          autoComplete="off"
          spellCheck
          onKeyDown={onTecla}
          onBlur={(e) => { if (!cerrandoRef.current) onGuardar(e.currentTarget.value); }}
        />
      </span>
    );
  }
  return (
    <button
      ref={botonRef}
      type="button"
      className={`${piel} ${clase}`}
      style={estilo}
      aria-label={valor ? `Editar título: ${valor}` : "Escribir el título"}
      onClick={onEditar}
    >
      {variante === "zona" ? <span className="pulso-f6-ranura-etiqueta" aria-hidden="true">Título</span> : mostrado}
    </button>
  );
}
