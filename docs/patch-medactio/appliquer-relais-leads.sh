#!/usr/bin/env bash
# Branche le relais des demandes de démonstration vers la plateforme de pilotage.
#
# À exécuter sur le VPS, depuis /var/www/redactio.
# Le script est idempotent : le relancer ne produit aucun doublon.

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
if "pilotageLeadUrl" in s:
    print("   déjà présent")
else:
    old = '  pilotageTicketSecret: process.env.PILOTAGE_TICKET_SECRET ?? "",'
    assert old in s, "convention ticket introuvable dans env.ts"
    new = old + '\n  pilotageLeadUrl: process.env.PILOTAGE_LEAD_URL ?? "",\n  pilotageLeadSecret: process.env.PILOTAGE_LEAD_SECRET ?? "",'
    open(p, "w").write(s.replace(old, new))
    print("   variables ajoutées")
PY

echo "== 2/3 Module de relais =="
sudo -u redactio cp /tmp/pilotageLead.ts /var/www/redactio/server/pilotageLead.ts
echo "   server/pilotageLead.ts installé"

echo "== 3/3 Branchement dans le gestionnaire =="
sudo -u redactio python3 - <<'PY'
p = "/var/www/redactio/server/makeWebhooks.ts"
s = open(p).read()
if "relayDemoRequestToPilotage" in s:
    print("   déjà branché")
else:
    imp = 'import { relayDemoRequestToPilotage } from "./pilotageLead";\n'
    lines = s.split("\n")
    last = max(i for i, l in enumerate(lines) if l.startswith("import "))
    lines.insert(last + 1, imp.rstrip("\n"))
    s = "\n".join(lines)

    anchor = """      const result = await postToMake(ENV.makeDemoWebhookUrl, {"""
    assert anchor in s, "appel postToMake introuvable"
    relay = """      // Le lead part vers le CRM sans attendre, et sans jamais pouvoir
      // faire échouer la demande du visiteur.
      void relayDemoRequestToPilotage(payload);

"""
    s = s.replace(anchor, relay + anchor)
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
echo "Terminé. En cas de problème : sudo -u redactio rm -rf dist && sudo -u redactio cp -r $BACKUP dist && sudo systemctl restart redactio"
