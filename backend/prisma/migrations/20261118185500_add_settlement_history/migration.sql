CREATE TABLE "settlement_plans" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "transfer_count" INTEGER NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidated_at" TIMESTAMPTZ(6),

    CONSTRAINT "settlement_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "settlement_plans_transfer_count_check" CHECK ("transfer_count" >= 0),
    CONSTRAINT "settlement_plans_current_invalidated_check" CHECK (
        ("is_current" AND "invalidated_at" IS NULL) OR
        (NOT "is_current" AND "invalidated_at" IS NOT NULL)
    ),
    CONSTRAINT "settlement_plans_trip_id_revision_key" UNIQUE ("trip_id", "revision"),
    CONSTRAINT "settlement_plans_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "settlement_balances" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "participant_name" VARCHAR(100) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "settlement_balances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "settlement_balances_plan_id_participant_id_key" UNIQUE ("plan_id", "participant_id"),
    CONSTRAINT "settlement_balances_plan_id_id_key" UNIQUE ("plan_id", "id"),
    CONSTRAINT "settlement_balances_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "settlement_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "settlement_transfers" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "from_balance_id" UUID NOT NULL,
    "to_balance_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMPTZ(6),

    CONSTRAINT "settlement_transfers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "settlement_transfers_sequence_check" CHECK ("sequence" >= 0),
    CONSTRAINT "settlement_transfers_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "settlement_transfers_distinct_participants_check" CHECK ("from_balance_id" <> "to_balance_id"),
    CONSTRAINT "settlement_transfers_paid_at_check" CHECK (
        ("is_paid" AND "paid_at" IS NOT NULL) OR
        (NOT "is_paid" AND "paid_at" IS NULL)
    ),
    CONSTRAINT "settlement_transfers_plan_id_sequence_key" UNIQUE ("plan_id", "sequence"),
    CONSTRAINT "settlement_transfers_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "settlement_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "settlement_transfers_plan_id_from_balance_id_fkey" FOREIGN KEY ("plan_id", "from_balance_id") REFERENCES "settlement_balances"("plan_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "settlement_transfers_plan_id_to_balance_id_fkey" FOREIGN KEY ("plan_id", "to_balance_id") REFERENCES "settlement_balances"("plan_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "settlement_plans_trip_id_is_current_created_at_idx" ON "settlement_plans"("trip_id", "is_current", "created_at");
CREATE INDEX "settlement_balances_plan_id_idx" ON "settlement_balances"("plan_id");
CREATE INDEX "settlement_transfers_plan_id_idx" ON "settlement_transfers"("plan_id");
