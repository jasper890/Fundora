import { TestnetBanner } from "@/components/TestnetBanner";
import { PageHeading } from "@/components/PageHeading";

export default function NotFound() {
  return (
    <>
      <TestnetBanner />
      <main className="auth-card" id="main">
        <PageHeading
          title="Not found"
          lead="That page is not available for this account."
        />
      </main>
    </>
  );
}
