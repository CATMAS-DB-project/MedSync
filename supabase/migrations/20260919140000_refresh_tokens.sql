-- Persistent refresh-token sessions. Raw refresh tokens never enter the database.
CREATE TABLE refresh_token (
    token_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id         INTEGER NOT NULL,
    token_hash       VARCHAR(64) NOT NULL UNIQUE,
    family_id        UUID NOT NULL,
    expires_at       TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at       TIMESTAMPTZ,
    replaced_by_hash VARCHAR(64),

    CONSTRAINT fk_refresh_token_staff
        FOREIGN KEY (staff_id) REFERENCES user_account(staff_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_refresh_token_replacement
        FOREIGN KEY (replaced_by_hash) REFERENCES refresh_token(token_hash)
        ON DELETE SET NULL
);

CREATE INDEX idx_refresh_token_family_id
    ON refresh_token (family_id);

CREATE INDEX idx_refresh_token_staff_id
    ON refresh_token (staff_id);

CREATE INDEX idx_refresh_token_expires_at
    ON refresh_token (expires_at);

COMMENT ON TABLE refresh_token IS
    'Hashed, rotating refresh-token sessions. Raw cookie values are never stored.';