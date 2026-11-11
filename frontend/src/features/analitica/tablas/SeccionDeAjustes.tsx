// Un ajuste del archivo con su rótulo. Las secciones se separan con una línea;
// el marco es el del panel que las contiene.

import { useId, type ReactNode } from "react";

export function SeccionDeAjustes({ titulo, idDelTitulo, accion, children }: {
  titulo: string;
  /** Para que un control de la sección tome el título como su nombre (`aria-labelledby`). */
  idDelTitulo?: string;
  /** Una acción sobre toda la sección, al final del renglón del título. */
  accion?: ReactNode;
  children: ReactNode;
}) {
  const propio = useId();
  const id = idDelTitulo ?? propio;
  return (
    <section className="tablas-seccion" aria-labelledby={id}>
      <div className="tablas-seccion-cabecera">
        <h4 id={id} className="tablas-seccion-titulo">{titulo}</h4>
        {accion}
      </div>
      {children}
    </section>
  );
}
