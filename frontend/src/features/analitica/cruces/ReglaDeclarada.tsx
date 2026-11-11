// La regla de diferencias DECLARADA del estudio (ADR 0128), en solo lectura.
// Se muestra cuando la vista previa no dice qué regla aplicó: sin tablas, con
// la vista previa en error o con todas las letras sin comparar. Se lee de
// `getDiferenciasRegla`, con su carga y su error, como la mostraba Cruces antes.

import { useEffect, useState } from "react";

import { ApiError } from "../../../api/core";
import { splitErrorDetail } from "../../../components/errorPresentation";
import { getDiferenciasRegla, type ReglaDiferenciasRespuesta } from "../../../api/graficosDiferencias";
import { filasRegla, origenRegla, textoErrorRegla } from "../panes/reglaEstudioModel";

type Lectura =
  | { estado: "cargando" }
  | { estado: "listo"; datos: ReglaDiferenciasRespuesta }
  | { estado: "error"; texto: string };

export function ReglaDeclarada() {
  const [lectura, setLectura] = useState<Lectura>({ estado: "cargando" });
  useEffect(() => {
    let vivo = true;
    getDiferenciasRegla()
      .then((datos) => { if (vivo) setLectura({ estado: "listo", datos }); })
      .catch((e: unknown) => {
        if (!vivo) return;
        const codigo = e instanceof ApiError ? e.code : "";
        const crudo = e instanceof Error ? e.message : String(e);
        setLectura({ estado: "error", texto: textoErrorRegla(codigo, codigo ? splitErrorDetail(crudo).message : crudo) });
      });
    return () => { vivo = false; };
  }, []);

  if (lectura.estado === "cargando") return <p className="tablas-nota">Leyendo la regla del estudio</p>;
  if (lectura.estado === "error") return <p className="tablas-nota" role="alert">{lectura.texto}</p>;
  const origen = origenRegla(lectura.datos.origen);
  return (
    <dl className="cruces-regla-filas" aria-label="Regla del estudio, sin aplicar en estas tablas">
      <div><dt>Origen</dt><dd>{origen.propuesta ? "Propuesta de la app; el estudio no declaró la suya" : "Declarada en el estudio"}</dd></div>
      {/* La base mínima con la misma redacción que la regla aplicada: se compara con casos sin ponderar. */}
      {filasRegla(lectura.datos.regla).map((f) => ({ ...f, valor: f.valor.replace(" casos por columna", " casos sin ponderar por columna") })).map((f) => (
        <div key={f.rotulo}><dt>{f.rotulo}</dt><dd>{f.valor}</dd></div>
      ))}
    </dl>
  );
}
