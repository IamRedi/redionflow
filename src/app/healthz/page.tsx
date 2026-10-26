export const dynamic = "force-static";

const HEALTH_OK = "OK";
const HEALTH_PAGE_LABEL = "healthz page";

export default function HealthzPage() {
  return (
    <main style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <h1>{HEALTH_OK}</h1>
      <p>{HEALTH_PAGE_LABEL}</p>
    </main>
  );
}
