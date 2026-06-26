import type { StoreInfo } from "@/server/store";

export function canExecuteLiveActions(store: StoreInfo, allowLiveActions: string | undefined): boolean {
  return store.persistent && store.provider === "prisma" && allowLiveActions === "true";
}

export function actionBelongsToCompany(
  action: { companyId: string },
  companyId: string,
): boolean {
  return action.companyId === companyId;
}
