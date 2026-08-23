-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency_default" TEXT NOT NULL DEFAULT 'MXN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airports" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "iata_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "airports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pmd_cycles" (
    "id" TEXT NOT NULL,
    "airport_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "start_year" INTEGER NOT NULL,
    "end_year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "pmd_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pmd_years" (
    "id" TEXT NOT NULL,
    "pmd_cycle_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "escalation_factor" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "annual_target_locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pmd_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_groups" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "investment_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_values" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "catalog_type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "catalog_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pmd_series" (
    "id" TEXT NOT NULL,
    "pmd_year_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "investment_group_id" TEXT,
    "authorized_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "updated_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "responsible_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVA',
    "source_document" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pmd_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pmd_series_items" (
    "id" TEXT NOT NULL,
    "pmd_series_id" TEXT NOT NULL,
    "subsector" TEXT,
    "project_name" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL(18,4),
    "unit_price" DECIMAL(18,4),

    CONSTRAINT "pmd_series_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tax_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "contract_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT,
    "company_id" TEXT,
    "investment_group_id" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'EN_DEFINICION',
    "planned_start_date" TIMESTAMP(3),
    "planned_end_date" TIMESTAMP(3),
    "actual_start_date" TIMESTAMP(3),
    "actual_end_date" TIMESTAMP(3),
    "original_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "current_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advance_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advance_amortized" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "oene_contracted_budget" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "oene_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "oene_contracted" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "oene_to_regularize" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "oene_to_invoice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "retentions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalties" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_origin" TEXT,
    "responsible_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_series_allocations" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "pmd_series_id" TEXT NOT NULL,
    "allocated_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "contract_series_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_amendments" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "amendment_number" INTEGER NOT NULL,
    "amount_delta" DECIMAL(18,2) NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_attachment_id" TEXT,

    CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annual_targets" (
    "id" TEXT NOT NULL,
    "pmd_year_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT true,
    "approved_by" TEXT,
    "approval_evidence_attachment_id" TEXT,

    CONSTRAINT "annual_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_versions" (
    "id" TEXT NOT NULL,
    "pmd_series_id" TEXT,
    "contract_id" TEXT,
    "version_type" TEXT NOT NULL,
    "cutoff_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "requested_by" TEXT,
    "approved_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_schedules" (
    "id" TEXT NOT NULL,
    "schedule_version_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "pmd_series_id" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "planned_amount" DECIMAL(18,2) NOT NULL,
    "imbalance_flag" BOOLEAN NOT NULL DEFAULT false,
    "imbalance_detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actual_investments" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "pmd_series_id" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "investment_type" TEXT NOT NULL,
    "gross_amount" DECIMAL(18,2) NOT NULL,
    "amortization" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "retention" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalty" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxes" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recognizable_pmd_amount" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "supersedes_id" TEXT,
    "evidence_attachment_id" TEXT,
    "captured_by" TEXT,
    "validated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actual_investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "actual_investment_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "actual_investment_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "estimate_number" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oene_records" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "purchase_order" TEXT NOT NULL,
    "contracted_budget" DECIMAL(18,2) NOT NULL,
    "oene_total" DECIMAL(18,2) NOT NULL,
    "oene_contracted" DECIMAL(18,2) NOT NULL,
    "oene_to_regularize" DECIMAL(18,2) NOT NULL,
    "oene_to_invoice" DECIMAL(18,2) NOT NULL,
    "oene_percentage" DECIMAL(7,4) NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oene_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pmd_recognition_configs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "airport_id" TEXT,
    "pmd_year_id" TEXT,
    "investment_type" TEXT,
    "criterion" TEXT NOT NULL,

    CONSTRAINT "pmd_recognition_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "pmd_series_id" TEXT,
    "contract_id" TEXT,
    "name" TEXT NOT NULL,
    "baseline_date" TIMESTAMP(3),
    "forecast_date" TIMESTAMP(3),
    "actual_date" TIMESTAMP(3),
    "responsible_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "decision_deadline" TIMESTAMP(3),
    "protected_amount" DECIMAL(18,2),

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "exposed_amount" DECIMAL(18,2) NOT NULL,
    "exposure_period" TEXT,
    "risk_level" TEXT NOT NULL,
    "stage_group" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDENTIFICADO',
    "trend" TEXT,
    "evidence_attachment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" TEXT NOT NULL,
    "risk_id" TEXT NOT NULL,
    "probability" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "impact_dimension" TEXT,
    "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constraints" (
    "id" TEXT NOT NULL,
    "risk_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cause" TEXT,
    "consequence" TEXT,

    CONSTRAINT "constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "risk_id" TEXT,
    "milestone_id" TEXT,
    "description" TEXT NOT NULL,
    "responsible_user_id" TEXT,
    "commitment_date" TIMESTAMP(3),
    "decision_deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "request_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "requested_by" TEXT NOT NULL,
    "reason" TEXT,
    "before_value" JSONB,
    "after_value" JSONB,
    "monthly_impact" JSONB,
    "annual_impact" DECIMAL(18,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "approval_request_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_user_id" TEXT NOT NULL,
    "decision" TEXT,
    "decided_at" TIMESTAMP(3),
    "comments" TEXT,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_results" (
    "id" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_ref_id" TEXT NOT NULL,
    "expected_value" DECIMAL(18,2) NOT NULL,
    "actual_value" DECIMAL(18,2) NOT NULL,
    "difference" DECIMAL(18,2) NOT NULL,
    "tolerance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "severity" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "reconciliation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" TEXT NOT NULL,
    "pmd_year_id" TEXT NOT NULL,
    "period_month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    "closed_by" TEXT,
    "closed_at" TIMESTAMP(3),
    "reopened_reason" TEXT,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_snapshots" (
    "id" TEXT NOT NULL,
    "accounting_period_id" TEXT NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "external_idp_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_scopes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT,
    "airport_id" TEXT,
    "module" TEXT,
    "action" TEXT,
    "monetary_ceiling" DECIMAL(18,2),

    CONSTRAINT "user_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "client_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_value" JSONB,
    "after_value" JSONB,
    "reason" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "session_id" TEXT,
    "related_approval_id" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rows_accepted" INTEGER NOT NULL DEFAULT 0,
    "rows_rejected" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_mappings" (
    "id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "source_field" TEXT NOT NULL,
    "target_field" TEXT NOT NULL,

    CONSTRAINT "import_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pmd_versions" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "airport_id" TEXT NOT NULL,
    "pmd_cycle_id" TEXT NOT NULL,
    "pmd_year_id" TEXT NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "issue_date" TIMESTAMP(3),
    "upload_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT,
    "file_name" TEXT,
    "file_hash" TEXT,
    "template_version" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "comment" TEXT,

    CONSTRAINT "pmd_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pmd_version_files" (
    "id" TEXT NOT NULL,
    "pmd_version_id" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "pmd_version_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pmd_version_comparisons" (
    "id" TEXT NOT NULL,
    "from_pmd_version_id" TEXT NOT NULL,
    "to_pmd_version_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pmd_version_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pmd_version_changes" (
    "id" TEXT NOT NULL,
    "pmd_version_comparison_id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "impact" TEXT,
    "validation_state" TEXT,
    "observation" TEXT,

    CONSTRAINT "pmd_version_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pmd_publication_events" (
    "id" TEXT NOT NULL,
    "pmd_version_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "user_id" TEXT,
    "reason" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pmd_publication_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_code_key" ON "clients"("code");

-- CreateIndex
CREATE UNIQUE INDEX "airports_client_id_iata_code_key" ON "airports"("client_id", "iata_code");

-- CreateIndex
CREATE UNIQUE INDEX "pmd_cycles_airport_id_code_key" ON "pmd_cycles"("airport_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "pmd_years_pmd_cycle_id_year_key" ON "pmd_years"("pmd_cycle_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "investment_groups_client_id_code_key" ON "investment_groups"("client_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_values_client_id_catalog_type_code_key" ON "catalog_values"("client_id", "catalog_type", "code");

-- CreateIndex
CREATE UNIQUE INDEX "pmd_series_pmd_year_id_code_key" ON "pmd_series"("pmd_year_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_client_id_contract_number_key" ON "contracts"("client_id", "contract_number");

-- CreateIndex
CREATE UNIQUE INDEX "contract_series_allocations_contract_id_pmd_series_id_key" ON "contract_series_allocations"("contract_id", "pmd_series_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_amendments_contract_id_amendment_number_key" ON "contract_amendments"("contract_id", "amendment_number");

-- CreateIndex
CREATE UNIQUE INDEX "annual_targets_pmd_year_id_key" ON "annual_targets"("pmd_year_id");

-- CreateIndex
CREATE INDEX "monthly_schedules_contract_id_period_year_period_month_idx" ON "monthly_schedules"("contract_id", "period_year", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_schedules_schedule_version_id_contract_id_period_ye_key" ON "monthly_schedules"("schedule_version_id", "contract_id", "period_year", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "actual_investments_supersedes_id_key" ON "actual_investments"("supersedes_id");

-- CreateIndex
CREATE INDEX "actual_investments_contract_id_period_year_period_month_idx" ON "actual_investments"("contract_id", "period_year", "period_month");

-- CreateIndex
CREATE INDEX "actual_investments_pmd_series_id_period_year_period_month_idx" ON "actual_investments"("pmd_series_id", "period_year", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_actual_investment_id_key" ON "invoices"("actual_investment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_contract_id_invoice_number_key" ON "invoices"("contract_id", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_actual_investment_id_key" ON "estimates"("actual_investment_id");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_contract_id_estimate_number_key" ON "estimates"("contract_id", "estimate_number");

-- CreateIndex
CREATE UNIQUE INDEX "pmd_recognition_configs_client_id_airport_id_pmd_year_id_in_key" ON "pmd_recognition_configs"("client_id", "airport_id", "pmd_year_id", "investment_type");

-- CreateIndex
CREATE INDEX "approval_requests_entity_type_entity_id_idx" ON "approval_requests"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "attachments_entity_type_entity_id_idx" ON "attachments"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "reconciliation_results_scope_type_scope_ref_id_idx" ON "reconciliation_results"("scope_type", "scope_ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_periods_pmd_year_id_period_month_key" ON "accounting_periods"("pmd_year_id", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- AddForeignKey
ALTER TABLE "airports" ADD CONSTRAINT "airports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pmd_cycles" ADD CONSTRAINT "pmd_cycles_airport_id_fkey" FOREIGN KEY ("airport_id") REFERENCES "airports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pmd_years" ADD CONSTRAINT "pmd_years_pmd_cycle_id_fkey" FOREIGN KEY ("pmd_cycle_id") REFERENCES "pmd_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_groups" ADD CONSTRAINT "investment_groups_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_values" ADD CONSTRAINT "catalog_values_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pmd_series" ADD CONSTRAINT "pmd_series_pmd_year_id_fkey" FOREIGN KEY ("pmd_year_id") REFERENCES "pmd_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pmd_series" ADD CONSTRAINT "pmd_series_investment_group_id_fkey" FOREIGN KEY ("investment_group_id") REFERENCES "investment_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pmd_series" ADD CONSTRAINT "pmd_series_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pmd_series_items" ADD CONSTRAINT "pmd_series_items_pmd_series_id_fkey" FOREIGN KEY ("pmd_series_id") REFERENCES "pmd_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_investment_group_id_fkey" FOREIGN KEY ("investment_group_id") REFERENCES "investment_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_series_allocations" ADD CONSTRAINT "contract_series_allocations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_series_allocations" ADD CONSTRAINT "contract_series_allocations_pmd_series_id_fkey" FOREIGN KEY ("pmd_series_id") REFERENCES "pmd_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_evidence_attachment_id_fkey" FOREIGN KEY ("evidence_attachment_id") REFERENCES "attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_targets" ADD CONSTRAINT "annual_targets_pmd_year_id_fkey" FOREIGN KEY ("pmd_year_id") REFERENCES "pmd_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_targets" ADD CONSTRAINT "annual_targets_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_targets" ADD CONSTRAINT "annual_targets_approval_evidence_attachment_id_fkey" FOREIGN KEY ("approval_evidence_attachment_id") REFERENCES "attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_pmd_series_id_fkey" FOREIGN KEY ("pmd_series_id") REFERENCES "pmd_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_versions" ADD CONSTRAINT "schedule_versions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_schedules" ADD CONSTRAINT "monthly_schedules_schedule_version_id_fkey" FOREIGN KEY ("schedule_version_id") REFERENCES "schedule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_schedules" ADD CONSTRAINT "monthly_schedules_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_schedules" ADD CONSTRAINT "monthly_schedules_pmd_series_id_fkey" FOREIGN KEY ("pmd_series_id") REFERENCES "pmd_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actual_investments" ADD CONSTRAINT "actual_investments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actual_investments" ADD CONSTRAINT "actual_investments_pmd_series_id_fkey" FOREIGN KEY ("pmd_series_id") REFERENCES "pmd_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actual_investments" ADD CONSTRAINT "actual_investments_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "actual_investments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actual_investments" ADD CONSTRAINT "actual_investments_evidence_attachment_id_fkey" FOREIGN KEY ("evidence_attachment_id") REFERENCES "attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actual_investments" ADD CONSTRAINT "actual_investments_captured_by_fkey" FOREIGN KEY ("captured_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actual_investments" ADD CONSTRAINT "actual_investments_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_actual_investment_id_fkey" FOREIGN KEY ("actual_investment_id") REFERENCES "actual_investments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_actual_investment_id_fkey" FOREIGN KEY ("actual_investment_id") REFERENCES "actual_investments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oene_records" ADD CONSTRAINT "oene_records_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_pmd_series_id_fkey" FOREIGN KEY ("pmd_series_id") REFERENCES "pmd_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_evidence_attachment_id_fkey" FOREIGN KEY ("evidence_attachment_id") REFERENCES "attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constraints" ADD CONSTRAINT "constraints_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_snapshots" ADD CONSTRAINT "period_snapshots_accounting_period_id_fkey" FOREIGN KEY ("accounting_period_id") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_airport_id_fkey" FOREIGN KEY ("airport_id") REFERENCES "airports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pmd_version_files" ADD CONSTRAINT "pmd_version_files_pmd_version_id_fkey" FOREIGN KEY ("pmd_version_id") REFERENCES "pmd_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pmd_version_changes" ADD CONSTRAINT "pmd_version_changes_pmd_version_comparison_id_fkey" FOREIGN KEY ("pmd_version_comparison_id") REFERENCES "pmd_version_comparisons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pmd_publication_events" ADD CONSTRAINT "pmd_publication_events_pmd_version_id_fkey" FOREIGN KEY ("pmd_version_id") REFERENCES "pmd_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
