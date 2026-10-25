import { ALERTAS, type ClaveDeAlerta } from "./reglasModelo";

/** Tarjeta «Alertas» de Insumos › Reglas: los cinco umbrales del perfil. */
export function Alertas({
  valores,
  onCambiar,
  bloqueada,
}: {
  valores: Record<ClaveDeAlerta, string>;
  onCambiar: (clave: ClaveDeAlerta, valor: string) => void;
  bloqueada: boolean;
}) {
  return (
    <section className="acr-av-panel acr-rg-tarjeta" aria-label="Alertas" data-qa-geometry-member>
      <header className="acr-av-panel-cabecera"><h3>Alertas</h3></header>
      <ul className="acr-rg-cuerpo acr-rg-alertas">
        {ALERTAS.map((alerta) => (
          <li key={alerta.clave}>
            <span>{alerta.rotulo}</span>
            <span className="acr-mo-entrada">
              <input inputMode="decimal" value={valores[alerta.clave]} onChange={(event) => onCambiar(alerta.clave, event.currentTarget.value)} aria-label={`${alerta.rotulo} ${alerta.unidad}`} disabled={bloqueada} />
            </span>
            <span className="acr-av-tenue">{alerta.unidad}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
