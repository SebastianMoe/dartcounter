# Darts Scoreboard

Mobile-first Darts-App (PWA) für **X01** (301/501/701/eigene, Single/Double/Master-Out, Double-In, Legs & Sätze), **Cricket**, **Around the Clock**, **Shanghai** und **Highscore** – mit Statistiken, Spracheingabe und Online-Spielen gegen Freunde.

**Spracheingabe** (Mikrofon im Spiel): „Triple 20, Doppel 16“, „hundertvierzig“, „Bull“, „daneben“, „Check“, „Bust“, „rückgängig“. Sätze mit unbekannten Wörtern werden ignoriert. Braucht HTTPS; am besten Chrome (Android) bzw. Safari (iOS). Parser: `src/game/voice.ts`.

## Aufbau

| Teil | Technik |
|---|---|
| Frontend | React 19, Vite, Tailwind, Zustand (lokal gespeichert) |
| Spiellogik | `src/game/` – reine Funktionen, Stand wird aus der Wurf-Liste berechnet (getestet mit Vitest) |
| Backend | [PocketBase](https://pocketbase.io) – Login, Einladungen, Online-Matches (Echtzeit) |
| Datenbankschema | `pb_migrations/` – wird beim Start automatisch angewendet |
| Betrieb | **Ein** Docker-Container: PocketBase liefert API und Frontend aus |

Lokale Spiele und Statistiken funktionieren komplett ohne Server (auch offline). Der Server wird nur für Online-Spiele gebraucht.

## Entwicklung

```bash
npm install
# PocketBase lokal starten (Binary von github.com/pocketbase/pocketbase/releases):
pocketbase serve --migrationsDir ./pb_migrations
npm run dev        # https://<rechner-ip>:5173 – /api wird an PocketBase weitergeleitet
npm test           # Engine-Tests
npm run icons      # App-Icons aus public/icon.svg erzeugen
```

## Betrieb (z. B. Raspberry Pi)

```bash
docker compose up -d          # App + API auf Port 8090, Daten in ./pb_data
```

- Admin-Oberfläche: `http://<host>:8090/_/` (Login über `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` in `.env`)
- Image: `ghcr.io/sebastianmoe/dartcounter:latest` (amd64, arm64, arm/v7) wird bei jedem Push auf `main` gebaut
- **HTTPS** wird für App-Installation, „Bildschirm anlassen" und Offline-Modus auf dem Handy benötigt (z. B. per Tailscale oder Caddy davor)
- Backup: Ordner `pb_data` sichern oder Backups in der Admin-Oberfläche planen
