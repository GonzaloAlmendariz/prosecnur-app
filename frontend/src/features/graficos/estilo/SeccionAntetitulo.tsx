// El nombre de la sección sobre el título de cada lámina (Gonzalo, 2026-10-28): opción global del informe, apagada por
// defecto. Contrato con el motor: `estilo_cliente.antetitulo_seccion` (api/R/lamina_antetitulo_seccion.R); apagada no se
// guarda.

import type { EstiloCliente } from "../../../api/graficosEstilo";
import { Switch } from "../../../components/Switch";

export function leerAntetituloSeccion(e: EstiloCliente): boolean {
  const v = Array.isArray(e.antetitulo_seccion) ? e.antetitulo_seccion[0] : e.antetitulo_seccion;
  return v === true;
}

export function conAntetituloSeccion(e: EstiloCliente, activo: boolean): EstiloCliente {
  const out: EstiloCliente = { ...e };
  if (activo) out.antetitulo_seccion = true; else delete out.antetitulo_seccion;
  return out;
}

export function SeccionAntetitulo({ estilo, onCambiar }: { estilo: EstiloCliente; onCambiar: (f: (e: EstiloCliente) => EstiloCliente) => void }) {
  const activo = leerAntetituloSeccion(estilo);
  return (
    <section className="pulso-f6-estilo-seccion" aria-labelledby="f6-estilo-antetitulo-titulo" data-qa-geometry-member>
      <header className="pulso-f6-estilo-seccion-cabecera">
        <h3 id="f6-estilo-antetitulo-titulo">Nombre de la sección</h3>
      </header>
      <div className="pulso-f6-leg-fila-ajuste">
        <label htmlFor="f6-estilo-antetitulo-seccion">Sobre el título de cada lámina</label>
        <Switch id="f6-estilo-antetitulo-seccion" checked={activo} ariaLabel="Nombre de la sección sobre el título de cada lámina"
          onToggle={() => onCambiar((e) => conAntetituloSeccion(e, !leerAntetituloSeccion(e)))} />
      </div>
    </section>
  );
}
