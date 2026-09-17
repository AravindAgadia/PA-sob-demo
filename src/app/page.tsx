import { IntakeFlow } from "@/components/intake-flow";
import { countPolicies, searchPolicySummaries } from "@/lib/policy/store";

// Always reflects live catalog state from Postgres — never baked as a
// static snapshot at build/deploy time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [initialOptions, totalIngested] = await Promise.all([
    searchPolicySummaries("", 10),
    countPolicies(),
  ]);

  return <IntakeFlow initialOptions={initialOptions} totalIngested={totalIngested} />;
}
