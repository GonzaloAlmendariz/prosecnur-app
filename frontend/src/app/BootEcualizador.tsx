import "./boot-ecualizador.css";

/**
 * El isotipo «Ecualizador del pulso» como indicador del warm start (4 nov 2026, dirección A de la maqueta
 * «Pantalla de carga de proyecto», revisable por Gonzalo). Reemplaza al anillo con porcentaje: la cifra
 * vive en la barra del kit, que es la que se lee y la que anuncia el avance a lectores de pantalla. Aquí
 * las cuatro pastillas laten con la firma de arranque (escalonado de 30 ms, el tope del contrato de movimiento; curva productiva). Con
 * movimiento reducido quedan quietas, y en error dejan de latir (`detenido`).
 */
export function BootEcualizador({ detenido = false }: { detenido?: boolean }) {
  return (
    <span className={`boot-eq${detenido ? " is-detenido" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="72" height="72">
        <rect width="64" height="64" rx="15.4" fill="var(--pulso-primary)" />
        <rect className="boot-eq-bar" x="12" y="30" width="7" height="18" rx="3.5" fill="#fff" />
        <rect className="boot-eq-bar" x="23" y="22" width="7" height="26" rx="3.5" fill="#fff" />
        <rect className="boot-eq-bar" x="34" y="28" width="7" height="20" rx="3.5" fill="#fff" />
        <rect className="boot-eq-bar" x="45" y="16" width="7" height="32" rx="3.5" fill="#fff" />
      </svg>
    </span>
  );
}
