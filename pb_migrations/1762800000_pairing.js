/// <reference path="../pb_data/types.d.ts" />

// Visitor pairing + shared match results.
// All writes go through the custom routes in pb_hooks/darts.pb.js, so the
// create/update/delete rules stay locked (null = superusers only).

migrate((app) => {
    const users = app.findCollectionByNameOrId("users");

    // Short-lived 6-digit codes a player shows on their own phone
    app.save(new Collection({
        type: "base",
        name: "pair_codes",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
            { name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
            { name: "code", type: "text", required: true, min: 6, max: 6 },
            { name: "attempts", type: "number", onlyInt: true, min: 0 },
            { name: "expires", type: "date", required: true },
            { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: ["CREATE INDEX `idx_pair_codes_user` ON `pair_codes` (`user`)"],
    }));

    // A successful pairing gives the host device a token for that visitor
    app.save(new Collection({
        type: "base",
        name: "pairings",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
            { name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
            { name: "token", type: "text", required: true, min: 32, max: 64, hidden: true },
            { name: "expires", type: "date", required: true },
            { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: ["CREATE UNIQUE INDEX `idx_pairings_token` ON `pairings` (`token`)"],
    }));

    // Finished local games, visible to every linked player (shows up in their statistics)
    app.save(new Collection({
        type: "base",
        name: "shared_matches",
        listRule: "players.id ?= @request.auth.id",
        viewRule: "players.id ?= @request.auth.id",
        createRule: null, updateRule: null,
        deleteRule: null,
        fields: [
            { name: "matchId", type: "text", required: true, max: 100 },
            { name: "players", type: "relation", collectionId: users.id, maxSelect: 50, required: true, cascadeDelete: false },
            { name: "match", type: "json", required: true, maxSize: 1000000 },
            { name: "recordedBy", type: "relation", collectionId: users.id, maxSelect: 1, required: false, cascadeDelete: false },
            { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        ],
        indexes: ["CREATE UNIQUE INDEX `idx_shared_matches_match` ON `shared_matches` (`matchId`)"],
    }));
}, (app) => {
    for (const name of ["shared_matches", "pairings", "pair_codes"]) {
        try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) { /* gone */ }
    }
});
