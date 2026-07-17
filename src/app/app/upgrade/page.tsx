import { getOrCreateWorkspace, getCreditBalance } from "@/lib/workspace";
import Card from "@/components/ui/Card";
import {
  PLAN_CREDITS,
  PLAN_PRICES_USD,
  ADMIN_CONTACT_PHONE,
  type SubscriptionPlan,
} from "@/lib/billing";
import { TopupCalculator, RedeemCodeForm } from "./UpgradeForms";

const PLANS: SubscriptionPlan[] = ["starter", "professional", "agency"];

export default async function UpgradePage() {
  const ws = await getOrCreateWorkspace();
  const credits = await getCreditBalance(ws.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Tarif va kreditlar</h1>
        <p className="text-muted">
          Joriy tarif: <span className="font-medium text-ink">{ws.plan}</span> · Balans:{" "}
          <span className="font-medium text-ink">{credits}</span> kredit
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p} className="space-y-2">
            <h2 className="font-display text-lg font-semibold capitalize text-ink">{p}</h2>
            <p className="text-2xl font-semibold text-ink">${PLAN_PRICES_USD[p]}/oy</p>
            <p className="text-sm text-muted">{PLAN_CREDITS[p]} kredit/oy</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink">
          Bir martalik kredit sotib olish
        </h2>
        <TopupCalculator />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink">To‘lov</h2>
        <p className="text-sm text-muted">
          Tarif yoki kredit sotib olish uchun {ADMIN_CONTACT_PHONE} raqamiga qo‘ng‘iroq qiling.
          To‘lovni tasdiqlagach, sizga faollashtirish kodi beriladi — uni pastdagi maydonga
          kiriting.
        </p>
        <RedeemCodeForm />
      </Card>
    </div>
  );
}
