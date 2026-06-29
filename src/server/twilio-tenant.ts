import type { Company } from "@/domain/company";
import { canonicalPhone } from "@/domain/consent";
import type { ScalyRepository } from "./store";

export type TwilioTenantResolution =
  | { status: "matched"; company: Company; calledNumber: string }
  | { status: "missing_called_number"; calledNumber?: undefined }
  | { status: "not_found"; calledNumber: string }
  | { status: "ambiguous"; calledNumber: string; companyIds: string[] };

export function twilioCalledNumber(params: Record<string, string>): string | undefined {
  return params["To"] || params["Called"];
}

function inboundNumberFor(company: Company): string {
  return company.twilioPhoneNumber || company.mainPhone;
}

export async function resolveTwilioTenant(
  store: ScalyRepository,
  params: Record<string, string>,
): Promise<TwilioTenantResolution> {
  const calledNumber = twilioCalledNumber(params);
  if (!calledNumber) return { status: "missing_called_number" };

  const wanted = canonicalPhone(calledNumber);
  const matches = (await store.listCompanies()).filter((company) => canonicalPhone(inboundNumberFor(company)) === wanted);

  if (matches.length === 0) return { status: "not_found", calledNumber };
  if (matches.length > 1) return { status: "ambiguous", calledNumber, companyIds: matches.map((company) => company.id) };
  return { status: "matched", calledNumber, company: matches[0] };
}
