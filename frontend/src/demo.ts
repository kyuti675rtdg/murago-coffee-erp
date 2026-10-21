/* Clearly-labelled DEMO fallback rows — used ONLY in local dev (import.meta.env.DEV)
   when the API is unreachable. The live deployment always calls real APIs. */
export const DEMO: Record<string, any[]> = {
  lots: [{ id: 'demo-1', lot_code: 'MUR-DEMO-W-001 (DEMO)', station: 'demo', process_type: 'washed', current_stage: 'drying', current_weight_kg: '980.00', cherry_kg: '5000.00', variety: 'Heirloom' }],
  farmers: [{ id: 'demo-1', farmer_code: 'FRM-DEMO-0001', full_name: 'Demo Farmer', station: 'demo', kyc_status: 'verified', coffee_tree_count: 1200 }],
  workers: [{ id: 'demo-1', worker_code: 'W-DEMO', full_name: 'Demo Worker', wage_type: 'daily', wage_rate: '300.00' }],
}
export const DEMO_DASHBOARD = { lots_total: 1, lots_by_stage: { drying: 1 }, cherry_procured_kg: '490.00', warehouse_stock_kg: '0', open_contracts: 1, committed_kg: '0', farmers: 1, containers_open: 0, fuel_anomalies: 0, water_anomalies: 0, avg_fuel_ratio: '0.02', avg_water_ratio: '6.0' }
