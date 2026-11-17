import { TestnetBanner } from "@/components/TestnetBanner";
import { PageHeading } from "@/components/PageHeading";

export default function Forbidden() {
  return (
    <>
      <TestnetBanner />
      <main className="auth-card" id="main">
        <PageHeading
          title="Not allowed"
          lead="You are signed in, but this action is not permitted for your role."
        />
      </main>
    </>
  );
}
