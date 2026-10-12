#!/usr/bin/env bash
# Corrige l'import mal placé du relais de facturation, puis recompile.
set -euo pipefail
cd /var/www/redactio

echo "== Correction de l'import =="
sudo -u redactio python3 - <<'PY'
p = "/var/www/redactio/server/stripeBilling.ts"
s = open(p).read()
bad = 'import { pilotageDate, relayBillingToPilotage } from "./pilotageBilling";\n'

if bad not in s:
    print("   import absent — rien à corriger")
else:
    # On le retire de là où il se trouve, puis on le replace après le dernier
    # import réellement terminé, afin de ne pas couper un import multi-lignes.
    s = s.replace(bad, "", 1)
    lines = s.split("\n")
    end = max(i for i, l in enumerate(lines) if l.startswith("import ") or l.startswith("} from "))
    lines.insert(end + 1, bad.rstrip("\n"))
    open(p, "w").write("\n".join(lines))
    print("   import replacé après le bloc d'imports")
PY

echo "== Vérification de l'en-tête =="
sed -n '1,14p' server/stripeBilling.ts | cat -n

echo "== Compilation =="
sudo -u redactio npm run build 2>&1 | tail -4

echo "== Redémarrage =="
sudo systemctl restart redactio
sleep 4
echo "   service : $(sudo systemctl is-active redactio)"

echo "== Vérification =="
curl -s -o /dev/null -m 15 -w "   medactio.fr : HTTP %{http_code}\n" https://www.medactio.fr/
grep -c "relayBillingToPilotage" dist/index.js | xargs echo "   relais present dans le build :"
