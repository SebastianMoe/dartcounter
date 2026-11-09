/// <reference path="../pb_data/types.d.ts" />

// Custom API for visitor pairing and sharing local match results.
// Note: PocketBase runs every handler in its own VM, so helpers are defined inline.


// 1) Player creates a 6-digit code on their own phone (must be logged in)
routerAdd("POST", "/api/darts/pair-code", (e) => {
    const user = e.auth;
    const old = $app.findRecordsByFilter("pair_codes", "user = {:u}", "", 0, 0, { u: user.id });
    for (const r of old) $app.delete(r);

    const rec = new Record($app.findCollectionByNameOrId("pair_codes"));
    const code = $security.randomStringWithAlphabet(6, "0123456789");
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString().replace("T", " ");
    rec.set("user", user.id);
    rec.set("code", code);
    rec.set("attempts", 0);
    rec.set("expires", expires);
    $app.save(rec);

    return e.json(200, { code, username: user.get("username"), expires, ttlMinutes: 10 });
}, $apis.requireAuth("users"));

// 2) Host device redeems username + code and receives a link token for that player
routerAdd("POST", "/api/darts/pair", (e) => {
    const body = e.requestInfo().body || {};
    const username = String(body.username || "").trim().toLowerCase();
    const code = String(body.code || "").replace(/\D/g, "");
    const fail = () => { throw new BadRequestError("Benutzername oder Code falsch (oder abgelaufen)."); };
    if (!username || code.length !== 6) fail();

    let user;
    try { user = $app.findFirstRecordByFilter("users", "username = {:u}", { u: username }); } catch (_) { fail(); }

    let pc;
    try {
        pc = $app.findFirstRecordByFilter("pair_codes", "user = {:u} && expires > @now", { u: user.id });
    } catch (_) { fail(); }

    if (pc.get("code") !== code) {
        const attempts = pc.getInt("attempts") + 1;
        if (attempts >= 5) $app.delete(pc);
        else { pc.set("attempts", attempts); $app.save(pc); }
        fail();
    }
    $app.delete(pc);

    const pairing = new Record($app.findCollectionByNameOrId("pairings"));
    const token = $security.randomString(48);
    const expiresMs = Date.now() + 24 * 60 * 60 * 1000;
    pairing.set("user", user.id);
    pairing.set("token", token);
    pairing.set("expires", new Date(expiresMs).toISOString().replace("T", " "));
    $app.save(pairing);

    return e.json(200, {
        userId: user.id,
        username: user.get("username"),
        name: user.get("name") || user.get("username"),
        token,
        expires: expiresMs,
    });
});

// 3) Upload a finished local match for all linked players (visitors via token, own account via auth)
routerAdd("POST", "/api/darts/share-match", (e) => {
    const info = e.requestInfo();
    const body = info.body || {};
    const match = body.match;
    const links = Array.isArray(body.links) ? body.links : [];
    if (!match || typeof match.id !== "string" || !Array.isArray(match.players) || !Array.isArray(match.events)) {
        throw new BadRequestError("Ungültiges Spiel.");
    }

    const playerIds = match.players.map((p) => p && p.userId).filter((id) => typeof id === "string" && id);
    const allowed = [];
    for (const uid of playerIds) {
        if (allowed.indexOf(uid) >= 0) continue;
        if (info.auth && info.auth.id === uid) { allowed.push(uid); continue; }
        const link = links.find((l) => l && l.userId === uid);
        if (!link || typeof link.token !== "string") continue;
        try {
            $app.findFirstRecordByFilter("pairings", "user = {:u} && token = {:t} && expires > @now", { u: uid, t: link.token });
            allowed.push(uid);
        } catch (_) { /* invalid or expired link */ }
    }
    if (allowed.length === 0) throw new ForbiddenError("Kein verknüpfter Spieler in diesem Spiel.");

    try {
        const existing = $app.findFirstRecordByFilter("shared_matches", "matchId = {:id}", { id: match.id });
        return e.json(200, { id: existing.id, duplicate: true });
    } catch (_) { /* new match */ }

    const rec = new Record($app.findCollectionByNameOrId("shared_matches"));
    rec.set("matchId", match.id);
    rec.set("players", allowed);
    rec.set("match", {
        id: match.id,
        settings: match.settings,
        players: match.players.map((p) => ({ id: p.id, name: p.name, userId: p.userId || undefined })),
        events: match.events,
        createdAt: match.createdAt,
        finishedAt: match.finishedAt,
    });
    if (info.auth) rec.set("recordedBy", info.auth.id);
    $app.save(rec);
    return e.json(200, { id: rec.id, players: allowed });
});

// Housekeeping: drop expired codes and links every hour
cronAdd("darts_cleanup", "0 * * * *", () => {
    for (const col of ["pair_codes", "pairings"]) {
        const old = $app.findRecordsByFilter(col, "expires < @now", "", 500, 0);
        for (const r of old) $app.delete(r);
    }
});
