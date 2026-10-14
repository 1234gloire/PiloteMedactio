#!/usr/bin/env bash
# Branche le relais des abonnements Stripe vers la plateforme de pilotage.
#
# À exécuter sur le VPS. Le script est idempotent : le relancer ne produit
# aucun doublon. Une sauvegarde du build est prise avant toute modification.

set -euo pipefail
cd /var/www/redactio

echo "== Sauvegarde du build en cours =="
BACKUP="/tmp/redactio-dist-$(date +%Y%m%d-%H%M%S)"
cp -r dist "$BACKUP"
echo "   $BACKUP"

echo "== 1/3 Configuration =="
sudo -u redactio python3 - <<'PY'
p = "/var/www/redactio/server/_core/env.ts"
s = open(p).read()
if "pilotageBillingUrl" in s:
    print("   déjà présent")
else:
    old = '  pilotageTicketSecret: process.env.PILOTAGE_TICKET_SECRET ?? "",'
    assert old in s, "convention ticket introuvable dans env.ts"
    new = old + '\n  pilotageBillingUrl: process.env.PILOTAGE_BILLING_URL ?? "",\n  pilotageBillingSecret: process.env.PILOTAGE_BILLING_SECRET ?? "",'
    open(p, "w").write(s.replace(old, new))
    print("   variables ajoutées")
PY

echo "== 2/3 Module de relais =="
sudo -u redactio cp /tmp/pilotageBilling.ts /var/www/redactio/server/pilotageBilling.ts
echo "   server/pilotageBilling.ts installé"

echo "== 3/3 Branchement dans le webhook Stripe =="
sudo -u redactio python3 - <<'PY'
p = "/var/www/redactio/server/stripeBilling.ts"
s = open(p).read()
if "relayBillingToPilotage" in s:
    print("   déjà branché")
else:
    # Import, après le dernier import existant.
    lines = s.split("\n")
    # Un import peut s'étendre sur plusieurs lignes : on repère la fin réelle
    # du bloc, sans quoi la nouvelle ligne se glisserait au milieu d'une
    # déclaration ouverte et la compilation échouerait.
    last = max(i for i, l in enumerate(lines) if l.startswith("import ") or l.startswith("} from "))
    lines.insert(last + 1, 'import { pilotageDate, relayBillingToPilotage } from "./pilotageBilling";')
    s = "\n".join(lines)

    anchor = """  await safeCreateAuditLog({
    userId: existingUser.id,
    action: "billing.subscription_synced","""
    assert anchor in s, "point d'insertion introuvable dans syncSubscription"

    relay = """  // Le pilotage reçoit l'état de l'abonnement sans attendre, et sans jamais
  // pouvoir faire échouer le traitement du webhook Stripe.
  void relayBillingToPilotage({
    event: `customer.subscription.${subscription.status === "canceled" ? "deleted" : "updated"}`,
    email: existingUser.email ?? "",
    fullName: existingUser.name ?? null,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    renewalDate: pilotageDate(subscription.current_period_end),
    cancelledAt: subscription.status === "canceled" ? pilotageDate(subscription.current_period_end) : null,
  });

"""
    s = s.replace(anchor, relay + anchor, 1)
    open(p, "w").write(s)
    print("   relais branché")
PY

echo "== Compilation =="
sudo -u redactio npm run build 2>&1 | tail -3

echo "== Redémarrage =="
sudo systemctl restart redactio
sleep 4
sudo systemctl is-active redactio

echo "== Vérification =="
curl -s -o /dev/null -m 15 -w "   medactio.fr : HTTP %{http_code}\n" https://www.medactio.fr/

echo
echo "Terminé. Retour arrière si besoin :"
echo "  sudo -u redactio rm -rf dist && sudo -u redactio cp -r $BACKUP dist && sudo systemctl restart redactio"
