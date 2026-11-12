// "Lo usan" (prototipo, Analítica › Dimensiones): los módulos que leen la
// columna del puntaje. El motor no publica qué tablas o láminas concretas la
// usan; se nombra dónde se puede usar.

import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";

export function LoUsan({ columna }: { columna: string | null }) {
  const usos = [
    { modulo: "Cruces", detalle: "Modo Dimensiones" },
    { modulo: "Gráficos", detalle: columna ? `Columna ${columna}` : "Columnas de los índices" },
    { modulo: "Dashboard", detalle: "Pestaña Dimensiones" },
  ];
  return (
    <PanelDeMesa zona="usos" titulo="Lo usan">
      <ul className="dimensiones-usos" aria-label="Módulos que usan el puntaje">
        {usos.map((u) => (
          <li key={u.modulo}>
            <span className="dimensiones-usos-punto" aria-hidden="true" />
            <span>
              <b>{u.modulo}</b>
              <small>{u.detalle}</small>
            </span>
          </li>
        ))}
      </ul>
    </PanelDeMesa>
  );
}
