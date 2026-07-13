"use server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MaintenanceConfigInput {
  component_id: string;
  pm_applicable: string;
  can_be_replaced_by_ship_staff: string;
  is_system_param_recorded: string;
}

export interface RedundancyRowInput {
  component_id: string;
  k: string;              // always "1" from the form
  n: number;              // parallelComponentIds.length
  redundancy_type: string;
  system_name: string;
  system_parent_name: string;
}

export interface MaintenanceDataInput {
  component_id: string;
  event_type: string;
  maint_date: string;          // ISO date string "YYYY-MM-DD"
  maintenance_type: string;
  replaced_component_type: string;
  cannabalised_age: string;
  maintenance_duration: number;
  failure_mode?: string;
  description?: string;
}

export interface SystemConfigAdditionalInput {
  component_id: string;
  component_name?: string;
  num_cycle_or_runtime: number;   // avg monthly utilization value
  installation_date: string;      // ISO date string "YYYY-MM-DD"
  unit: string;
}

// ─── Generic result type ──────────────────────────────────────────────────────

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── 1. Maintenance Configuration ─────────────────────────────────────────────

export async function createMaintenanceConfig(
  input: MaintenanceConfigInput
): Promise<ActionResult<{ maintenance_id: string }>> {
  try {
    const res = await fetch(`${API_BASE}/additional-info/maintenance-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── 2. Redundancy — batch ────────────────────────────────────────────────────

export async function createRedundancyBatch(
  rows: RedundancyRowInput[]
): Promise<ActionResult<{ inserted: number }>> {
  try {
    const res = await fetch(`${API_BASE}/additional-info/redundancy/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }

    const data = await res.json();
    return { success: true, data: { inserted: data.length } };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── 3. Maintenance Data ──────────────────────────────────────────────────────

export async function createMaintenanceData(
  input: MaintenanceDataInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const res = await fetch(`${API_BASE}/additional-info/maintenance-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── 4. System Config Additional Info ─────────────────────────────────────────

export async function createSystemConfigAdditional(
  input: SystemConfigAdditionalInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const res = await fetch(`${API_BASE}/additional-info/system-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}