/** Piezas compartidas de las escenas del relato: cifra, huecos declarados. */

export function RelatoCifra({
  label,
  valor,
  detalle,
  realce = false,
}: {
  label: string;
  valor: string;
  detalle?: string;
  realce?: boolean;
}) {
  return (
    <div className={`cmv2-relato-cifra${realce ? " is-realce" : ""}`}>
      <strong>{valor}</strong>
      <span>{label}</span>
      {detalle ? <small>{detalle}</small> : null}
    </div>
  );
}

/**
 * C5/ADR 0067: lo que la corrida no registró se declara, nunca se dramatiza.
 * Cada hueco nombra el dato ausente; la lista vacía no pinta nada.
 */
export function RelatoHuecos({ huecos }: { huecos: string[] }) {
  if (!huecos.length) return null;
  return (
    <ul className="cmv2-relato-huecos" aria-label="Datos no registrados por la corrida">
      {huecos.map((hueco) => (
        <li key={hueco}>{hueco}</li>
      ))}
    </ul>
  );
}
