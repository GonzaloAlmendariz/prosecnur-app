import { useMemo } from "react";
import { ArgGrupo, GraficadorRef } from "../../api/client";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { useVariables } from "./useVariables";
import { ArgGroup, GRUPO_META } from "./ArgGroup";

// Formulario dinámico de un graficador. Ya no hay switch/case por tipo:
// leemos el metadata del registry y renderizamos cada arg con ArgField,
// agrupado por `grupo` (Datos / Textos / Cálculo / Semáforo / Estilo /
// Avanzado). El orden de los grupos está definido en GRUPO_META.
//
// Si el metadata no cubre todos los args reales del graficador (ej. args
// de dimensiones/canvas muy específicos), los defaults del backend
// aplican — la UI simplemente no los muestra.

type Props = {
  graf: GraficadorRef;
  onArgs: (patch: Record<string, unknown>) => void;
};

export default function GraficadorForm({ graf, onArgs }: Props) {
  const { graficadoresById, loading, error } = useGraficosRegistry();
  const { variables } = useVariables();

  const meta = graficadoresById[graf.graficador];

  // Agrupar args por grupo semántico y ordenar por GRUPO_META.order.
  const grupos = useMemo(() => {
    if (!meta) return [];
    const byGrupo: Record<ArgGrupo, typeof meta.args> = {
      datos: [], textos: [], estilo: [], calculo: [], semaforo: [], avanzado: [],
    };
    for (const a of meta.args) {
      const g: ArgGrupo = (a.grupo as ArgGrupo) ?? "avanzado";
      (byGrupo[g] ?? byGrupo.avanzado).push(a);
    }
    return (Object.keys(byGrupo) as ArgGrupo[])
      .filter((g) => byGrupo[g].length > 0)
      .sort((a, b) => GRUPO_META[a].order - GRUPO_META[b].order)
      .map((g) => ({ grupo: g, args: byGrupo[g] }));
  }, [meta]);

  if (loading) {
    return <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", padding: 10 }}>Cargando opciones…</div>;
  }
  if (error) {
    return <div style={{ fontSize: 12, color: "#b91c1c", padding: 10 }}>Error: {error}</div>;
  }
  if (!meta) {
    return (
      <div style={{ fontSize: 12, color: "#b91c1c", padding: 10 }}>
        Graficador desconocido: <code>{graf.graficador}</code>
      </div>
    );
  }

  return (
    <div>
      {grupos.map(({ grupo, args }) => (
        <ArgGroup
          key={grupo}
          grupo={grupo}
          args={args}
          values={graf.args}
          onChangeArg={(name, value) => onArgs({ [name]: value })}
          variables={variables}
        />
      ))}
    </div>
  );
}
