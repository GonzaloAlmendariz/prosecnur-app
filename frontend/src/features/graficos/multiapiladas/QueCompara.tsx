// G12 parte 2 (Gonzalo aprobó la maqueta docs/qa/maqueta-editor-multiapiladas-2026-10-13.html): «Qué compara» pasa de
// cinco tarjetas grandes a una fila de opciones con una línea que describe la elegida.

export type OpcionQueCompara = { key: string; titulo: string; descripcion: string; deshabilitada?: string | null };

export function QueCompara({ opciones, activa, onElegir }: { opciones: readonly OpcionQueCompara[]; activa: string; onElegir: (key: string) => void }) {
  const actual = opciones.find((o) => o.key === activa);
  return (
    <div className="pulso-mapi-quecompara">
      <span className="pulso-mapi-rotulo" id="pulso-mapi-quecompara">Qué compara</span>
      <div className="pulso-mapi-segmentos" role="group" aria-labelledby="pulso-mapi-quecompara">
        {opciones.map((o) => (
          <button key={o.key} type="button" className="pulso-mapi-segmento" aria-pressed={o.key === activa}
                  disabled={!!o.deshabilitada} title={o.deshabilitada ?? o.descripcion} onClick={() => onElegir(o.key)}>
            {o.titulo}
          </button>
        ))}
      </div>
      {actual && <p className="pulso-mapi-desc">{actual.descripcion}</p>}
    </div>
  );
}
