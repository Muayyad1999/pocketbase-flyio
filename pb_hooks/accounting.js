// Shared server-only accounting operations. Always use the supplied transaction app.
function scalar(app, sql, params) {
  const result = new DynamicModel({value: 0});
  app.db().newQuery(sql).bind(params || {}).one(result);
  return Number(result.value) || 0;
}

function nextReceiptNumber(app, record) {
  const student = record.collection().name === 'student_id_receipts';
  const prefixes = {payment: 'DIS', receipt: 'RCV', salary: 'SAL', receiving: 'TRF', petty_cash: 'PTY', rent: 'RNT', garage_income: 'GRG'};
  const prefix = student ? 'SID' : (prefixes[record.getString('receipt_type')] || 'REC');
  const date = record.getString(student ? 'issue_date' : 'payment_date').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(date)) throw new BadRequestError('A valid receipt date is required.');
  const key = prefix + '-' + date + '-';
  const records = app.findRecordsByFilter('accounting_sequences', 'key = {:key}', '', 1, 0, {key});
  const sequence = records.length ? records[0] : new Record(app.findCollectionByNameOrId('accounting_sequences'));
  let previous = sequence.getInt('value');
  if (!records.length) {
    previous = scalar(app, 'SELECT COALESCE(MAX(CAST(substr(receipt_number, {:start}) AS INTEGER)), 0) AS value FROM ' + record.collection().name + ' WHERE receipt_number LIKE {:prefix}', {start: key.length + 1, prefix: key + '%'});
    sequence.set('key', key);
  }
  sequence.set('value', previous + 1); app.save(sequence);
  record.set('receipt_number', key + String(previous + 1).padStart(4, '0'));
}

function money(value, name) {
  const n = Number(value || 0);
  if (!Number.isSafeInteger(n) || n < 0) throw new BadRequestError(name + ' must be a non-negative whole IQD amount.');
  return n;
}

function amounts(record, field) {
  const raw = record.getString(field);
  const data = raw ? JSON.parse(raw) : null;
  const values = Array.isArray(data) ? data : [];
  if (data && !Array.isArray(data)) throw new BadRequestError(field + ' must be an array.');
  return values.reduce((sum, item) => sum + money(item.amount, field), 0);
}

function payrollMonth(app, id) {
  if (!id) throw new BadRequestError('A payroll month is required.');
  return app.findRecordById('payroll_months', id);
}

function requireOpen(app, id) {
  const month = payrollMonth(app, id);
  if (month.getBool('is_closed')) throw new BadRequestError('Reopen the payroll month before changing its entries or salary receipts.');
  return month;
}

function paidFor(app, employee, month, exclude) {
  return scalar(app, "SELECT COALESCE(SUM(amount), 0) AS value FROM receipts WHERE receipt_type = 'salary' AND receiver_employee_id = {:employee} AND payroll_month_id = {:month} AND id != {:exclude}", {employee, month, exclude: exclude || ''});
}

function calculateEntry(app, record) {
  const base = money(record.get('base_salary'), 'Base salary');
  const allowances = amounts(record, 'allowances');
  const fixed = amounts(record, 'fixed_deductions');
  const rate = record.getFloat('social_security_rate');
  if (rate < 0) throw new BadRequestError('Social security must be non-negative.');
  // Preserve the established data convention: <=100 is a percentage; >100 is fixed IQD.
  const social = rate > 100 ? money(rate, 'Social security') : Math.round(base * rate / 100);
  const days = record.getInt('absence_days');
  if (days < 0 || days > 31) throw new BadRequestError('Absence days must be between 0 and 31.');
  const absence = money(record.get('absence_deduction'), 'Absence deduction');
  const deduction = fixed + social + absence + money(record.get('loan_deduction'), 'Loan deduction');
  const net = Math.max(0, Math.round((base + allowances - deduction) / 1000) * 1000);
  const paid = paidFor(app, record.getString('employee_id'), record.getString('payroll_month_id'));
  if (paid > net) throw new BadRequestError('Net salary cannot be lower than salary payments already recorded.');
  record.set('social_security_amount', social);
  record.set('total_deductions', deduction); record.set('net_salary', net);
  record.set('payment_status', paid > 0 && paid >= net ? 'paid' : 'pending');
  if (paid === 0) { record.set('payment_date', ''); record.set('payment_receipt_id', ''); }
}

function updateMonthTotals(app, monthId) {
  if (!monthId) return;
  // SQL updates avoid recursive model hooks. Inputs are bound, never interpolated.
  app.db().newQuery(`UPDATE payroll_months SET
    employee_count = (SELECT COUNT(*) FROM payroll_entries WHERE payroll_month_id = {:month}),
    total_base_salary = (SELECT COALESCE(SUM(base_salary),0) FROM payroll_entries WHERE payroll_month_id = {:month}),
    total_allowances = (SELECT COALESCE(SUM(CAST(json_extract(j.value, '$.amount') AS INTEGER)),0) FROM payroll_entries e, json_each(CASE WHEN json_valid(e.allowances) THEN e.allowances ELSE '[]' END) j WHERE e.payroll_month_id = {:month}),
    total_deductions = (SELECT COALESCE(SUM(total_deductions),0) FROM payroll_entries WHERE payroll_month_id = {:month}),
    total_net_salary = (SELECT COALESCE(SUM(net_salary),0) FROM payroll_entries WHERE payroll_month_id = {:month}),
    is_paid = (EXISTS(SELECT 1 FROM payroll_entries WHERE payroll_month_id = {:month}) AND NOT EXISTS(SELECT 1 FROM payroll_entries WHERE payroll_month_id = {:month} AND net_salary > 0 AND payment_status != 'paid')),
    updated = strftime('%Y-%m-%d %H:%M:%fZ','now') WHERE id = {:month}`).bind({month: monthId}).execute();
}

function updateSalaryStatus(app, employee, month) {
  if (!employee || !month) return;
  const paid = paidFor(app, employee, month);
  app.db().newQuery(`UPDATE payroll_entries SET
    payment_status = CASE WHEN {:paid} > 0 AND {:paid} >= net_salary THEN 'paid' ELSE 'pending' END,
    payment_date = CASE WHEN {:paid} > 0 AND {:paid} >= net_salary THEN (SELECT MAX(payment_date) FROM receipts WHERE receipt_type='salary' AND receiver_employee_id={:employee} AND payroll_month_id={:month}) ELSE '' END,
    payment_receipt_id = CASE WHEN {:paid} > 0 AND {:paid} >= net_salary THEN COALESCE((SELECT id FROM receipts WHERE receipt_type='salary' AND receiver_employee_id={:employee} AND payroll_month_id={:month} ORDER BY payment_date DESC, created DESC LIMIT 1),'') ELSE '' END,
    updated = strftime('%Y-%m-%d %H:%M:%fZ','now') WHERE employee_id={:employee} AND payroll_month_id={:month}`).bind({paid, employee, month}).execute();
  updateMonthTotals(app, month);
}

function validateReceipt(app, record) {
  const amount = money(record.get('amount'), 'Receipt amount');
  if (amount <= 0) throw new BadRequestError('Receipt amount must be greater than zero.');
  if (record.getString('receipt_type') !== 'salary') return;
  const month = requireOpen(app, record.getString('payroll_month_id'));
  const employee = record.getString('receiver_employee_id');
  if (!employee || record.getString('receiver_type') !== 'employee') throw new BadRequestError('Salary receipts require an employee receiver.');
  if (record.getString('currency') !== 'IQD') throw new BadRequestError('Salary payments must use IQD.');
  const entries = app.findRecordsByFilter('payroll_entries', 'employee_id = {:employee} && payroll_month_id = {:month}', '', 1, 0, {employee, month: month.id});
  if (!entries.length) throw new BadRequestError('Generate the employee payroll entry before paying this salary.');
  const paid = paidFor(app, employee, month.id, record.id);
  if (paid + amount > entries[0].getInt('net_salary')) throw new BadRequestError('Payment exceeds the remaining salary balance.');
  record.set('salary_month', month.getInt('month')); record.set('salary_year', month.getInt('year'));
  record.set('payment_status', 'paid');
}

function validateStudent(app, record, action, original) {
  if (!record.getString('student_type')) record.set('student_type', 'accepted');
  const changedIdentity = action === 'create' || ['student_id','study_year','student_type'].some(k => record.getString(k) !== original.getString(k));
  if (!changedIdentity) return; // Existing duplicate history remains editable and reviewable.
  const matches = app.findRecordsByFilter('student_id_receipts', 'student_id = {:student} && study_year = {:year} && (student_type = {:type} || (student_type = "" && {:type} = "accepted")) && id != {:id}', '', 1, 0, {student: record.getString('student_id'), year: record.getString('study_year'), type: record.getString('student_type'), id: record.id});
  if (matches.length) throw new BadRequestError('A student ID receipt already exists for this student, academic year and student type.');
}

function audit(app, record, action, original) {
  const log = new Record(app.findCollectionByNameOrId('audit_logs'));
  const actor = record.get('__audit_actor');
  // When an administrator deletes their own account, retain actor metadata without
  // creating an invalid relation back to the record that just left this transaction.
  const actorDeleted = action === 'delete' && record.collection().name === 'users' && actor && actor.id === record.id;
  log.set('user_id', actor && !actorDeleted && actor.id || '');
  log.set('username', actor && actor.username || 'server');
  log.set('action', action); log.set('collection', record.collection().name);
  log.set('record_id', record.id); log.set('timestamp', new Date().toISOString());
  log.set('severity', action === 'delete' ? 'warning' : 'info');
  function publicData(r) {
    if (!r) return null;
    const out = r.publicExport();
    for (const key in out) if (/password|token|secret|^__/.test(key.toLowerCase())) delete out[key];
    return out;
  }
  log.set('changes', {before: action === 'create' ? null : publicData(original), after: action === 'delete' ? null : publicData(record)});
  log.set('metadata', {source: 'server', transactional: true, actor_id: actor && actor.id || ''});
  app.save(log);
}

function mutate(e, action) {
  const r = e.record; const name = r.collection().name;
  const original = action === 'create' ? null : r.original();
  e.app.runInTransaction((tx) => {
    e.app = tx;
    // Acquire the SQLite writer before balance reads, serializing concurrent payments.
    tx.db().newQuery("UPDATE accounting_sequences SET value=value WHERE key='' ").execute();
    if (name === 'employees' && action === 'delete') {
      const payrollHistory = scalar(tx, 'SELECT COUNT(*) AS value FROM payroll_entries WHERE employee_id={:id}', {id:r.id});
      const receiptHistory = scalar(tx, 'SELECT COUNT(*) AS value FROM receipts WHERE sender_employee_id={:id} OR receiver_employee_id={:id} OR department_representative_id={:id}', {id:r.id});
      if (payrollHistory || receiptHistory) throw new BadRequestError('Employees with financial history cannot be deleted. Deactivate the employee instead.');
    }
    if (name === 'payroll_entries') {
      requireOpen(tx, r.getString('payroll_month_id'));
      if (original && (original.getString('employee_id') !== r.getString('employee_id') || original.getString('payroll_month_id') !== r.getString('payroll_month_id')) && paidFor(tx, original.getString('employee_id'), original.getString('payroll_month_id')) > 0) throw new BadRequestError('An entry with recorded salary payments cannot be reassigned.');
      if (original && original.getString('payroll_month_id') !== r.getString('payroll_month_id')) requireOpen(tx, original.getString('payroll_month_id'));
      if (action === 'delete') {
        if (paidFor(tx, r.getString('employee_id'), r.getString('payroll_month_id')) > 0) throw new BadRequestError('Remove salary receipts before deleting a payroll entry.');
      } else calculateEntry(tx, r);
    }
    if (name === 'payroll_months') {
      if (action === 'delete' && scalar(tx, 'SELECT COUNT(*) AS value FROM payroll_entries WHERE payroll_month_id={:id}', {id:r.id}) > 0) throw new BadRequestError('Remove payroll entries before deleting the month.');
      if (action !== 'delete' && r.getString('start_date') > r.getString('end_date')) throw new BadRequestError('Payroll start date must precede end date.');
    }
    if (name === 'receipts') {
      if (original && original.getString('receipt_type') === 'salary' && original.getString('payroll_month_id')) requireOpen(tx, original.getString('payroll_month_id'));
      if (action !== 'delete') validateReceipt(tx, r);
    }
    if (name === 'student_id_receipts' && action !== 'delete') validateStudent(tx, r, action, original);
    if (action === 'create' && (name === 'receipts' || name === 'student_id_receipts')) nextReceiptNumber(tx, r);
    if (action === 'update' && (name === 'receipts' || name === 'student_id_receipts')) r.set('receipt_number', original.getString('receipt_number'));
    e.next();
    if (name === 'receipts') {
      if (original && original.getString('receipt_type') === 'salary') updateSalaryStatus(tx, original.getString('receiver_employee_id'), original.getString('payroll_month_id'));
      if (action !== 'delete' && r.getString('receipt_type') === 'salary') updateSalaryStatus(tx, r.getString('receiver_employee_id'), r.getString('payroll_month_id'));
    }
    if (name === 'payroll_entries') {
      updateMonthTotals(tx, r.getString('payroll_month_id'));
      if (original && original.getString('payroll_month_id') !== r.getString('payroll_month_id')) updateMonthTotals(tx, original.getString('payroll_month_id'));
    }
    if (name === 'payroll_months' && action !== 'delete') updateMonthTotals(tx, r.id);
    audit(tx, r, action, original);
  });
}

function reconcile(e) {
  const id = e.request.pathValue('id');
  let result;
  e.app.runInTransaction((tx) => {
    tx.db().newQuery("UPDATE accounting_sequences SET value=value WHERE key='' ").execute();
    const month = requireOpen(tx, id);
    const existingReceipts = tx.findRecordsByFilter('receipts', 'receipt_type = "salary" && payroll_month_id = {:id}', '', 0, 0, {id});
    for (const receipt of existingReceipts) {
      const matches = tx.findRecordsByFilter('payroll_entries', 'employee_id = {:employee} && payroll_month_id = {:month}', '', 1, 0, {employee:receipt.getString('receiver_employee_id'),month:id});
      if (!matches.length) throw new BadRequestError('Salary receipt ' + receipt.getString('receipt_number') + ' needs a valid employee and payroll entry before reconciliation.');
    }
    const unlinked = tx.findRecordsByFilter('receipts', 'receipt_type = "salary" && payroll_month_id = "" && salary_month = {:month} && salary_year = {:year}', '', 0, 0, {month:month.getInt('month'),year:month.getInt('year')});
    for (const receipt of unlinked) {
      receipt.set('payroll_month_id', id);
      receipt.set('__audit_actor', {id:e.auth.id,username:e.auth.getString('username')});
      tx.save(receipt);
    }
    const entries = tx.findRecordsByFilter('payroll_entries', 'payroll_month_id = {:id}', '', 0, 0, {id});
    for (const entry of entries) {
      entry.set('__audit_actor', {id:e.auth.id,username:e.auth.getString('username')});
      tx.save(entry);
      updateSalaryStatus(tx, entry.getString('employee_id'), id);
    }
    updateMonthTotals(tx, id);
    result = {linked_receipts:unlinked.length, entries:entries.length, month:tx.findRecordById('payroll_months',id).publicExport()};
  });
  return e.json(200, result);
}

module.exports = {mutate, reconcile};
