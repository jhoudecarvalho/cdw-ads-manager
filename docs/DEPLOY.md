# Deploy — Franchise HUB em VM Debian + Docker + nginx

Guia de deploy do Franchise HUB numa VM Debian (12+), com a stack rodando
em Docker e nginx + certbot no host como reverse proxy + TLS.

> **Topologia**
>
> ```
> usuário ──HTTPS──► nginx (host, apt) ──HTTP──► 127.0.0.1:3000 ──► app (container)
>                                                                       │
>                                                                       └─► postgres (container, volume)
> ```
>
> O container do app só escuta no loopback do host — quem fala com a
> internet é o nginx, que termina TLS, adiciona cabeçalhos `X-Forwarded-*`
> e faz o `proxy_pass`. O Postgres não expõe porta nenhuma no host.

---

## 1. Pré-requisitos da VM

- Debian 12 (Bookworm) ou superior
- Acesso root ou sudo
- DNS apontando para o IP da VM (`A`/`AAAA` no domínio que vai usar)
- Portas 80 e 443 abertas no firewall

## 2. Setup inicial (uma vez por VM)

### Docker

```bash
# Pacotes necessários
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Repo oficial do Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Permitir seu usuário rodar docker sem sudo (logout/login depois)
sudo usermod -aG docker $USER
```

### nginx + certbot

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

### Firewall (ufw, se usar)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 3. Clone do projeto e `.env`

```bash
sudo mkdir -p /opt/franchise-hub
sudo chown $USER:$USER /opt/franchise-hub
cd /opt/franchise-hub
git clone <URL_DO_REPO> .

cp .env.example .env
```

Edite `.env` — **valores obrigatórios pra prod**:

| Variável                             | Como gerar                          |
| ------------------------------------ | ----------------------------------- |
| `POSTGRES_DB`                        | ex: `franchise_hub`                 |
| `POSTGRES_USER`                      | ex: `franchise_hub`                 |
| `POSTGRES_PASSWORD`                  | `openssl rand -base64 24`           |
| `AUTH_SECRET`                        | `openssl rand -base64 32`           |
| `NEXTAUTH_URL`                       | `https://app.suaempresa.com.br`     |
| `AUTH_TRUST_HOST`                    | `true` (atrás do nginx)             |
| `ENCRYPTION_KEY`                     | `openssl rand -base64 32`           |
| `CRON_SECRET`                        | `openssl rand -hex 32`              |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | `openssl rand -base64 32`           |
| `ADS_INTEGRATIONS_MODE`              | `mock` ou `live`                    |

> `DATABASE_URL` e `DIRECT_URL` do `.env.example` são **ignorados em prod**
> — o `compose.prod.yaml` monta a connection string a partir das vars do
> Postgres acima.

---

## 4. Build, bootstrap e subida

```bash
# Build das imagens (runner + ops)
docker compose -f compose.prod.yaml build

# Primeira inicialização: cria schema + role franchise_hub_app + seed
docker compose -f compose.prod.yaml run --rm bootstrap bash scripts/bootstrap.sh --seed

# Sobe o app + postgres
docker compose -f compose.prod.yaml up -d

# Logs em tempo real
docker compose -f compose.prod.yaml logs -f app
```

Verifica que o app respondeu sem erro:

```bash
curl -s http://127.0.0.1:3000/api/health | jq
# { "status": "ok", "db": "ok", "latencyMs": 4 }
```

---

## 5. nginx — server block + TLS

Crie `/etc/nginx/sites-available/franchise-hub`:

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name app.suaempresa.com.br;

  # Deixa o certbot responder no /.well-known durante o desafio.
  # O resto vai pra HTTPS via certbot (--nginx insere o redirect automaticamente).
  location / { return 301 https://$host$request_uri; }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name app.suaempresa.com.br;

  # Os certificados ficam aqui depois do certbot rodar.
  # ssl_certificate     /etc/letsencrypt/live/app.suaempresa.com.br/fullchain.pem;
  # ssl_certificate_key /etc/letsencrypt/live/app.suaempresa.com.br/privkey.pem;

  # Limites razoáveis pra um SaaS
  client_max_body_size 10m;
  proxy_read_timeout   60s;
  proxy_send_timeout   60s;

  location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;

    # Headers que o Next/Auth.js lê via AUTH_TRUST_HOST=true
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_set_header   X-Forwarded-Host  $host;

    # WebSocket / HMR (caso algum dia precise)
    proxy_set_header   Upgrade           $http_upgrade;
    proxy_set_header   Connection        "upgrade";
  }
}
```

Ative e teste:

```bash
sudo ln -s /etc/nginx/sites-available/franchise-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Emita o certificado:

```bash
sudo certbot --nginx -d app.suaempresa.com.br
```

O certbot insere as linhas `ssl_certificate*` e o redirect 80→443. Renovação
automática já vem ativada via `systemctl status certbot.timer`.

> **HSTS**: o `next.config.ts` já envia `Strict-Transport-Security`
> (2 anos + preload). Em produção real (TLS válido), o browser passa a
> exigir HTTPS sem revalidar.

---

## 6. Operação do dia-a-dia

### Re-deploy depois de `git pull`

```bash
cd /opt/franchise-hub
git pull
docker compose -f compose.prod.yaml build app

# Se houver migrations novas
docker compose -f compose.prod.yaml run --rm bootstrap

# Sobe a nova imagem (zero-downtime no compose: a nova começa antes da
# antiga sair; o healthcheck do app garante que ela já passa em /api/health)
docker compose -f compose.prod.yaml up -d
```

### Logs

```bash
docker compose -f compose.prod.yaml logs -f app           # só app
docker compose -f compose.prod.yaml logs -f postgres      # só DB
docker compose -f compose.prod.yaml logs --tail=200 app
```

### Backup do Postgres (cron do host)

Crie `/usr/local/bin/franchise-hub-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR=/var/backups/franchise-hub
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%F_%H%M%S)
docker compose -f /opt/franchise-hub/compose.prod.yaml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "$BACKUP_DIR/${STAMP}.dump"
# Retém 30 dias
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete
```

```bash
sudo chmod +x /usr/local/bin/franchise-hub-backup.sh
# Roda às 3h
echo "0 3 * * * root /usr/local/bin/franchise-hub-backup.sh" | sudo tee /etc/cron.d/franchise-hub-backup
```

### Restore

```bash
# Para o app pra evitar escrita durante o restore
docker compose -f compose.prod.yaml stop app

# Restaura
docker compose -f compose.prod.yaml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  < /var/backups/franchise-hub/2026-05-18_030000.dump

docker compose -f compose.prod.yaml start app
```

### Rotação de segredos

| Segredo                              | Como rotacionar                                                     |
| ------------------------------------ | ------------------------------------------------------------------- |
| `AUTH_SECRET`                        | Trocar no `.env` → `up -d`. Sessões ativas serão invalidadas.       |
| `ENCRYPTION_KEY`                     | **Cuidado**: tokens OAuth criptografados ficam ilegíveis. Re-conectar contas. |
| `CRON_SECRET`                        | Trocar no `.env` + atualizar quem chama os endpoints `/api/cron/*`. |
| `POSTGRES_PASSWORD`                  | `ALTER USER ... WITH PASSWORD ...` + atualizar `.env` + restart.    |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Trocar e rebuild — caso esteja em multi-instância.                  |

---

## 7. Solução de problemas

| Sintoma                                          | Provável causa                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `/api/health` → 503                              | App não conecta no Postgres — checar `docker compose logs postgres`    |
| Login dá 500 ou redireciona em loop              | `NEXTAUTH_URL` errado ou `AUTH_TRUST_HOST` faltando                    |
| "Failed to find Server Action"                   | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` diferente entre rebuilds          |
| Migrations falham com `permission denied`        | `DIRECT_URL` precisa apontar pro `POSTGRES_USER` (owner), não pro role |
| 502 do nginx                                     | App ainda subindo (healthcheck) ou crashou — `logs -f app`             |

## 8. Checklist final pré-go-live

- [ ] DNS resolvendo pro IP da VM
- [ ] Certbot rodou, `curl -I https://...` retorna 200 + cabeçalho HSTS
- [ ] `.env` com todos os secrets gerados via `openssl`
- [ ] Backup do Postgres testado (rodou e gerou arquivo > 0 bytes)
- [ ] Restore testado em VM staging
- [ ] `docker compose ps` mostra app `healthy`
- [ ] Login + dashboard funcionam pela URL pública
- [ ] `GET /api/cron/sync` sem header devolve 401
- [ ] Termos/LGPD acessíveis em `/{slug}/account`
