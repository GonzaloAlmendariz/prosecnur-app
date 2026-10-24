// Bajo «Forma del gráfico» del radar entre públicos: qué dibujará el motor de verdad cuando no es la telaraña que la
// maqueta mostraba antes (menos de 5 criterios en automático) y los avisos de criterios (formaRadar.ts). Una línea cada uno.

import { criteriosDelRadar, formaEfectivaRadar } from "./formaRadar";

export function NotaFormaRadar({ args }: { args: Readonly<Record<string, unknown>> }) {
  const f = formaEfectivaRadar({ forma: args.forma, fallback_pocos: args.fallback_pocos, tabla: args.tabla, nCriterios: criteriosDelRadar(args) });
  // Con otra forma que la telaraña, «Automática» de la tabla es «sin tabla»: se dice, para que no suene contradictorio.
  const tablaAuto = f.forma !== "radar" && args.tabla !== "si" && args.tabla !== "no" ? "Con esta forma, Automática es sin tabla; elige «Sí» para verla." : null;
  if (!f.nota && !f.aviso && !tablaAuto) return null;
  return (
    <div className="pulso-f6-dato is-apilado" data-qa="nota-forma-radar">
      {f.nota && <span className="pulso-f6-dato-ayuda is-nota" role="note">{f.nota}</span>}
      {tablaAuto && <span className="pulso-f6-dato-ayuda is-nota" role="note">{tablaAuto}</span>}
      {f.aviso && <span className="pulso-f6-dato-ayuda is-aviso" role="note">{f.aviso}</span>}
    </div>
  );
}
