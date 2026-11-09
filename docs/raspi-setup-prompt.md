# Prompt: Darts-App auf dem Raspberry Pi aktualisieren (Supabase → PocketBase)

Diesen Text auf dem Raspberry Pi in Claude Code einfügen.

---

Auf diesem Raspberry Pi läuft bereits meine Darts-App (alte Version). Aktualisiere sie auf die neue Version mit PocketBase. Arbeite selbstständig, frag mich nur bei echten Entscheidungen oder bevor du etwas löschst.

**Alt:** Container aus dem Image `ghcr.io/sebastianmoe/dartcounter` (nginx, Port 80 im Container). Er bekommt die Umgebungsvariablen `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` und nutzt Supabase in der Cloud.

**Neu:** Gleiches Image, neue Version (Branch `rework-pocketbase`, später `main`, Repo `https://github.com/SebastianMoe/dartcounter`). Es ist **ein Container**: PocketBase (v0.40.x) liefert die API und das Frontend auf Container-Port **8090** aus. Im Image stecken außerdem eigene Server-Routen (`/pb/pb_hooks`, z. B. `/api/darts/pair-code`) und die Migrationen (`/pb/pb_migrations`). Die Daten liegen im Volume `/pb/pb_data`, das Schema wird beim Start automatisch angewendet. Supabase wird nicht mehr gebraucht, die Supabase-Variablen fallen weg. Optional: `PB_ADMIN_EMAIL` und `PB_ADMIN_PASSWORD` legen beim Start den Admin für `/_/` an. Das Image gibt es für amd64, arm64 und arm/v7.

**Schritte:**

1. **Bestandsaufnahme:**
   - Laufenden Darts-Container finden (`docker ps -a`) und `docker inspect` ansehen: Image, Port-Mapping auf dem Host, Restart-Policy, Netzwerke, Labels.
   - Herausfinden, wie er gestartet wurde: docker-compose-Datei (über das Label `com.docker.compose.project.working_dir`), `docker run`, Portainer oder Watchtower.
   - Prüfen, ob ein Reverse Proxy davor hängt (Caddy, nginx, Traefik, Tailscale serve, Cloudflare Tunnel) und auf welchen Host-Port er zeigt.
   - Zeig mir eine kurze Zusammenfassung und deinen Plan, bevor du etwas änderst.
2. **Sichern:**
   - Compose-Datei bzw. `docker run`-Parameter nach `~/darts-backup-<datum>/` kopieren.
   - Den alten Image-Digest notieren, damit ein Rollback möglich ist.
3. **Neue Konfiguration** im bisherigen Projektordner (oder `~/darts`, falls es keinen gibt):
   - Service `darts` mit dem Image `ghcr.io/sebastianmoe/dartcounter:latest` und `restart: unless-stopped`.
   - **Derselbe Host-Port wie bisher**, aber jetzt auf Container-Port **8090** gemappt (z. B. vorher `8080:80`, jetzt `8080:8090`). So muss ein vorhandener Reverse Proxy nicht angepasst werden.
   - Volume `./pb_data:/pb/pb_data`.
   - `VITE_SUPABASE_*` entfernen.
   - In eine `.env` (mit `chmod 600`): `PB_ADMIN_EMAIL` und ein **zufällig generiertes** `PB_ADMIN_PASSWORD` mit mindestens 20 Zeichen. Gib das Passwort nicht im Chat aus, sag mir nur, wo es steht.
4. **Image holen:**
   - Erst `docker compose pull` versuchen.
   - Falls `latest` noch die alte Version ist (der neue Stand liegt evtl. erst auf dem Branch `rework-pocketbase`) oder der Pull wegen eines privaten Pakets scheitert: frag mich. Alternative: `git clone -b rework-pocketbase …` und dann `docker compose build` auf dem Pi (dauert einige Minuten).
   - Erkennungsmerkmal der neuen Version: `docker run --rm --entrypoint ls <image> /pb` zeigt `pocketbase`, `pb_public`, `pb_hooks` und `pb_migrations`.
5. **Umstellen:**
   - Alten Container stoppen und entfernen. Das alte Image noch **nicht** löschen.
   - `docker compose up -d`.
   - Prüfen:
     - `docker compose ps` zeigt healthy
     - `curl -s http://localhost:<host-port>/api/health` antwortet
     - Logs enthalten „Server started“ und keine Fehler
     - `curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:<host-port>/api/darts/pair-code` liefert **401** (Route existiert, braucht Login). 404 hieße: die Hooks fehlen.
     - über die öffentliche bzw. HTTPS-URL (Reverse Proxy) laden die App und `/api/health`
   - Falls ein **nginx/Caddy-Proxy** davor hängt: sicherstellen, dass er **WebSockets bzw. Server-Sent Events** nicht puffert. PocketBase-Realtime läuft über `/api/realtime` (SSE). Bei nginx: `proxy_buffering off;`, `proxy_read_timeout 1h;`, `proxy_http_version 1.1;`. Bei Caddy ist nichts nötig.
6. **Admin & Schema prüfen:**
   - Unter `https://<url>/_/` mit dem Admin anmelden.
   - Kontrollieren, dass die Collections `users`, `matches`, `match_events`, `invitations`, `pair_codes`, `pairings` und `shared_matches` existieren.
7. **Updates:**
   - Wenn bisher Watchtower oder ein Cronjob das Image aktualisiert hat, das so beibehalten.
   - Sonst fragen, ob ich einen wöchentlichen Timer für `docker compose pull && docker compose up -d && docker image prune -f` möchte.
8. **Backups:** täglicher Cronjob, der `pb_data` als `tar.gz` mit Datum nach `~/darts-backups` sichert und nur die letzten 14 behält. Zusätzlich auf die Backup-Funktion in der PocketBase-Admin-Oberfläche (Settings → Backups) hinweisen.
9. **Aufräumen (erst nach meinem OK):** das alte Image entfernen.
10. **Zusammenfassung für mich:**
    - URL der App und der Admin-Oberfläche
    - wo `.env`, Daten und Backups liegen
    - wie ich Logs ansehe, neu starte, aktualisiere und auf die alte Version zurückgehe (Rollback)

**Hinweise:**
- HTTPS ist Pflicht für Spracheingabe (Mikrofon), QR-Scan (Kamera), „Bildschirm anlassen“ und die Installation als App. Wenn die App bisher nur per `http://` im Heimnetz läuft: frag mich, ob wir Tailscale (`tailscale serve`) oder Caddy mit eigener Domain einrichten.
- Alte Online-Konten aus Supabase werden nicht übernommen, alle registrieren sich neu. Lokale Spieler und Statistiken liegen im Browser des Handys und bleiben erhalten.
- Keine Passwörter oder Tokens in Logs oder im Chat ausgeben. Vor Änderungen an Router, Firewall oder SSH erst fragen.
