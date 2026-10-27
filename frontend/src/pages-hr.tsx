import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api, post, queueOffline, uuidv7 } from './api'
import { Field, Section, StationSelect, T, UserSelect, errMsg, useList, useToast } from './ui'
import { useAuth } from './store'

/* ============================================================================
   HR module — FRONTEND ONLY. All data comes from the HR API contract
   (the /api/hr-... endpoints). No mock fallback: unreachable APIs surface as the
   standard error state from ui.tsx's T component. Field names below follow
   the conventional snake_case naming of the existing API; unknown keys
   render as "—" in tables rather than failing.
   ============================================================================ */

type Opt = [string, string]
type FieldDef = {
  key: string
  label: string
  type?: 'text' | 'number' | 'date' | 'datetime-local' | 'select' | 'textarea' | 'checkbox'
  options?: Opt[]
  kind?: 'station' | 'user'
  placeholder?: string
}
type ActionDef = { label: string; action: string; when?: (row: any) => boolean }

const opts = (rows: any[], label: (r: any) => string): Opt[] =>
  rows.map((r: any) => [String(r.id), label(r)])
const empLabel = (r: any) => r.full_name || r.name || r.employee_code || r.employee_number || String(r.id)
const deptLabel = (r: any) => r.name || r.code || String(r.id)

function toOpts(rows: any[], labelFn: (r: any) => string): Opt[] { return opts(rows, labelFn) }

/* ---------- role helpers ---------- */
const PRIVILEGED = ['admin', 'hr_administrator', 'hr_manager', 'recruitment_officer', 'payroll_officer', 'finance_manager', 'finance_officer', 'station_supervisor', 'site_manager']
function useSelfService(): boolean {
  const user = useAuth((s) => s.user)
  const roles: string[] = user?.role_codes ?? []
  return roles.includes('employee') && !roles.some((r) => PRIVILEGED.includes(r))
}
function useMyEmployee(enabled: boolean) {
  return useQuery({ queryKey: ['hr-me'], queryFn: () => api('/hr-employees/me/'), enabled })
}
function byEmployee(rows: any[], id: any) {
  return rows.filter((r: any) => {
    const v = r.employee ?? r.employee_id ?? r.employee_code
    return String(v) === String(id) || String(r.employee?.id ?? '') === String(id)
  })
}

/* ---------- offline queue (same record shape as the sync manager) ---------- */
async function queueHrOffline(entityType: string, payload: any) {
  await queueOffline({
    client_uuid: uuidv7(),
    device_id: 'murago-web',
    entity_type: entityType,
    entity_uuid: uuidv7(),
    payload,
    client_created_at: new Date().toISOString(),
  })
}
function isNetworkError(e: any): boolean { return !(e instanceof ApiError) }

/* ============================================================================
   Generic CRUD section: T table + create form + delete + workflow actions.
   ============================================================================ */
function ResourceSection({ title, sub, path, cols, fields, defaults, actions, onRowClick, offlineEntityType, allowDelete = true, allowCreate = true }: {
  title: string; sub?: string; path: string; cols: [string, string][]; fields: FieldDef[]; defaults: any
  actions?: ActionDef[]; onRowClick?: (row: any) => void; offlineEntityType?: string
  allowDelete?: boolean; allowCreate?: boolean
}) {
  const st = useList(path)
  const toast = useToast(); const qc = useQueryClient()
  const [form, setForm] = useState<any>({ ...defaults })
  const [formError, setFormError] = useState('')
  const [matches, setMatches] = useState<any[]>([])

  const payload = () => {
    const out: any = {}
    fields.forEach((f) => {
      let v = form[f.key]
      if (f.type === 'checkbox') { out[f.key] = !!v; return }
      if (v === '' || v === undefined) { out[f.key] = null; return }
      if (f.type === 'number') { const n = Number(v); out[f.key] = Number.isNaN(n) ? null : n; return }
      out[f.key] = v
    })
    return out
  }

  const create = useMutation({
    mutationFn: async () => {
      const body = payload()
      if (!offlineEntityType) return post(path, body)
      try { return await post(path, body) }
      catch (e: any) {
        if (isNetworkError(e)) { await queueHrOffline(offlineEntityType, body); return { __queued: true } }
        throw e
      }
    },
    onSuccess: (d: any) => {
      if (d?.__queued) toast('Queued offline — will sync')
      else { toast('Saved'); setForm({ ...defaults }); setFormError(''); setMatches([]) }
      qc.invalidateQueries()
    },
    onError: (e: any) => {
      if (e?.status === 409) {
        const detail = e?.body?.detail || 'A matching record already exists.'
        setFormError(detail)
        setMatches(Array.isArray(e?.body?.matches) ? e.body.matches : [])
        toast(detail, false)
      } else toast(errMsg(e), false)
    },
  })
  const remove = useMutation({
    mutationFn: (r: any) => api(`/api${path}${r.id}/`, { method: 'DELETE' }),
    onSuccess: () => { toast('Deleted'); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })
  const act = useMutation({
    mutationFn: ({ row, action }: { row: any; action: string }) => post(`${path}${row.id}/${action}/`, {}),
    onSuccess: (_d: any, v: any) => { toast(`${v.action} done`); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })

  const showActions = (actions?.length ?? 0) > 0 || allowDelete
  const tableCols: [string, string][] = showActions ? [...cols, ['__actions', 'Actions']] : cols

  const renderCell = (row: any, key: string) => {
    if (key !== '__actions') return undefined
    return (<span className="inline-flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      {(actions ?? []).filter((a) => !a.when || a.when(row)).map((a) => (
        <button key={a.action} className="btn-ghost !py-1 !px-2 text-xs" disabled={act.isPending}
          onClick={() => act.mutate({ row, action: a.action })}>{a.label}</button>))}
      {allowDelete && <button className="btn-ghost !py-1 !px-2 text-xs" disabled={remove.isPending}
        onClick={() => { if (window.confirm('Delete this record?')) remove.mutate(row) }}>Delete</button>}
    </span>)
  }

  return (<Section title={title} sub={sub}>
    {allowCreate && (<div>
      <div className="grid md:grid-cols-3 gap-2">
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.kind === 'station' ? <StationSelect value={form[f.key] ?? ''} onChange={(v: string) => setForm({ ...form, [f.key]: v })} />
              : f.kind === 'user' ? <UserSelect value={form[f.key] ?? ''} onChange={(v: string) => setForm({ ...form, [f.key]: v })} />
              : f.type === 'select' ? (<select className="inp" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                <option value="">Select…</option>{(f.options ?? []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)
              : f.type === 'textarea' ? <textarea className="inp" value={form[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              : f.type === 'checkbox' ? <input type="checkbox" checked={!!form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} aria-label={f.label} />
              : <input className="inp" type={f.type ?? 'text'} value={form[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
          </Field>))}
      </div>
      {formError && (<div className="rounded-lg px-3 py-2 mt-2 text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
        <div>{formError}</div>
        {matches.length > 0 && (<ul className="mt-1 list-disc pl-4">
          {matches.map((m: any, i: number) => <li key={m.id ?? i}>{m.full_name || m.name || ''}{m.employee_code ? ` · ${m.employee_code}` : ''}{m.national_id ? ` · ID ${m.national_id}` : ''}{m.department ? ` · ${typeof m.department === 'object' ? (m.department.name ?? m.department.id) : m.department}` : ''}</li>)}
        </ul>)}
      </div>)}
      <div className="flex gap-2 mt-2">
        <button className="btn" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Saving…' : 'Add record'}</button>
        <button className="btn-ghost" onClick={() => { setForm({ ...defaults }); setFormError(''); setMatches([]) }}>Clear</button>
      </div>
    </div>)}
    <div className="mt-3">
      <T state={st} rows={st.rows} cols={tableCols} onRowClick={onRowClick} renderCell={renderCell} />
    </div>
  </Section>)
}

/* ---------- shared lookup hooks (one list call each; reused by sections) ---------- */
function useLookups() {
  const employees = useList('/hr-employees/')
  const departments = useList('/hr-departments/')
  const stations = useList('/stations/')
  const leaveTypes = useList('/hr-leave-types/')
  const positions = useList('/hr-job-positions/')
  const vacancies = useList('/hr-job-vacancies/')
  const candidates = useList('/hr-candidates/')
  const shifts = useList('/hr-shifts/')
  const runs = useList('/hr-payroll-runs/')
  const courses = useList('/hr-training-courses/')
  const assets = useList('/hr-company-assets/')
  return { employees, departments, stations, leaveTypes, positions, vacancies, candidates, shifts, runs, courses, assets }
}
function today(): string { return new Date().toISOString().slice(0, 10) }

/* ============================================================================
   HR DASHBOARD
   ============================================================================ */
function rowsFrom(data: any): any[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') return Object.entries(data).map(([name, value]) => ({ name, value }))
  return []
}
export function HRDashboard() {
  const dash = useQuery({ queryKey: ['hr-dashboard'], queryFn: () => api('/hr-dashboard/') })
  const d: any = dash.data ?? {}
  const kpis: [string, any][] = [
    ['Headcount', d.headcount ?? '—'],
    ['Active employees', d.active_employees ?? '—'],
    ['On leave', d.on_leave ?? '—'],
    ['Open vacancies', d.vacancies_open ?? '—'],
    ['Applications pending', d.applications_pending ?? '—'],
    ['Attendance today', d.attendance_today ?? '—'],
    ['Payroll cost (last run)', d.payroll_cost_last_run ?? '—'],
    ['Turnover (last 12m)', d.turnover_last_12m ?? '—'],
    ['Leave requests pending', d.leave_pending ?? '—'],
  ]
  const deptRows = rowsFrom(d.by_department)
  const stationRows = rowsFrom(d.by_station)
  const genericCols = (rows: any[]): [string, string][] => {
    if (!rows.length) return [['name', 'Name'], ['value', 'Value']]
    return Object.keys(rows[0]).slice(0, 4).map((k) => [k, k.replace(/_/g, ' ')])
  }
  if (dash.isError) return (<div className="card"><p className="text-sm" style={{ color: 'var(--danger)' }}>Could not load HR dashboard: {errMsg(dash.error)}</p>
    <button className="btn-ghost mt-2" onClick={() => dash.refetch()}>Retry</button></div>)
  return (<div>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
      {kpis.map(([l, v]) => <div key={l} className="card !p-3"><div className="lbl">{l}</div><div className="kpi">{String(v)}</div></div>)}
    </div>
    <Section title="Headcount by department" sub="From /api/hr-dashboard/">
      {deptRows.length ? <T rows={deptRows} cols={genericCols(deptRows)} /> : <p className="text-sm" style={{ color: 'var(--muted)' }}>No department breakdown returned.</p>}
    </Section>
    <Section title="Headcount by station" sub="From /api/hr-dashboard/">
      {stationRows.length ? <T rows={stationRows} cols={genericCols(stationRows)} /> : <p className="text-sm" style={{ color: 'var(--muted)' }}>No station breakdown returned.</p>}
    </Section>
  </div>)
}

/* ============================================================================
   RECRUITMENT
   ============================================================================ */
export function HRRecruitment() {
  const L = useLookups()
  const empOpts = toOpts(L.employees.rows, empLabel)
  const deptOpts = toOpts(L.departments.rows, deptLabel)
  const vacOpts = toOpts(L.vacancies.rows, (r: any) => r.title || r.code || String(r.id))
  const candOpts = toOpts(L.candidates.rows, (r: any) => r.full_name || r.name || String(r.id))
  return (<div>
    <ResourceSection title="Manpower Requests" sub="Approve / reject staffing requests"
      path="/hr-manpower-requests/" cols={[['title', 'Title'], ['department', 'Department'], ['position', 'Position'], ['requested_count', 'Count'], ['status', 'Status']]}
      fields={[
        { key: 'title', label: 'Title' }, { key: 'department', label: 'Department', type: 'select', options: deptOpts },
        { key: 'position', label: 'Position', type: 'select', options: toOpts(L.positions.rows, (r: any) => r.title || r.name || String(r.id)) },
        { key: 'requested_count', label: 'Requested count', type: 'number' }, { key: 'justification', label: 'Justification', type: 'textarea' },
        { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']] },
      ]} defaults={{ title: '', department: '', position: '', requested_count: 1, justification: '', status: 'pending' }}
      actions={[
        { label: 'Approve', action: 'approve', when: (r) => r.status !== 'approved' },
        { label: 'Reject', action: 'reject', when: (r) => r.status !== 'rejected' },
      ]} />
    <ResourceSection title="Job Vacancies" path="/hr-job-vacancies/"
      cols={[['title', 'Title'], ['department', 'Department'], ['position', 'Position'], ['status', 'Status'], ['closing_date', 'Closing']]}
      fields={[
        { key: 'title', label: 'Title' }, { key: 'department', label: 'Department', type: 'select', options: deptOpts },
        { key: 'position', label: 'Position', type: 'select', options: toOpts(L.positions.rows, (r: any) => r.title || r.name || String(r.id)) },
        { key: 'description', label: 'Description', type: 'textarea' }, { key: 'closing_date', label: 'Closing date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: [['open', 'Open'], ['closed', 'Closed'], ['draft', 'Draft']] },
      ]} defaults={{ title: '', department: '', position: '', description: '', closing_date: '', status: 'open' }} />
    <ResourceSection title="Applications" path="/hr-applications/"
      cols={[['candidate', 'Candidate'], ['vacancy', 'Vacancy'], ['status', 'Status'], ['applied_date', 'Applied']]}
      fields={[
        { key: 'candidate', label: 'Candidate', type: 'select', options: candOpts },
        { key: 'vacancy', label: 'Vacancy', type: 'select', options: vacOpts },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['shortlisted', 'Shortlisted'], ['rejected', 'Rejected'], ['hired', 'Hired']] },
        { key: 'applied_date', label: 'Applied date', type: 'date' }, { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ candidate: '', vacancy: '', status: 'pending', applied_date: today(), notes: '' }} />
    <ResourceSection title="Candidates" path="/hr-candidates/"
      cols={[['full_name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['status', 'Status']]}
      fields={[
        { key: 'full_name', label: 'Full name' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' },
        { key: 'status', label: 'Status', type: 'select', options: [['new', 'New'], ['shortlisted', 'Shortlisted'], ['rejected', 'Rejected'], ['hired', 'Hired']] },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ full_name: '', phone: '', email: '', status: 'new', notes: '' }} />
    <ResourceSection title="Screenings" path="/hr-screenings/"
      cols={[['candidate', 'Candidate'], ['application', 'Application'], ['result', 'Result'], ['status', 'Status']]}
      fields={[
        { key: 'candidate', label: 'Candidate', type: 'select', options: candOpts },
        { key: 'application', label: 'Application (ID)', type: 'number' },
        { key: 'result', label: 'Result', type: 'select', options: [['pass', 'Pass'], ['fail', 'Fail'], ['pending', 'Pending']] },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['completed', 'Completed']] },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ candidate: '', application: '', result: 'pending', status: 'pending', notes: '' }} />
    <ResourceSection title="Interviews" path="/hr-interviews/"
      cols={[['candidate', 'Candidate'], ['vacancy', 'Vacancy'], ['interview_date', 'Date'], ['status', 'Status']]}
      fields={[
        { key: 'candidate', label: 'Candidate', type: 'select', options: candOpts },
        { key: 'vacancy', label: 'Vacancy', type: 'select', options: vacOpts },
        { key: 'interview_date', label: 'Interview date', type: 'datetime-local' },
        { key: 'interviewer', label: 'Interviewer', type: 'select', options: empOpts },
        { key: 'status', label: 'Status', type: 'select', options: [['scheduled', 'Scheduled'], ['completed', 'Completed'], ['cancelled', 'Cancelled']] },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ candidate: '', vacancy: '', interview_date: '', interviewer: '', status: 'scheduled', notes: '' }} />
    <ResourceSection title="Assessments" path="/hr-assessments/"
      cols={[['candidate', 'Candidate'], ['score', 'Score'], ['result', 'Result'], ['status', 'Status']]}
      fields={[
        { key: 'candidate', label: 'Candidate', type: 'select', options: candOpts },
        { key: 'assessment_type', label: 'Assessment type' }, { key: 'score', label: 'Score', type: 'number' },
        { key: 'result', label: 'Result', type: 'select', options: [['pass', 'Pass'], ['fail', 'Fail'], ['pending', 'Pending']] },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['completed', 'Completed']] },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ candidate: '', assessment_type: '', score: '', result: 'pending', status: 'pending', notes: '' }} />
    <ResourceSection title="Offer Letters" sub="Accept an offer on behalf of the candidate record"
      path="/hr-offer-letters/" cols={[['candidate', 'Candidate'], ['vacancy', 'Vacancy'], ['salary', 'Salary'], ['status', 'Status']]}
      fields={[
        { key: 'candidate', label: 'Candidate', type: 'select', options: candOpts },
        { key: 'vacancy', label: 'Vacancy', type: 'select', options: vacOpts },
        { key: 'salary', label: 'Salary (ETB)', type: 'number' }, { key: 'start_date', label: 'Start date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['sent', 'Sent'], ['accepted', 'Accepted'], ['declined', 'Declined']] },
        { key: 'terms', label: 'Terms', type: 'textarea' },
      ]} defaults={{ candidate: '', vacancy: '', salary: '', start_date: '', status: 'draft', terms: '' }}
      actions={[{ label: 'Accept', action: 'accept', when: (r) => r.status !== 'accepted' }]} />
  </div>)
}

/* ============================================================================
   ONBOARDING
   ============================================================================ */
export function HROnboarding() {
  const L = useLookups()
  const empOpts = toOpts(L.employees.rows, empLabel)
  return (<div>
    <ResourceSection title="Onboarding Checklists" path="/hr-onboarding-checklists/"
      cols={[['employee', 'Employee'], ['status', 'Status'], ['due_date', 'Due date']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'title', label: 'Title' },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['in_progress', 'In progress'], ['completed', 'Completed']] },
        { key: 'due_date', label: 'Due date', type: 'date' }, { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ employee: '', title: '', status: 'pending', due_date: '', notes: '' }}
      actions={[{ label: 'Complete', action: 'complete', when: (r) => r.status !== 'completed' }]} />
    <ResourceSection title="Onboarding Tasks" path="/hr-onboarding-tasks/"
      cols={[['checklist', 'Checklist'], ['title', 'Task'], ['assigned_to', 'Assigned to'], ['status', 'Status']]}
      fields={[
        { key: 'checklist', label: 'Checklist (ID)', type: 'number' }, { key: 'title', label: 'Task' },
        { key: 'assigned_to', label: 'Assigned to', type: 'select', options: empOpts },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['done', 'Done'], ['overdue', 'Overdue']] },
        { key: 'due_date', label: 'Due date', type: 'date' },
      ]} defaults={{ checklist: '', title: '', assigned_to: '', status: 'pending', due_date: '' }} />
    <ResourceSection title="Employment Contracts" path="/hr-employment-contracts/"
      cols={[['employee', 'Employee'], ['contract_type', 'Type'], ['start_date', 'Start'], ['end_date', 'End'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'contract_type', label: 'Contract type', type: 'select', options: [['permanent', 'Permanent'], ['fixed_term', 'Fixed term'], ['probation', 'Probation'], ['seasonal', 'Seasonal']] },
        { key: 'start_date', label: 'Start date', type: 'date' }, { key: 'end_date', label: 'End date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['active', 'Active'], ['expired', 'Expired'], ['terminated', 'Terminated']] },
        { key: 'terms', label: 'Terms', type: 'textarea' },
      ]} defaults={{ employee: '', contract_type: 'permanent', start_date: today(), end_date: '', status: 'draft', terms: '' }} />
    <ResourceSection title="Document Verifications" path="/hr-document-verifications/"
      cols={[['employee', 'Employee'], ['document', 'Document'], ['verified', 'Verified'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'document', label: 'Document (ID)', type: 'number' },
        { key: 'verified', label: 'Verified', type: 'checkbox' },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['verified', 'Verified'], ['rejected', 'Rejected']] },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ employee: '', document: '', verified: false, status: 'pending', notes: '' }} />
  </div>)
}

/* ============================================================================
   EMPLOYEES — directory + profile, and employee self-service
   ============================================================================ */
function EmployeeProfile({ employeeId, onBack }: { employeeId: any; onBack: () => void }) {
  const toast = useToast(); const qc = useQueryClient()
  const emp = useQuery({ queryKey: ['hr-employee', employeeId], queryFn: () => api(`/hr-employees/${employeeId}/`) })
  const docs = useList('/hr-employee-documents/')
  const histories = useList('/hr-employment-histories/')
  const logs = useList('/hr-employee-status-logs/')
  const e: any = emp.data ?? {}
  const myDocs = useMemo(() => byEmployee(docs.rows, employeeId), [docs.rows, employeeId])
  const myHist = useMemo(() => byEmployee(histories.rows, employeeId), [histories.rows, employeeId])
  const myLogs = useMemo(() => byEmployee(logs.rows, employeeId), [logs.rows, employeeId])
  const transfers = useMemo(() => myHist.filter((h: any) => /transfer|promotion|change|reassign/i.test(String(h.history_type ?? h.change_type ?? h.type ?? ''))), [myHist])
  const archive = useMutation({
    mutationFn: () => post(`/hr-employees/${employeeId}/archive/`, {}),
    onSuccess: () => { toast('Employee archived'); qc.invalidateQueries(); emp.refetch() },
    onError: (x: any) => toast(errMsg(x), false),
  })
  if (emp.isLoading) return <div className="card">Loading employee…</div>
  if (emp.isError) return (<div className="card"><p className="text-sm" style={{ color: 'var(--danger)' }}>Could not load employee: {errMsg(emp.error)}</p><button className="btn-ghost mt-2" onClick={onBack}>Back to directory</button></div>)
  return (<div>
    <div className="flex flex-wrap gap-2 mb-4">
      <button className="btn-ghost" onClick={onBack}>← Back to directory</button>
      <button className="btn-ghost" disabled={archive.isPending} onClick={() => { if (window.confirm('Archive this employee?')) archive.mutate() }}>Archive employee</button>
    </div>
    <Section title={e.full_name || e.name || 'Employee profile'} sub={`${e.employee_code || e.employee_number || ''} · ${e.employment_status || e.status || ''}`}>
      <div className="grid md:grid-cols-4 gap-2 text-sm">
        {[['Department', typeof e.department === 'object' ? (e.department?.name ?? e.department?.id) : e.department],
          ['Station', typeof e.station === 'object' ? (e.station?.name ?? e.station?.id) : e.station],
          ['Position', typeof e.position === 'object' ? (e.position?.title ?? e.position?.id) : (e.position || e.job_position)],
          ['National ID', e.national_id], ['Phone', e.phone], ['Email', e.email],
          ['Hire date', e.hire_date || e.start_date], ['Employment type', e.employment_type]].map(([l, v]) => (
          <div key={l}><div className="lbl">{l}</div><div>{v ? String(v) : '—'}</div></div>))}
      </div>
    </Section>
    <Section title="Documents">
      <T state={docs} rows={myDocs} cols={[['document_type', 'Type'], ['file', 'File'], ['status', 'Status'], ['expiry_date', 'Expiry']]} />
    </Section>
    <Section title="Employment history">
      <T state={histories} rows={myHist} cols={[['history_type', 'Type'], ['effective_date', 'Effective'], ['from_value', 'From'], ['to_value', 'To'], ['notes', 'Notes']]} />
    </Section>
    <Section title="Transfers & promotions">
      {transfers.length
        ? <T rows={transfers} cols={[['history_type', 'Type'], ['effective_date', 'Effective'], ['from_value', 'From'], ['to_value', 'To'], ['notes', 'Notes']]} />
        : <p className="text-sm" style={{ color: 'var(--muted)' }}>No transfers or promotions recorded for this employee.</p>}
    </Section>
    <Section title="Status log">
      <T state={logs} rows={myLogs} cols={[['status', 'Status'], ['effective_date', 'Effective'], ['changed_by', 'Changed by'], ['reason', 'Reason']]} />
    </Section>
  </div>)
}

function SelfServiceLeave({ employeeId }: { employeeId: any }) {
  const L = useLookups()
  const requests = useList('/hr-leave-requests/')
  const toast = useToast(); const qc = useQueryClient()
  const [form, setForm] = useState<any>({ leave_type: '', start_date: today(), end_date: today(), reason: '' })
  const save = useMutation({
    mutationFn: async () => {
      const body = { employee: employeeId, ...form }
      try { return await post('/hr-leave-requests/', body) }
      catch (e: any) {
        if (isNetworkError(e)) { await queueHrOffline('hrm.leaverequest', body); return { __queued: true } }
        throw e
      }
    },
    onSuccess: (d: any) => { toast(d?.__queued ? 'Queued offline — will sync' : 'Leave request submitted'); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })
  const mine = useMemo(() => byEmployee(requests.rows, employeeId), [requests.rows, employeeId])
  return (<div>
    <Section title="Request leave" sub="Submitted for approval. If you are offline, the request is queued and will sync.">
      <div className="grid md:grid-cols-4 gap-2">
        <Field label="Leave type"><select className="inp" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}><option value="">Select…</option>{L.leaveTypes.rows.map((r: any) => <option key={r.id} value={r.id}>{r.name || r.code}</option>)}</select></Field>
        <Field label="Start date"><input className="inp" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
        <Field label="End date"><input className="inp" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
        <Field label="Reason"><input className="inp" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
      </div>
      <button className="btn mt-2" disabled={save.isPending} onClick={() => save.mutate()}>Submit leave request</button>
    </Section>
    <Section title="My leave requests"><T state={requests} rows={mine} cols={[['leave_type', 'Leave type'], ['start_date', 'Start'], ['end_date', 'End'], ['status', 'Status'], ['reason', 'Reason']]} /></Section>
  </div>)
}

function EmployeeSelfService() {
  const me = useMyEmployee(true)
  const payslips = useList('/hr-payslips/')
  const [tab, setTab] = useState<'profile' | 'leave' | 'payslips'>('profile')
  if (me.isLoading) return <div className="card">Loading your record…</div>
  if (me.isError) return (<div className="card"><p className="text-sm" style={{ color: 'var(--danger)' }}>Could not load your employee record: {errMsg(me.error)}</p>
    <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Ask HR to link your user account to an employee record.</p>
    <button className="btn-ghost mt-2" onClick={() => me.refetch()}>Retry</button></div>)
  const e: any = me.data ?? {}
  const mySlips = useMemo(() => byEmployee(payslips.rows, e.id), [payslips.rows, e.id])
  return (<div>
    <div className="flex flex-wrap gap-2 mb-4">
      {([['profile', 'My record'], ['leave', 'Leave requests'], ['payslips', 'My payslips']] as const).map(([k, l]) => (
        <button key={k} className={tab === k ? 'btn' : 'btn-ghost'} onClick={() => setTab(k)}>{l}</button>))}
    </div>
    {tab === 'profile' && (<Section title={e.full_name || e.name || 'My record'} sub={`${e.employee_code || e.employee_number || ''} · ${e.employment_status || e.status || ''}`}>
      <div className="grid md:grid-cols-4 gap-2 text-sm">
        {[['Department', typeof e.department === 'object' ? (e.department?.name ?? e.department?.id) : e.department],
          ['Station', typeof e.station === 'object' ? (e.station?.name ?? e.station?.id) : e.station],
          ['Position', typeof e.position === 'object' ? (e.position?.title ?? e.position?.id) : (e.position || e.job_position)],
          ['National ID', e.national_id], ['Phone', e.phone], ['Email', e.email],
          ['Hire date', e.hire_date || e.start_date], ['Employment type', e.employment_type]].map(([l, v]) => (
          <div key={l}><div className="lbl">{l}</div><div>{v ? String(v) : '—'}</div></div>))}
      </div>
    </Section>)}
    {tab === 'leave' && <SelfServiceLeave employeeId={e.id} />}
    {tab === 'payslips' && (<Section title="My payslips">
      <T state={payslips} rows={mySlips} cols={[['payroll_run', 'Payroll run'], ['period', 'Period'], ['gross', 'Gross'], ['deductions', 'Deductions'], ['net', 'Net'], ['status', 'Status']]} />
    </Section>)}
  </div>)
}

export function HREmployees() {
  const selfService = useSelfService()
  const L = useLookups()
  const [selectedId, setSelectedId] = useState<any>(null)
  if (selfService) return <EmployeeSelfService />
  if (selectedId) return <EmployeeProfile employeeId={selectedId} onBack={() => setSelectedId(null)} />
  const deptOpts = toOpts(L.departments.rows, deptLabel)
  return (<div>
    <ResourceSection title="Employees" sub="Select a row to open the employee profile (history, documents, status log, transfers/promotions). A duplicate national ID returns the matching records in the form error."
      path="/hr-employees/" cols={[['employee_code', 'Code'], ['full_name', 'Name'], ['department', 'Department'], ['position', 'Position'], ['station', 'Station'], ['employment_status', 'Status']]}
      fields={[
        { key: 'employee_code', label: 'Employee code' }, { key: 'full_name', label: 'Full name' },
        { key: 'national_id', label: 'National ID' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' },
        { key: 'department', label: 'Department', type: 'select', options: deptOpts },
        { key: 'position', label: 'Position', type: 'select', options: toOpts(L.positions.rows, (r: any) => r.title || r.name || String(r.id)) },
        { key: 'station', label: 'Station', kind: 'station' },
        { key: 'user', label: 'Linked user', kind: 'user' },
        { key: 'hire_date', label: 'Hire date', type: 'date' },
        { key: 'employment_status', label: 'Status', type: 'select', options: [['active', 'Active'], ['on_leave', 'On leave'], ['suspended', 'Suspended'], ['terminated', 'Terminated'], ['archived', 'Archived']] },
        { key: 'employment_type', label: 'Employment type', type: 'select', options: [['permanent', 'Permanent'], ['fixed_term', 'Fixed term'], ['probation', 'Probation'], ['seasonal', 'Seasonal']] },
      ]} defaults={{ employee_code: '', full_name: '', national_id: '', phone: '', email: '', department: '', position: '', station: '', user: '', hire_date: today(), employment_status: 'active', employment_type: 'permanent' }}
      actions={[{ label: 'Archive', action: 'archive', when: (r) => r.employment_status !== 'archived' }]}
      onRowClick={(r: any) => setSelectedId(r.id)} />
    <ResourceSection title="Employee Documents" path="/hr-employee-documents/"
      cols={[['employee', 'Employee'], ['document_type', 'Type'], ['status', 'Status'], ['expiry_date', 'Expiry']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: toOpts(L.employees.rows, empLabel) },
        { key: 'document_type', label: 'Document type', type: 'select', options: [['national_id', 'National ID'], ['photo', 'Photo'], ['certificate', 'Certificate'], ['contract', 'Contract'], ['other', 'Other']] },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['verified', 'Verified'], ['expired', 'Expired']] },
        { key: 'expiry_date', label: 'Expiry date', type: 'date' }, { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ employee: '', document_type: 'national_id', status: 'pending', expiry_date: '', notes: '' }} />
    <ResourceSection title="Employment Histories" path="/hr-employment-histories/"
      cols={[['employee', 'Employee'], ['history_type', 'Type'], ['effective_date', 'Effective'], ['from_value', 'From'], ['to_value', 'To']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: toOpts(L.employees.rows, empLabel) },
        { key: 'history_type', label: 'Type', type: 'select', options: [['hire', 'Hire'], ['transfer', 'Transfer'], ['promotion', 'Promotion'], ['salary_change', 'Salary change'], ['status_change', 'Status change'], ['other', 'Other']] },
        { key: 'effective_date', label: 'Effective date', type: 'date' },
        { key: 'from_value', label: 'From' }, { key: 'to_value', label: 'To' }, { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ employee: '', history_type: 'hire', effective_date: today(), from_value: '', to_value: '', notes: '' }} />
    <ResourceSection title="Employee Status Logs" path="/hr-employee-status-logs/"
      cols={[['employee', 'Employee'], ['status', 'Status'], ['effective_date', 'Effective'], ['reason', 'Reason']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: toOpts(L.employees.rows, empLabel) },
        { key: 'status', label: 'Status', type: 'select', options: [['active', 'Active'], ['on_leave', 'On leave'], ['suspended', 'Suspended'], ['terminated', 'Terminated']] },
        { key: 'effective_date', label: 'Effective date', type: 'date' }, { key: 'reason', label: 'Reason', type: 'textarea' },
      ]} defaults={{ employee: '', status: 'active', effective_date: today(), reason: '' }} />
  </div>)
}

/* ============================================================================
   ORG STRUCTURE
   ============================================================================ */
export function HROrgStructure() {
  const L = useLookups()
  const grades = useList('/hr-job-grades/')
  const deptOpts = toOpts(L.departments.rows, deptLabel)
  const empOpts = toOpts(L.employees.rows, empLabel)
  return (<div>
    <ResourceSection title="Departments" path="/hr-departments/"
      cols={[['code', 'Code'], ['name', 'Name'], ['parent', 'Parent'], ['is_active', 'Active']]}
      fields={[
        { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
        { key: 'parent', label: 'Parent department', type: 'select', options: deptOpts },
        { key: 'description', label: 'Description', type: 'textarea' }, { key: 'is_active', label: 'Active', type: 'checkbox' },
      ]} defaults={{ code: '', name: '', parent: '', description: '', is_active: true }} />
    <ResourceSection title="Job Positions" path="/hr-job-positions/"
      cols={[['title', 'Title'], ['department', 'Department'], ['grade', 'Grade'], ['is_active', 'Active']]}
      fields={[
        { key: 'title', label: 'Title' }, { key: 'department', label: 'Department', type: 'select', options: deptOpts },
        { key: 'grade', label: 'Grade', type: 'select', options: toOpts(grades.rows, (r: any) => r.name || r.code || String(r.id)) },
        { key: 'description', label: 'Description', type: 'textarea' }, { key: 'is_active', label: 'Active', type: 'checkbox' },
      ]} defaults={{ title: '', department: '', grade: '', description: '', is_active: true }} />
    <ResourceSection title="Job Grades" path="/hr-job-grades/"
      cols={[['code', 'Code'], ['name', 'Name'], ['level', 'Level'], ['min_salary', 'Min salary'], ['max_salary', 'Max salary']]}
      fields={[
        { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'level', label: 'Level', type: 'number' },
        { key: 'min_salary', label: 'Min salary (ETB)', type: 'number' }, { key: 'max_salary', label: 'Max salary (ETB)', type: 'number' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]} defaults={{ code: '', name: '', level: '', min_salary: '', max_salary: '', description: '' }} />
    <ResourceSection title="Reporting Lines" path="/hr-reporting-lines/"
      cols={[['employee', 'Employee'], ['manager', 'Manager'], ['is_active', 'Active']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'manager', label: 'Manager', type: 'select', options: empOpts },
        { key: 'is_active', label: 'Active', type: 'checkbox' },
      ]} defaults={{ employee: '', manager: '', is_active: true }} />
  </div>)
}

/* ============================================================================
   ATTENDANCE & TIME
   ============================================================================ */
export function HRAttendanceTime() {
  const L = useLookups()
  const empOpts = toOpts(L.employees.rows, empLabel)
  return (<div>
    <ResourceSection title="Shifts" path="/hr-shifts/"
      cols={[['name', 'Name'], ['code', 'Code'], ['start_time', 'Start'], ['end_time', 'End'], ['is_active', 'Active']]}
      fields={[
        { key: 'name', label: 'Name' }, { key: 'code', label: 'Code' },
        { key: 'start_time', label: 'Start time', type: 'text', placeholder: '08:00' },
        { key: 'end_time', label: 'End time', type: 'text', placeholder: '17:00' },
        { key: 'is_active', label: 'Active', type: 'checkbox' },
      ]} defaults={{ name: '', code: '', start_time: '08:00', end_time: '17:00', is_active: true }} />
    <ResourceSection title="Shift Assignments" path="/hr-shift-assignments/"
      cols={[['employee', 'Employee'], ['shift', 'Shift'], ['start_date', 'Start'], ['end_date', 'End'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'shift', label: 'Shift', type: 'select', options: toOpts(L.shifts.rows, (r: any) => r.name || r.code || String(r.id)) },
        { key: 'start_date', label: 'Start date', type: 'date' }, { key: 'end_date', label: 'End date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: [['active', 'Active'], ['ended', 'Ended']] },
      ]} defaults={{ employee: '', shift: '', start_date: today(), end_date: '', status: 'active' }} />
    <ResourceSection title="Time Entries (check-in / check-out)" sub="Check-ins are attempted online first; on network failure the entry is queued offline and will sync."
      path="/hr-time-entries/" offlineEntityType="hrm.timeentry"
      cols={[['employee', 'Employee'], ['date', 'Date'], ['check_in', 'Check-in'], ['check_out', 'Check-out'], ['hours_worked', 'Hours'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'check_in', label: 'Check-in', type: 'datetime-local' }, { key: 'check_out', label: 'Check-out', type: 'datetime-local' },
        { key: 'hours_worked', label: 'Hours worked', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: [['present', 'Present'], ['absent', 'Absent'], ['late', 'Late'], ['leave', 'Leave']] },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ employee: '', date: today(), check_in: '', check_out: '', hours_worked: '', status: 'present', notes: '' }} />
    <ResourceSection title="Timesheets" path="/hr-timesheets/"
      cols={[['employee', 'Employee'], ['period_start', 'From'], ['period_end', 'To'], ['total_hours', 'Total hours'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'period_start', label: 'Period start', type: 'date' }, { key: 'period_end', label: 'Period end', type: 'date' },
        { key: 'total_hours', label: 'Total hours', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['submitted', 'Submitted'], ['approved', 'Approved']] },
      ]} defaults={{ employee: '', period_start: today(), period_end: today(), total_hours: '', status: 'draft' }} />
    <ResourceSection title="Overtime Records" path="/hr-overtime-records/"
      cols={[['employee', 'Employee'], ['date', 'Date'], ['hours', 'Hours'], ['rate', 'Rate'], ['amount', 'Amount'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'date', label: 'Date', type: 'date' }, { key: 'hours', label: 'Hours', type: 'number' },
        { key: 'rate', label: 'Rate (ETB/hr)', type: 'number' }, { key: 'amount', label: 'Amount (ETB)', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']] },
        { key: 'reason', label: 'Reason', type: 'textarea' },
      ]} defaults={{ employee: '', date: today(), hours: '', rate: '', amount: '', status: 'pending', reason: '' }} />
  </div>)
}

/* ============================================================================
   LEAVE
   ============================================================================ */
function MyLeaveView() {
  // Employee self-service: own balances + own requests + offline-capable create.
  const me = useMyEmployee(true)
  const balances = useList('/hr-leave-balances/')
  if (me.isLoading) return <div className="card">Loading your record…</div>
  if (me.isError) return (<div className="card"><p className="text-sm" style={{ color: 'var(--danger)' }}>Could not load your employee record: {errMsg(me.error)}</p></div>)
  const e: any = me.data ?? {}
  const mine = useMemo(() => byEmployee(balances.rows, e.id), [balances.rows, e.id])
  return (<div>
    <Section title="My leave balances"><T state={balances} rows={mine} cols={[['leave_type', 'Leave type'], ['year', 'Year'], ['entitled_days', 'Entitled'], ['used_days', 'Used'], ['remaining_days', 'Remaining']]} /></Section>
    <SelfServiceLeave employeeId={e.id} />
  </div>)
}

export function HRLeave() {
  const selfService = useSelfService()
  const L = useLookups()
  if (selfService) return <MyLeaveView />
  const empOpts = toOpts(L.employees.rows, empLabel)
  const typeOpts = toOpts(L.leaveTypes.rows, (r: any) => r.name || r.code || String(r.id))
  return (<div>
    <ResourceSection title="Leave Types" path="/hr-leave-types/"
      cols={[['code', 'Code'], ['name', 'Name'], ['days_per_year', 'Days / year'], ['is_paid', 'Paid'], ['is_active', 'Active']]}
      fields={[
        { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
        { key: 'days_per_year', label: 'Days per year', type: 'number' },
        { key: 'is_paid', label: 'Paid', type: 'checkbox' }, { key: 'is_active', label: 'Active', type: 'checkbox' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]} defaults={{ code: '', name: '', days_per_year: '', is_paid: true, is_active: true, description: '' }} />
    <ResourceSection title="Leave Balances" path="/hr-leave-balances/"
      cols={[['employee', 'Employee'], ['leave_type', 'Leave type'], ['year', 'Year'], ['entitled_days', 'Entitled'], ['used_days', 'Used'], ['remaining_days', 'Remaining']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'leave_type', label: 'Leave type', type: 'select', options: typeOpts },
        { key: 'year', label: 'Year', type: 'number' },
        { key: 'entitled_days', label: 'Entitled days', type: 'number' }, { key: 'used_days', label: 'Used days', type: 'number' },
        { key: 'remaining_days', label: 'Remaining days', type: 'number' },
      ]} defaults={{ employee: '', leave_type: '', year: new Date().getFullYear(), entitled_days: '', used_days: 0, remaining_days: '' }} />
    <ResourceSection title="Leave Requests" sub="Approve / reject requests. Creates are attempted online first; on network failure the request is queued offline and will sync."
      path="/hr-leave-requests/" offlineEntityType="hrm.leaverequest"
      cols={[['employee', 'Employee'], ['leave_type', 'Leave type'], ['start_date', 'Start'], ['end_date', 'End'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'leave_type', label: 'Leave type', type: 'select', options: typeOpts },
        { key: 'start_date', label: 'Start date', type: 'date' }, { key: 'end_date', label: 'End date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']] },
        { key: 'reason', label: 'Reason', type: 'textarea' },
      ]} defaults={{ employee: '', leave_type: '', start_date: today(), end_date: today(), status: 'pending', reason: '' }}
      actions={[
        { label: 'Approve', action: 'approve', when: (r) => r.status !== 'approved' },
        { label: 'Reject', action: 'reject', when: (r) => r.status !== 'rejected' },
      ]} />
  </div>)
}

/* ============================================================================
   PAYROLL — runs with detail view (lines breakdown + payslip release state)
   ============================================================================ */
function normLine(r: any): any {
  const pick = (...keys: string[]) => { for (const k of keys) { if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k] } return '—' }
  return {
    ...r,
    employee: r.employee_name ?? r.employee_display ?? r.employee,
    basic: pick('basic', 'basic_salary', 'basic_pay', 'base_salary', 'basic_amount'),
    allowances: pick('allowances', 'total_allowances', 'allowance_total', 'allowance'),
    overtime: pick('overtime', 'overtime_pay', 'overtime_amount', 'overtime_total'),
    bonuses: pick('bonuses', 'bonus', 'total_bonuses', 'bonus_total'),
    gross: pick('gross', 'gross_pay', 'gross_salary', 'total_gross', 'gross_amount'),
    pension: pick('pension', 'pension_deduction', 'employee_pension', 'pension_amount'),
    taxable: pick('taxable', 'taxable_income', 'taxable_pay', 'taxable_amount'),
    tax: pick('tax', 'income_tax', 'tax_amount', 'tax_deduction'),
    deductions: pick('deductions', 'total_deductions', 'deduction_total'),
    net: pick('net', 'net_pay', 'net_salary', 'net_amount'),
    payslip_state: r.payslip_status ?? r.release_status ?? (r.payslip_released ? 'released' : (r.status ?? '—')),
  }
}
function PayrollRunDetail({ runId, onBack }: { runId: any; onBack: () => void }) {
  const toast = useToast(); const qc = useQueryClient()
  const run = useQuery({ queryKey: ['hr-payroll-run', runId], queryFn: () => api(`/hr-payroll-runs/${runId}/`) })
  const lines = useList('/hr-payroll-lines/')
  const slips = useList('/hr-payslips/')
  const r: any = run.data ?? {}
  const myLines = useMemo(() => lines.rows.filter((x: any) => {
    const v = x.payroll_run ?? x.run ?? x.payroll_run_id
    return String(v) === String(runId) || String(x.payroll_run?.id ?? '') === String(runId)
  }).map(normLine), [lines.rows, runId])
  const mySlips = useMemo(() => slips.rows.filter((x: any) => {
    const v = x.payroll_run ?? x.run ?? x.payroll_run_id
    return String(v) === String(runId) || String(x.payroll_run?.id ?? '') === String(runId)
  }), [slips.rows, runId])
  const act = useMutation({
    mutationFn: (action: string) => post(`/hr-payroll-runs/${runId}/${action}/`, {}),
    onSuccess: (_d: any, action: string) => { toast(`${action} done`); qc.invalidateQueries(); run.refetch() },
    onError: (e: any) => toast(errMsg(e), false),
  })
  const steps: [string, string][] = [['calculate', 'Calculate'], ['verify', 'Verify'], ['approve', 'Approve'], ['post-journal', 'Post journal'], ['pay', 'Pay']]
  return (<div>
    <div className="flex flex-wrap gap-2 mb-4">
      <button className="btn-ghost" onClick={onBack}>← Back to payroll runs</button>
      {steps.map(([a, l]) => <button key={a} className="btn" disabled={act.isPending} onClick={() => act.mutate(a)}>{l}</button>)}
    </div>
    <Section title={`Payroll run — ${r.period || r.name || r.code || runId}`} sub={`Status: ${r.status ?? '—'} · Period: ${r.period_start || ''} → ${r.period_end || ''}`}>
      <div className="grid md:grid-cols-4 gap-2 text-sm">
        {[['Gross', r.total_gross ?? r.gross], ['Deductions', r.total_deductions ?? r.deductions], ['Net', r.total_net ?? r.net], ['Employees', r.employee_count ?? myLines.length]].map(([l, v]) => (
          <div key={l}><div className="lbl">{l}</div><div>{v !== undefined && v !== null ? String(v) : '—'}</div></div>))}
      </div>
    </Section>
    <Section title="Payroll lines — full breakdown">
      <T state={lines} rows={myLines} cols={[['employee', 'Employee'], ['basic', 'Basic'], ['allowances', 'Allowances'], ['overtime', 'Overtime'], ['bonuses', 'Bonuses'], ['gross', 'Gross'], ['pension', 'Pension'], ['taxable', 'Taxable'], ['tax', 'Tax'], ['deductions', 'Deductions'], ['net', 'Net'], ['payslip_state', 'Payslip release state']]} />
    </Section>
    <Section title="Payslips in this run">
      <T state={slips} rows={mySlips} cols={[['employee', 'Employee'], ['gross', 'Gross'], ['net', 'Net'], ['status', 'Status']]} />
    </Section>
  </div>)
}

function MyPayslipsView() {
  const me = useMyEmployee(true)
  const slips = useList('/hr-payslips/')
  if (me.isLoading) return <div className="card">Loading your record…</div>
  if (me.isError) return (<div className="card"><p className="text-sm" style={{ color: 'var(--danger)' }}>Could not load your employee record: {errMsg(me.error)}</p></div>)
  const e: any = me.data ?? {}
  const mine = useMemo(() => byEmployee(slips.rows, e.id).map(normLine), [slips.rows, e.id])
  return (<Section title="My payslips">
    <T state={slips} rows={mine} cols={[['payroll_run', 'Payroll run'], ['period', 'Period'], ['basic', 'Basic'], ['allowances', 'Allowances'], ['overtime', 'Overtime'], ['bonuses', 'Bonuses'], ['gross', 'Gross'], ['pension', 'Pension'], ['taxable', 'Taxable'], ['tax', 'Tax'], ['deductions', 'Deductions'], ['net', 'Net'], ['payslip_state', 'Payslip release state']]} />
  </Section>)
}

export function HRPayroll() {
  const selfService = useSelfService()
  const L = useLookups()
  const [selectedRun, setSelectedRun] = useState<any>(null)
  if (selfService) return <MyPayslipsView />
  if (selectedRun) return <PayrollRunDetail runId={selectedRun} onBack={() => setSelectedRun(null)} />
  const empOpts = toOpts(L.employees.rows, empLabel)
  const runActs: ActionDef[] = [
    { label: 'Calculate', action: 'calculate' }, { label: 'Verify', action: 'verify' },
    { label: 'Approve', action: 'approve' }, { label: 'Post journal', action: 'post-journal' }, { label: 'Pay', action: 'pay' },
  ]
  return (<div>
    <ResourceSection title="Salary Structures" path="/hr-salary-structures/"
      cols={[['employee', 'Employee'], ['position', 'Position'], ['basic_salary', 'Basic'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'position', label: 'Position', type: 'select', options: toOpts(L.positions.rows, (r: any) => r.title || r.name || String(r.id)) },
        { key: 'basic_salary', label: 'Basic salary (ETB)', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: [['active', 'Active'], ['inactive', 'Inactive']] },
        { key: 'effective_date', label: 'Effective date', type: 'date' },
      ]} defaults={{ employee: '', position: '', basic_salary: '', status: 'active', effective_date: today() }} />
    <ResourceSection title="Benefits" path="/hr-benefits/"
      cols={[['employee', 'Employee'], ['benefit_type', 'Type'], ['amount', 'Amount'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'benefit_type', label: 'Benefit type', type: 'select', options: [['housing', 'Housing'], ['transport', 'Transport'], ['medical', 'Medical'], ['meal', 'Meal'], ['other', 'Other']] },
        { key: 'amount', label: 'Amount (ETB)', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: [['active', 'Active'], ['inactive', 'Inactive']] },
      ]} defaults={{ employee: '', benefit_type: 'housing', amount: '', status: 'active' }} />
    <ResourceSection title="Payroll Rules" path="/hr-payroll-rules/"
      cols={[['code', 'Code'], ['name', 'Name'], ['rule_type', 'Type'], ['is_active', 'Active']]}
      fields={[
        { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
        { key: 'rule_type', label: 'Rule type', type: 'select', options: [['allowance', 'Allowance'], ['deduction', 'Deduction'], ['overtime', 'Overtime'], ['other', 'Other']] },
        { key: 'value', label: 'Value', type: 'number' }, { key: 'is_active', label: 'Active', type: 'checkbox' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]} defaults={{ code: '', name: '', rule_type: 'allowance', value: '', is_active: true, description: '' }} />
    <ResourceSection title="Payroll Runs" sub="Select a run to see its lines breakdown and payslip release state, and to run calculate / verify / approve / post-journal / pay."
      path="/hr-payroll-runs/" cols={[['period', 'Period'], ['period_start', 'From'], ['period_end', 'To'], ['status', 'Status'], ['total_net', 'Total net']]}
      fields={[
        { key: 'period', label: 'Period', placeholder: 'e.g. 2026-10' },
        { key: 'period_start', label: 'Period start', type: 'date' }, { key: 'period_end', label: 'Period end', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['calculated', 'Calculated'], ['verified', 'Verified'], ['approved', 'Approved'], ['posted', 'Posted'], ['paid', 'Paid']] },
      ]} defaults={{ period: '', period_start: today(), period_end: today(), status: 'draft' }}
      actions={runActs} onRowClick={(r: any) => setSelectedRun(r.id)} />
    <ResourceSection title="Payroll Lines" path="/hr-payroll-lines/"
      cols={[['employee', 'Employee'], ['payroll_run', 'Run'], ['gross', 'Gross'], ['deductions', 'Deductions'], ['net', 'Net']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'payroll_run', label: 'Payroll run', type: 'select', options: toOpts(L.runs.rows, (r: any) => r.period || r.name || String(r.id)) },
        { key: 'basic', label: 'Basic', type: 'number' }, { key: 'gross', label: 'Gross', type: 'number' },
        { key: 'deductions', label: 'Deductions', type: 'number' }, { key: 'net', label: 'Net', type: 'number' },
      ]} defaults={{ employee: '', payroll_run: '', basic: '', gross: '', deductions: '', net: '' }} />
    <ResourceSection title="Payslips" path="/hr-payslips/"
      cols={[['employee', 'Employee'], ['payroll_run', 'Run'], ['period', 'Period'], ['gross', 'Gross'], ['net', 'Net'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'payroll_run', label: 'Payroll run', type: 'select', options: toOpts(L.runs.rows, (r: any) => r.period || r.name || String(r.id)) },
        { key: 'period', label: 'Period' },
        { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['released', 'Released'], ['paid', 'Paid']] },
      ]} defaults={{ employee: '', payroll_run: '', period: '', status: 'draft' }} />
  </div>)
}

/* ============================================================================
   PERFORMANCE
   ============================================================================ */
export function HRPerformance() {
  const L = useLookups()
  const empOpts = toOpts(L.employees.rows, empLabel)
  return (<div>
    <ResourceSection title="KPIs" path="/hr-kpis/"
      cols={[['code', 'Code'], ['name', 'Name'], ['target', 'Target'], ['unit', 'Unit'], ['is_active', 'Active']]}
      fields={[
        { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
        { key: 'target', label: 'Target', type: 'number' }, { key: 'unit', label: 'Unit' },
        { key: 'is_active', label: 'Active', type: 'checkbox' }, { key: 'description', label: 'Description', type: 'textarea' },
      ]} defaults={{ code: '', name: '', target: '', unit: '', is_active: true, description: '' }} />
    <ResourceSection title="Performance Reviews" path="/hr-performance-reviews/"
      cols={[['employee', 'Employee'], ['reviewer', 'Reviewer'], ['period', 'Period'], ['score', 'Score'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'reviewer', label: 'Reviewer', type: 'select', options: empOpts },
        { key: 'period', label: 'Period', placeholder: 'e.g. 2026-Q3' },
        { key: 'score', label: 'Score', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['submitted', 'Submitted'], ['approved', 'Approved']] },
        { key: 'comments', label: 'Comments', type: 'textarea' },
      ]} defaults={{ employee: '', reviewer: '', period: '', score: '', status: 'draft', comments: '' }} />
  </div>)
}

/* ============================================================================
   TRAINING
   ============================================================================ */
export function HRTraining() {
  const L = useLookups()
  const empOpts = toOpts(L.employees.rows, empLabel)
  const courseOpts = toOpts(L.courses.rows, (r: any) => r.title || r.name || String(r.id))
  return (<div>
    <ResourceSection title="Training Courses" path="/hr-training-courses/"
      cols={[['title', 'Title'], ['code', 'Code'], ['duration_days', 'Days'], ['provider', 'Provider'], ['is_active', 'Active']]}
      fields={[
        { key: 'title', label: 'Title' }, { key: 'code', label: 'Code' },
        { key: 'duration_days', label: 'Duration (days)', type: 'number' }, { key: 'provider', label: 'Provider' },
        { key: 'is_active', label: 'Active', type: 'checkbox' }, { key: 'description', label: 'Description', type: 'textarea' },
      ]} defaults={{ title: '', code: '', duration_days: '', provider: '', is_active: true, description: '' }} />
    <ResourceSection title="Training Plans" path="/hr-training-plans/"
      cols={[['title', 'Title'], ['year', 'Year'], ['status', 'Status']]}
      fields={[
        { key: 'title', label: 'Title' }, { key: 'year', label: 'Year', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['approved', 'Approved'], ['completed', 'Completed']] },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]} defaults={{ title: '', year: new Date().getFullYear(), status: 'draft', description: '' }} />
    <ResourceSection title="Training Enrollments" path="/hr-training-enrollments/"
      cols={[['employee', 'Employee'], ['course', 'Course'], ['status', 'Status'], ['completed_date', 'Completed']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'course', label: 'Course', type: 'select', options: courseOpts },
        { key: 'status', label: 'Status', type: 'select', options: [['enrolled', 'Enrolled'], ['in_progress', 'In progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']] },
        { key: 'completed_date', label: 'Completed date', type: 'date' },
      ]} defaults={{ employee: '', course: '', status: 'enrolled', completed_date: '' }} />
    <ResourceSection title="Certifications" path="/hr-certifications/"
      cols={[['employee', 'Employee'], ['name', 'Certification'], ['issuer', 'Issuer'], ['expiry_date', 'Expiry'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'name', label: 'Certification' }, { key: 'issuer', label: 'Issuer' },
        { key: 'issue_date', label: 'Issue date', type: 'date' }, { key: 'expiry_date', label: 'Expiry date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: [['active', 'Active'], ['expired', 'Expired'], ['revoked', 'Revoked']] },
      ]} defaults={{ employee: '', name: '', issuer: '', issue_date: '', expiry_date: '', status: 'active' }} />
    <ResourceSection title="Competency Assessments" path="/hr-competency-assessments/"
      cols={[['employee', 'Employee'], ['competency', 'Competency'], ['score', 'Score'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'competency', label: 'Competency' }, { key: 'score', label: 'Score', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['completed', 'Completed']] },
        { key: 'assessed_date', label: 'Assessed date', type: 'date' }, { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ employee: '', competency: '', score: '', status: 'draft', assessed_date: today(), notes: '' }} />
  </div>)
}

/* ============================================================================
   EMPLOYEE RELATIONS
   ============================================================================ */
export function HRRelations() {
  const L = useLookups()
  const empOpts = toOpts(L.employees.rows, empLabel)
  return (<div>
    <ResourceSection title="Grievances" path="/hr-grievances/"
      cols={[['employee', 'Employee'], ['subject', 'Subject'], ['status', 'Status'], ['raised_date', 'Raised']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'subject', label: 'Subject' }, { key: 'raised_date', label: 'Raised date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: [['open', 'Open'], ['investigating', 'Investigating'], ['resolved', 'Resolved'], ['closed', 'Closed']] },
        { key: 'description', label: 'Description', type: 'textarea' }, { key: 'resolution', label: 'Resolution', type: 'textarea' },
      ]} defaults={{ employee: '', subject: '', raised_date: today(), status: 'open', description: '', resolution: '' }} />
    <ResourceSection title="Disciplinary Cases" path="/hr-disciplinary-cases/"
      cols={[['employee', 'Employee'], ['case_type', 'Type'], ['status', 'Status'], ['incident_date', 'Incident date']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'case_type', label: 'Type', type: 'select', options: [['warning', 'Warning'], ['suspension', 'Suspension'], ['termination', 'Termination'], ['other', 'Other']] },
        { key: 'incident_date', label: 'Incident date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: [['open', 'Open'], ['hearing', 'Hearing'], ['decided', 'Decided'], ['closed', 'Closed']] },
        { key: 'description', label: 'Description', type: 'textarea' }, { key: 'outcome', label: 'Outcome', type: 'textarea' },
      ]} defaults={{ employee: '', case_type: 'warning', incident_date: today(), status: 'open', description: '', outcome: '' }} />
  </div>)
}

/* ============================================================================
   ASSETS & CLEARANCE
   ============================================================================ */
export function HRAssetsClearance() {
  const L = useLookups()
  const empOpts = toOpts(L.employees.rows, empLabel)
  const assetOpts = toOpts(L.assets.rows, (r: any) => r.name || r.code || r.asset_tag || String(r.id))
  return (<div>
    <ResourceSection title="Company Assets" path="/hr-company-assets/"
      cols={[['code', 'Code'], ['name', 'Name'], ['assigned_to', 'Assigned to'], ['condition', 'Condition'], ['status', 'Status']]}
      fields={[
        { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
        { key: 'assigned_to', label: 'Assigned to', type: 'select', options: empOpts },
        { key: 'condition', label: 'Condition', type: 'select', options: [['new', 'New'], ['good', 'Good'], ['fair', 'Fair'], ['damaged', 'Damaged']] },
        { key: 'status', label: 'Status', type: 'select', options: [['available', 'Available'], ['assigned', 'Assigned'], ['returned', 'Returned'], ['lost', 'Lost']] },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]} defaults={{ code: '', name: '', assigned_to: '', condition: 'good', status: 'available', description: '' }} />
    <ResourceSection title="Asset Returns" path="/hr-asset-returns/"
      cols={[['asset', 'Asset'], ['employee', 'Employee'], ['return_date', 'Returned'], ['condition', 'Condition'], ['status', 'Status']]}
      fields={[
        { key: 'asset', label: 'Asset', type: 'select', options: assetOpts },
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'return_date', label: 'Return date', type: 'date' },
        { key: 'condition', label: 'Condition', type: 'select', options: [['good', 'Good'], ['fair', 'Fair'], ['damaged', 'Damaged']] },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['received', 'Received']] },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ asset: '', employee: '', return_date: today(), condition: 'good', status: 'pending', notes: '' }} />
    <ResourceSection title="Clearance Checklists" path="/hr-clearance-checklists/"
      cols={[['employee', 'Employee'], ['status', 'Status'], ['completed_date', 'Completed']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['in_progress', 'In progress'], ['cleared', 'Cleared']] },
        { key: 'completed_date', label: 'Completed date', type: 'date' }, { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ employee: '', status: 'pending', completed_date: '', notes: '' }} />
  </div>)
}

/* ============================================================================
   SEPARATION
   ============================================================================ */
export function HRSeparation() {
  const L = useLookups()
  const empOpts = toOpts(L.employees.rows, empLabel)
  return (<div>
    <ResourceSection title="Separation Requests" sub="Workflow: manager approve → HR approve → settle → deactivate."
      path="/hr-separation-requests/"
      cols={[['employee', 'Employee'], ['separation_type', 'Type'], ['last_working_date', 'Last working day'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'separation_type', label: 'Type', type: 'select', options: [['resignation', 'Resignation'], ['termination', 'Termination'], ['retirement', 'Retirement'], ['end_of_contract', 'End of contract']] },
        { key: 'request_date', label: 'Request date', type: 'date' }, { key: 'last_working_date', label: 'Last working date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['manager_approved', 'Manager approved'], ['hr_approved', 'HR approved'], ['settled', 'Settled'], ['deactivated', 'Deactivated'], ['rejected', 'Rejected']] },
        { key: 'reason', label: 'Reason', type: 'textarea' },
      ]} defaults={{ employee: '', separation_type: 'resignation', request_date: today(), last_working_date: '', status: 'pending', reason: '' }}
      actions={[
        { label: 'Manager approve', action: 'manager-approve' },
        { label: 'HR approve', action: 'hr-approve' },
        { label: 'Settle', action: 'settle' },
        { label: 'Deactivate', action: 'deactivate' },
      ]} />
    <ResourceSection title="Handovers" path="/hr-handovers/"
      cols={[['employee', 'Employee'], ['handover_to', 'Handover to'], ['status', 'Status'], ['due_date', 'Due']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'handover_to', label: 'Handover to', type: 'select', options: empOpts },
        { key: 'due_date', label: 'Due date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['in_progress', 'In progress'], ['completed', 'Completed']] },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ employee: '', handover_to: '', due_date: '', status: 'pending', notes: '' }} />
    <ResourceSection title="Exit Interviews" path="/hr-exit-interviews/"
      cols={[['employee', 'Employee'], ['interview_date', 'Date'], ['interviewer', 'Interviewer'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'interview_date', label: 'Interview date', type: 'date' },
        { key: 'interviewer', label: 'Interviewer', type: 'select', options: empOpts },
        { key: 'status', label: 'Status', type: 'select', options: [['scheduled', 'Scheduled'], ['completed', 'Completed']] },
        { key: 'feedback', label: 'Feedback', type: 'textarea' },
      ]} defaults={{ employee: '', interview_date: today(), interviewer: '', status: 'scheduled', feedback: '' }} />
    <ResourceSection title="Final Settlements" path="/hr-final-settlements/"
      cols={[['employee', 'Employee'], ['total_due', 'Total due'], ['total_deductions', 'Deductions'], ['net_amount', 'Net'], ['status', 'Status']]}
      fields={[
        { key: 'employee', label: 'Employee', type: 'select', options: empOpts },
        { key: 'total_due', label: 'Total due (ETB)', type: 'number' },
        { key: 'total_deductions', label: 'Total deductions (ETB)', type: 'number' },
        { key: 'net_amount', label: 'Net amount (ETB)', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['approved', 'Approved'], ['paid', 'Paid']] },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]} defaults={{ employee: '', total_due: '', total_deductions: '', net_amount: '', status: 'draft', notes: '' }} />
  </div>)
}

/* ============================================================================
   REPORTS
   ============================================================================ */
export function HRReports() {
  return (<div>
    <ResourceSection title="Report Definitions" path="/hr-report-definitions/"
      cols={[['code', 'Code'], ['name', 'Name'], ['kind', 'Kind'], ['is_active', 'Active']]}
      fields={[
        { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
        { key: 'kind', label: 'Kind', type: 'select', options: [['headcount', 'Headcount'], ['turnover', 'Turnover'], ['leave', 'Leave'], ['payroll', 'Payroll'], ['attendance', 'Attendance'], ['other', 'Other']] },
        { key: 'is_active', label: 'Active', type: 'checkbox' }, { key: 'description', label: 'Description', type: 'textarea' },
      ]} defaults={{ code: '', name: '', kind: 'headcount', is_active: true, description: '' }} />
    <ResourceSection title="Approval Records" sub="Audit trail of HR workflow approvals."
      path="/hr-approval-records/" allowCreate={false} allowDelete={false}
      cols={[['entity_type', 'Entity'], ['entity_id', 'Record'], ['approver', 'Approver'], ['decision', 'Decision'], ['decided_at', 'Decided at']]}
      fields={[]} defaults={{}} />
  </div>)
}

/* ============================================================================
   SETTINGS — tax & pension are configurable defaults, not law.
   ============================================================================ */
export function HRSettings() {
  return (<div>
    <div className="rounded-lg px-3 py-2 mb-4 text-sm" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }} role="alert">
      Tax brackets &amp; pension rates are CONFIGURABLE DEFAULTS — confirm with Finance/HR against current proclamations before paying staff.
    </div>
    <ResourceSection title="Tax Brackets" sub="Configurable defaults — confirm against current proclamations before paying staff."
      path="/hr-tax-brackets/"
      cols={[['name', 'Name'], ['min_income', 'Min income'], ['max_income', 'Max income'], ['rate', 'Rate %'], ['is_active', 'Active']]}
      fields={[
        { key: 'name', label: 'Name' }, { key: 'min_income', label: 'Min income (ETB)', type: 'number' },
        { key: 'max_income', label: 'Max income (ETB)', type: 'number' }, { key: 'rate', label: 'Rate (%)', type: 'number' },
        { key: 'is_active', label: 'Active', type: 'checkbox' },
      ]} defaults={{ name: '', min_income: '', max_income: '', rate: '', is_active: true }} />
    <ResourceSection title="Pension Rules" sub="Configurable defaults — confirm against current proclamations before paying staff."
      path="/hr-pension-rules/"
      cols={[['name', 'Name'], ['employee_rate', 'Employee %'], ['employer_rate', 'Employer %'], ['is_active', 'Active']]}
      fields={[
        { key: 'name', label: 'Name' }, { key: 'employee_rate', label: 'Employee rate (%)', type: 'number' },
        { key: 'employer_rate', label: 'Employer rate (%)', type: 'number' }, { key: 'is_active', label: 'Active', type: 'checkbox' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]} defaults={{ name: '', employee_rate: '', employer_rate: '', is_active: true, description: '' }} />
    <ResourceSection title="Payroll Rules" path="/hr-payroll-rules/"
      cols={[['code', 'Code'], ['name', 'Name'], ['rule_type', 'Type'], ['is_active', 'Active']]}
      fields={[
        { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
        { key: 'rule_type', label: 'Rule type', type: 'select', options: [['allowance', 'Allowance'], ['deduction', 'Deduction'], ['overtime', 'Overtime'], ['other', 'Other']] },
        { key: 'value', label: 'Value', type: 'number' }, { key: 'is_active', label: 'Active', type: 'checkbox' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]} defaults={{ code: '', name: '', rule_type: 'allowance', value: '', is_active: true, description: '' }} />
    <ResourceSection title="Approval Workflows" path="/hr-approval-workflows/"
      cols={[['name', 'Name'], ['entity_type', 'Applies to'], ['steps', 'Steps'], ['is_active', 'Active']]}
      fields={[
        { key: 'name', label: 'Name' }, { key: 'entity_type', label: 'Applies to', placeholder: 'e.g. leave_request' },
        { key: 'steps', label: 'Steps', type: 'number' }, { key: 'is_active', label: 'Active', type: 'checkbox' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]} defaults={{ name: '', entity_type: '', steps: 1, is_active: true, description: '' }} />
    <ResourceSection title="HR Policies" path="/hr-policies/"
      cols={[['code', 'Code'], ['title', 'Title'], ['category', 'Category'], ['is_active', 'Active']]}
      fields={[
        { key: 'code', label: 'Code' }, { key: 'title', label: 'Title' },
        { key: 'category', label: 'Category', type: 'select', options: [['leave', 'Leave'], ['conduct', 'Conduct'], ['payroll', 'Payroll'], ['safety', 'Safety'], ['other', 'Other']] },
        { key: 'effective_date', label: 'Effective date', type: 'date' }, { key: 'is_active', label: 'Active', type: 'checkbox' },
        { key: 'content', label: 'Content', type: 'textarea' },
      ]} defaults={{ code: '', title: '', category: 'leave', effective_date: today(), is_active: true, content: '' }} />
    <ResourceSection title="Shift Policies" path="/hr-shift-policies/"
      cols={[['name', 'Name'], ['grace_minutes', 'Grace (min)'], ['overtime_after_hours', 'Overtime after (hrs)'], ['is_active', 'Active']]}
      fields={[
        { key: 'name', label: 'Name' }, { key: 'grace_minutes', label: 'Grace minutes', type: 'number' },
        { key: 'overtime_after_hours', label: 'Overtime after (hours)', type: 'number' },
        { key: 'is_active', label: 'Active', type: 'checkbox' }, { key: 'description', label: 'Description', type: 'textarea' },
      ]} defaults={{ name: '', grace_minutes: '', overtime_after_hours: '', is_active: true, description: '' }} />
  </div>)
}
