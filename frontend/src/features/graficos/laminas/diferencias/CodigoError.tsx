// El código `E_*` y el `error_id` de un fallo: en la letra del sistema, entre paréntesis, con el valor técnico completo
// en `title` (P8: la monoespaciada es para código, no para metadatos).

type Props = { code?: string | null; errorId?: string | null };

export function CodigoError({ code, errorId }: Props) {
  if (!code && !errorId) return null;
  const partes = [code ? `error ${code}` : null, errorId ? `id ${errorId}` : null].filter(Boolean).join(", ");
  return (
    <span className="pulso-sig-codigo-error" title={[code, errorId].filter(Boolean).join(", ")}>
      {" "}({partes})
    </span>
  );
}
