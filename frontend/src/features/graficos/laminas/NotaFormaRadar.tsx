// Bajo «Forma del gráfico» del radar entre públicos: qué dibujará el motor de verdad cuando no es la telaraña que la
// maqueta mostraba antes (menos de 5 criterios en automático) y los avisos de criterios (formaRadar.ts). Una línea cada uno.

import { criteriosDelRadar, formaEfectivaRadar } from "./formaRadar";

export function NotaFormaRadar({ args }: { args: Readonly<Record<string, unknown>> }) {
  const f = formaEfectivaRadar({ forma: args.forma, fallback_pocos: args.fallback_pocos, tabla: args.tabla, nCriterios: criteriosDelRadar(args) });
  if (!f.nota && !f.aviso) return null;
  return (
    <div className="pulso-f6-dato is-apilado" data-qa="nota-forma-radar">
      {f.nota && <span className="pulso-f6-dato-ayuda" role="note">{f.nota}</span>}
      {f.aviso && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{f.aviso}</span>}
    </div>
  );
}
