"use server";

import { lookupNpiForEnrollment } from "@/lib/npi/nppes";
import { assertRateLimit } from "@/lib/rate-limit";

export async function lookupPrescriberNpi(npi: string) {
  await assertRateLimit("enroll-npi-lookup", 20, 5 * 60 * 1000);
  return lookupNpiForEnrollment(npi);
}
