import { Suspense, useEffect, useState } from "react";
import { Alert } from "../components/Alert";
import { LoadingBlock } from "../components/States";
import { apiPublicArtifact, type PublicArtifactDescriptor } from "../api/client";
import { lazyWithReload } from "../lib/lazyWithReload";
import MonitoreoPublicReportPage from "../features/monitoreo/public/MonitoreoPublicReportPage";

const DashboardPage = lazyWithReload(
  () => import("../features/dashboard/DashboardPage"),
  "DashboardPage",
);

export default function PublicArtifactApp() {
  const [artifact, setArtifact] = useState<PublicArtifactDescriptor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiPublicArtifact()
      .then((next) => {
        if (!cancelled) setArtifact(next);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingBlock label="Cargando publicacion..." />;

  if (error) {
    return (
      <div className="pulso-public-artifact-error">
        <Alert kind="error">{error}</Alert>
      </div>
    );
  }

  if (artifact?.kind === "monitoreo") {
    return <MonitoreoPublicReportPage artifact={artifact} />;
  }

  return (
    <Suspense fallback={<LoadingBlock label="Cargando dashboard..." />}>
      <DashboardPage publicMode />
    </Suspense>
  );
}
