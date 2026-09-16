# Déploiement sur le VPS — pilotage.medactio.fr

Le VPS héberge déjà **medactio.fr**, le produit en production. Toute la
procédure est donc conçue pour être **strictement additive**.

## Ce qui n'est jamais modifié

- Les vhosts Apache existants — un fichier distinct est créé pour le seul
  sous-domaine `pilotage.medactio.fr`
- Les certificats TLS existants — `certbot certonly` émet un certificat séparé,
  sans toucher aux autres
- Les services, processus et fichiers des autres projets
- La configuration globale d'Apache — seuls des modules peuvent être activés,
  opération additive et sans effet sur l'existant

Chaque étape est précédée d'une vérification, et Apache n'est rechargé
qu'après un test de configuration réussi. En cas de doute, la procédure
s'arrête.

## Prérequis à vérifier avant de commencer

```bash
# 1. Le port applicatif est-il libre ? (aucune sortie = libre)
sudo ss -lntp | grep ':4100' || echo "port 4100 libre"

# 2. Quels ports sont déjà pris par les autres projets ?
sudo ss -lntp | grep -E 'LISTEN' | awk '{print $4, $6}'

# 3. Version de Node (22 ou plus requis)
node --version

# 4. Modules Apache nécessaires
apache2ctl -M 2>/dev/null | grep -E 'proxy_module|proxy_http|headers|rewrite|ssl'
```

Si un module manque, l'activer est sans effet sur les sites existants :

```bash
sudo a2enmod proxy proxy_http headers rewrite ssl
```

## Étape 1 — Déposer l'application

```bash
sudo mkdir -p /var/www/medactio-pilotage /var/www/pilotage-acme
sudo chown -R ubuntu:ubuntu /var/www/medactio-pilotage /var/www/pilotage-acme

cd /var/www/medactio-pilotage
git clone https://github.com/1234gloire/PiloteMedactio.git .

corepack enable
pnpm install --frozen-lockfile
pnpm build
```

## Étape 2 — Configurer l'environnement

Copier `.env.example` vers `.env` et renseigner les valeurs de production :
Supabase, `DATABASE_URL`, `CRON_SECRET`, `LEAD_INTAKE_SECRET`,
`TICKET_INTAKE_SECRET`, `OWNER_EMAIL`.

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

`PORT=4100` et `NODE_ENV=production` sont fournis par le service systemd.
`DEV_AUTH_ENABLED` doit rester à `false`.

## Étape 3 — Lancer le service

```bash
sudo cp deploy/medactio-pilotage.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now medactio-pilotage
sudo systemctl status medactio-pilotage --no-pager

# L'application doit répondre en local avant d'exposer quoi que ce soit.
curl -I http://127.0.0.1:4100/
```

## Étape 4 — Vhost HTTP et certificat

```bash
sudo cp deploy/pilotage.medactio.fr-http.conf \
        /etc/apache2/sites-available/pilotage.medactio.fr.conf
sudo a2ensite pilotage.medactio.fr

# Vérifier AVANT de recharger. Ne pas recharger si le test échoue.
sudo apache2ctl configtest
sudo systemctl reload apache2

# Certificat dédié au sous-domaine, sans toucher aux certificats existants.
sudo certbot certonly --webroot -w /var/www/pilotage-acme \
     -d pilotage.medactio.fr --cert-name pilotage.medactio.fr
```

## Étape 5 — Passer en HTTPS

```bash
sudo cp deploy/pilotage.medactio.fr-tls.conf \
        /etc/apache2/sites-available/pilotage.medactio.fr.conf
sudo apache2ctl configtest
sudo systemctl reload apache2

curl -I https://pilotage.medactio.fr/
```

## Étape 6 — Raccorder les automatisations

Une fois l'application accessible, exécuter dans l'éditeur SQL de Supabase le
script `supabase/setup.sql`, en remplaçant `<URL_APPLICATION>` par
`https://pilotage.medactio.fr` et `<CRON_SECRET>` par la valeur du `.env`.

Puis, dans Supabase → Authentication → URL Configuration :
Site URL `https://pilotage.medactio.fr`, et ajouter la même URL suivie de `/**`
aux Redirect URLs.

## Retour arrière

L'opération est entièrement réversible et sans effet sur les autres projets :

```bash
sudo systemctl disable --now medactio-pilotage
sudo a2dissite pilotage.medactio.fr
sudo apache2ctl configtest && sudo systemctl reload apache2
```

## Mise à jour ultérieure

```bash
cd /var/www/medactio-pilotage
git pull
pnpm install --frozen-lockfile
pnpm build
sudo systemctl restart medactio-pilotage
```
