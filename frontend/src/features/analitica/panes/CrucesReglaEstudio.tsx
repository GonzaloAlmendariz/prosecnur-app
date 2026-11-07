// La regla de diferencias del estudio en Analítica › Cruces (ADR 0128 D1): una tarjeta de sólo lectura. Las letras de
// estas tablas siguen la misma regla que las láminas y el Word; se cambia en Gráficos › Láminas (`panel=diferencias-regla`).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Scale } from "../../../vendor/lucide-react";
import { ApiError } from "../../../api/core";
import { getDiferenciasRegla, type ReglaDiferenciasRespuesta } from "../../../api/graficosDiferencias";
import { Alert } from "../../../components/Alert";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { DIRECCION_REGLA_ESTUDIO, filasRegla, origenRegla, textoErrorRegla } from "./reglaEstudioModel";
import "./crucesReglaEstudio.css";

type Lectura =
  | { estado: "cargando" }
  | { estado: "listo"; datos: ReglaDiferenciasRespuesta }
  | { estado: "error"; code: string; texto: string };

export function CrucesReglaEstudio() {
  const [lectura, setLectura] = useState<Lectura>({ estado: "cargando" });
  useEffect(() => {
    let vivo = true;
    getDiferenciasRegla()
      .then((datos) => { if (vivo) setLectura({ estado: "listo", datos }); })
      .catch((e: unknown) => {
        if (!vivo) return;
        const code = e instanceof ApiError ? e.code : "";
        const crudo = e instanceof Error ? e.message : String(e);
        setLectura({ estado: "error", code, texto: textoErrorRegla(code, code ? crudo.replace(` · ${code}`, "") : crudo) });
      });
    return () => { vivo = false; };
  }, []);
  return <CrucesReglaEstudioVista lectura={lectura} />;
}

/** La tarjeta por estado, sin red: lo que pintan los tests. */
export function CrucesReglaEstudioVista({ lectura }: { lectura: Lectura }) {
  const navigate = useNavigate();
  return (
    <Panel
      variant="subtle"
      className="analitica-regla-estudio"
      aria-label="Regla de diferencias del estudio"
      data-estado={lectura.estado}
      data-audit-ready={lectura.estado === "cargando" ? "false" : "analitica-regla-estudio"}
      data-qa-geometry-group="analitica/cruces-regla-estudio"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="analitica-regla-estudio-cabeza" data-qa-geometry-member="">
        <Scale size={14} aria-hidden="true" />
        <strong>Regla del estudio</strong>
        {lectura.estado === "listo" && (
          <span className={`analitica-regla-estudio-origen${origenRegla(lectura.datos.origen).propuesta ? " is-propuesta" : ""}`}>
            {origenRegla(lectura.datos.origen).rotulo}
          </span>
        )}
      </header>
      <div data-qa-geometry-member="">
        {lectura.estado === "cargando" && <CargaDeBloque label="Leyendo la regla del estudio…" />}
        {lectura.estado === "error" && (
          <div role="alert">
            <Alert kind="error">
              {lectura.texto}
              {lectura.code ? <span className="analitica-regla-estudio-codigo" title={lectura.code}> (error {lectura.code})</span> : null}
            </Alert>
          </div>
        )}
        {lectura.estado === "listo" && (
          <dl className="analitica-regla-estudio-filas">
            {filasRegla(lectura.datos.regla).map((f) => (
              <div key={f.rotulo}><dt>{f.rotulo}</dt><dd>{f.valor}</dd></div>
            ))}
          </dl>
        )}
      </div>
      <footer className="analitica-regla-estudio-pie" data-qa-geometry-member="">
        <p className="analitica-regla-estudio-texto">La misma regla gobierna las láminas, el Word y estas tablas.</p>
        <PulsoButton variant="secondary" size="sm" nav onClick={() => navigate(DIRECCION_REGLA_ESTUDIO)}>
          Cambiar la regla del estudio
        </PulsoButton>
      </footer>
    </Panel>
  );
}
