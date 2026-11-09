/// <reference path="../pb_data/types.d.ts" />

// Darts schema: users with username login, online matches (append-only event log)
// and invitations. Applied automatically when PocketBase starts.

migrate((app) => {
    // ---- users: login with username, no real e-mail required
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new TextField({
        name: "username",
        required: true,
        min: 3,
        max: 24,
        pattern: "^[a-z0-9_]+$",
        presentable: true,
    }));
    users.fields.add(new DateField({ name: "lastSeen" }));
    const email = users.fields.getByName("email");
    email.required = false;
    users.indexes.push("CREATE UNIQUE INDEX `idx_users_username` ON `users` (`username`)");
    users.passwordAuth.identityFields = ["username"];
    // Logged in players may find each other; only the owner can change a profile.
    users.listRule = "@request.auth.id != ''";
    users.viewRule = "@request.auth.id != ''";
    users.createRule = "";
    users.updateRule = "id = @request.auth.id";
    users.deleteRule = "id = @request.auth.id";
    app.save(users);

    const participant = "(host = @request.auth.id || guest = @request.auth.id)";

    // ---- matches
    const matches = new Collection({
        type: "base",
        name: "matches",
        listRule: participant,
        viewRule: participant,
        createRule: participant + " && host != guest && status = 'active'",
        // Participants may only change the status (finish / abandon)
        updateRule: participant + " && @request.body.host:isset = false && @request.body.guest:isset = false && @request.body.players:isset = false && @request.body.settings:isset = false",
        deleteRule: null,
        fields: [
            { name: "host", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
            { name: "guest", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
            { name: "settings", type: "json", required: true, maxSize: 4000 },
            { name: "players", type: "json", required: true, maxSize: 4000 },
            { name: "status", type: "select", values: ["active", "finished", "abandoned"], maxSelect: 1, required: true },
            { name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
    });
    app.save(matches);

    // ---- match_events: one row per dart/visit/undo, ordered by seq.
    // The unique (match, seq) index makes concurrent writes safe: a conflicting
    // insert fails and the client re-syncs.
    const events = new Collection({
        type: "base",
        name: "match_events",
        listRule: "(match.host = @request.auth.id || match.guest = @request.auth.id)",
        viewRule: "(match.host = @request.auth.id || match.guest = @request.auth.id)",
        createRule: "by = @request.auth.id && (match.host = @request.auth.id || match.guest = @request.auth.id) && match.status = 'active'",
        updateRule: null,
        deleteRule: null,
        fields: [
            { name: "match", type: "relation", collectionId: matches.id, maxSelect: 1, required: true, cascadeDelete: true },
            { name: "seq", type: "number", required: false, min: 0, onlyInt: true },
            { name: "event", type: "json", required: true, maxSize: 500 },
            { name: "by", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: false },
            { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: ["CREATE UNIQUE INDEX `idx_match_events_seq` ON `match_events` (`match`, `seq`)"],
    });
    app.save(events);

    // ---- invitations
    const invitations = new Collection({
        type: "base",
        name: "invitations",
        listRule: "(from = @request.auth.id || to = @request.auth.id)",
        viewRule: "(from = @request.auth.id || to = @request.auth.id)",
        createRule: "from = @request.auth.id && to != @request.auth.id && status = 'pending'",
        updateRule: "(from = @request.auth.id || to = @request.auth.id) && @request.body.from:isset = false && @request.body.to:isset = false",
        deleteRule: "from = @request.auth.id",
        fields: [
            { name: "from", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
            { name: "to", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
            { name: "settings", type: "json", required: true, maxSize: 2000 },
            { name: "status", type: "select", values: ["pending", "accepted", "declined", "cancelled"], maxSelect: 1, required: true },
            { name: "match", type: "relation", collectionId: matches.id, maxSelect: 1, required: false, cascadeDelete: false },
            { name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
    });
    app.save(invitations);
}, (app) => {
    for (const name of ["invitations", "match_events", "matches"]) {
        try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) { /* already gone */ }
    }
    const users = app.findCollectionByNameOrId("users");
    users.passwordAuth.identityFields = ["email"];
    users.fields.removeByName("username");
    users.fields.removeByName("lastSeen");
    users.indexes = users.indexes.filter((i) => !i.includes("idx_users_username"));
    users.fields.getByName("email").required = true;
    app.save(users);
});
