import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, User } from "../../../vendor/lucide-react";
import {
  apiConnectionCheck,
  apiConnectionProfileSetDefault,
  apiConnectionProfilesList,
  type ConnectionProfileState,
} from "../../../api/multiIntegrado";
import { perfilesAlternativosSm } from "./smImportModel";
import "../styles/xfSmImport";

// Cuando SurveyMonkey rechaza el token, la salida está en el mismo lugar (U2):
// los otros perfiles guardados se prueban antes de activarse; si no hay otro,
// se dice dónde se cambia el token. Activar un perfil cambia el predeterminado
// de la conexión, como en Configuración › Conexiones.

type EstadoPerfil = { id: string; fase: "probando" | "rechazado" | "error"; mensaje?: string };

export function SmPerfilesRescate({
  rechazado,
  perfilActivoId,
  perfilActivoAlias,
  onActivado,
}: {
  /** 401: el token venció o fue revocado. Otro error: SurveyMonkey no respondió. */
  rechazado: boolean;
  perfilActivoId?: string | null;
  perfilActivoAlias?: string | null;
  onActivado: (alias: string) => Promise<void> | void;
}) {
  const [perfiles, setPerfiles] = useState<ConnectionProfileState[] | null>(null);
  const [estado, setEstado] = useState<EstadoPerfil | null>(null);

  useEffect(() => {
    let cancelado = false;
    apiConnectionProfilesList("surveymonkey")
      .then((r) => {
        if (!cancelado) setPerfiles(r.profiles);
      })
      .catch(() => {
        if (!cancelado) setPerfiles([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function usarPerfil(perfil: ConnectionProfileState) {
    setEstado({ id: perfil.id, fase: "probando" });
    try {
      const prueba = await apiConnectionCheck("surveymonkey", { profile_id: perfil.id });
      if (!prueba.ok) {
        setEstado({
          id: perfil.id,
          fase: "rechazado",
          mensaje: prueba.status_code === 401
            ? `SurveyMonkey también rechazó el token de «${perfil.alias}».`
            : `No se pudo comprobar «${perfil.alias}»: ${prueba.error}`,
        });
        return;
      }
      await apiConnectionProfileSetDefault("surveymonkey", perfil.id);
      setEstado(null);
      await onActivado(perfil.alias);
    } catch (e) {
      setEstado({ id: perfil.id, fase: "error", mensaje: String((e as Error)?.message ?? e) });
    }
  }

  const alternativos = perfiles ? perfilesAlternativosSm(perfiles, perfilActivoId) : [];
  const nombreActivo = perfilActivoAlias?.trim();
  const causa = rechazado
    ? `SurveyMonkey rechazó el token${nombreActivo ? ` del perfil «${nombreActivo}»` : ""}: venció o fue revocado.`
    : "SurveyMonkey no respondió a la prueba de conexión.";

  return (
    <div className="pulso-xf-smi-rescate" role="alert">
      <p className="pulso-xf-smi-rescate-causa">
        <AlertTriangle size={14} aria-hidden />
        <span>{causa}</span>
      </p>
      {perfiles === null ? (
        <p className="pulso-xf-smi-rescate-nota">Buscando otros perfiles guardados…</p>
      ) : alternativos.length ? (
        <>
          <p className="pulso-xf-smi-rescate-nota">Puedes seguir con otro perfil guardado:</p>
          <ul className="pulso-xf-smi-rescate-perfiles">
            {alternativos.map((perfil) => {
              const propio = estado?.id === perfil.id ? estado : null;
              return (
                <li key={perfil.id}>
                  <button
                    type="button"
                    onClick={() => void usarPerfil(perfil)}
                    disabled={estado?.fase === "probando"}
                    aria-busy={propio?.fase === "probando" || undefined}
                  >
                    {propio?.fase === "probando" ? <RefreshCw size={13} aria-hidden className="is-girando" /> : <User size={13} aria-hidden />}
                    {propio?.fase === "probando" ? `Probando «${perfil.alias}»…` : `Usar perfil ${perfil.alias}`}
                  </button>
                  {perfil.masked_token ? <code>{perfil.masked_token}</code> : null}
                  {propio?.mensaje ? <span className="pulso-xf-smi-rescate-error">{propio.mensaje}</span> : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      <p className="pulso-xf-smi-rescate-nota">
        {alternativos.length ? "O pega" : "Pega"} un token nuevo arriba, o cámbialo en Configuración › Conexiones desde el inicio del proyecto.
      </p>
    </div>
  );
}
