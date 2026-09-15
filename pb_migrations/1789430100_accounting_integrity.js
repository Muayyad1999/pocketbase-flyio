// Non-destructive upgrade for the supplied database and fresh installations.
migrate((app) => {
  const active = "@request.auth.id != '' && @request.auth.status = 'active' && (@request.auth.locked_until = '' || @request.auth.locked_until <= @now)";
  const elevated = "(@request.auth.role = 'admin' || @request.auth.role = 'manager')";
  const admin = active + " && @request.auth.role = 'admin'";
  const modules = {
    departments: 'departments', employees: 'employees', external_parties: 'external_parties',
    representatives: 'external_parties', payroll_entries: 'payroll', payroll_months: 'payroll',
    receipts: 'receipts', daily_inventory_entries: 'daily_inventory',
    student_id_receipts: 'student_id_receipts', student_id_receipt_summary: 'student_id_receipts',
    duplicates: 'student_id_receipts', employee_statistics: 'employees',
    monthly_payroll_summary: 'payroll', receipt_summary: 'receipts',
    system_settings: 'settings', app_version: 'settings', audit_logs: 'audit_logs',
  };
  const defaults = {
    audit_logs: ['view', 'export'], daily_inventory: ['view', 'create', 'edit', 'delete'],
    departments: ['view'], employees: ['view', 'create', 'edit', 'export'],
    external_parties: ['view', 'create', 'edit'], payroll: ['view', 'create', 'edit', 'export', 'process'],
    receipts: ['view', 'create', 'edit', 'export'], reports: ['view', 'export'],
    settings: ['view'], users: [], student_id_receipts: ['view', 'create', 'edit', 'delete', 'export'],
  };
  function rule(module, action) {
    const allowed = [elevated, '@request.auth.permissions.' + module + '.' + action + ' = true'];
    // A missing permissions object means the same role preset used by Flutter.
    if ((defaults[module] || []).includes(action)) {
      allowed.push("(@request.auth.role = 'accountant' && @request.auth.permissions = null)");
    }
    if (action === 'view') allowed.push("(@request.auth.role = 'viewer' || @request.auth.role = 'auditor') && @request.auth.permissions = null");
    return active + ' && (' + allowed.join(' || ') + ')';
  }
  for (const name in modules) {
    const c = app.findCollectionByNameOrId(name);
    c.listRule = rule(modules[name], 'view'); c.viewRule = c.listRule;
    if (c.type !== 'view') {
      c.createRule = rule(modules[name], 'create');
      c.updateRule = rule(modules[name], 'edit');
      c.deleteRule = rule(modules[name], 'delete');
    }
    if (name === 'audit_logs') {
      c.createRule = active; c.updateRule = null; c.deleteRule = null;
    }
    if (name === 'app_version' || name === 'system_settings') {
      c.createRule = admin; c.updateRule = admin; c.deleteRule = admin;
    }
    if (c.type === 'base') {
      if (!c.fields.getByName('created')) c.fields.add(new AutodateField({name: 'created', onCreate: true}));
      if (!c.fields.getByName('updated')) c.fields.add(new AutodateField({name: 'updated', onCreate: true, onUpdate: true}));
    }
    app.save(c);
  }
  const users = app.findCollectionByNameOrId('users');
  users.fields.getByName('role').values = ['admin', 'accountant', 'manager', 'viewer', 'auditor'];
  users.authRule = "status = 'active' && (locked_until = '' || locked_until <= @now)";
  users.passwordAuth.identityFields = ['username', 'email'];
  users.listRule = active; users.viewRule = active;
  users.createRule = admin; users.deleteRule = admin; users.manageRule = admin;
  users.updateRule = active + " && (@request.auth.role = 'admin' || (id = @request.auth.id && @request.body.role:changed = false && @request.body.permissions:changed = false && @request.body.status:changed = false && @request.body.locked_until:changed = false && @request.body.failed_login_attempts:changed = false && @request.body.verified:changed = false))";
  if (!users.fields.getByName('created')) users.fields.add(new AutodateField({name: 'created', onCreate: true}));
  if (!users.fields.getByName('updated')) users.fields.add(new AutodateField({name: 'updated', onCreate: true, onUpdate: true}));
  app.save(users);
  const entries = app.findCollectionByNameOrId('payroll_entries');
  entries.fields.getByName('payroll_month_id').required = true;
  if (!entries.fields.getByName('absence_deduction')) entries.fields.add(new NumberField({name: 'absence_deduction', min: 0, onlyInt: true}));
  if (!entries.fields.getByName('department_id')) entries.fields.add(new RelationField({name: 'department_id', collectionId: app.findCollectionByNameOrId('departments').id, maxSelect: 1}));
  for (const field of ['social_security_amount', 'loan_deduction', 'total_deductions', 'net_salary']) entries.fields.getByName(field).min = 0;
  entries.fields.getByName('social_security_rate').min = 0;
  entries.fields.getByName('social_security_rate').max = null;
  entries.fields.getByName('absence_days').max = 31;
  app.save(entries);
  app.db().newQuery('UPDATE payroll_entries SET department_id = COALESCE((SELECT department_id FROM employees WHERE employees.id = payroll_entries.employee_id),\'\') WHERE department_id = \'\'').execute();
  const months = app.findCollectionByNameOrId('payroll_months');
  months.addIndex('idx_payroll_year_month', true, 'year, month', ''); app.save(months);
  const receipts = app.findCollectionByNameOrId('receipts');
  receipts.fields.getByName('receipt_number').pattern = '^[A-Z]+-[0-9]{4}-[0-9]{2}-[0-9]{4,}$';
  receipts.fields.getByName('amount').min = 1;
  receipts.fields.getByName('attachments').protected = true;
  for (const name of ['department_representative_name', 'representative_name']) {
    if (!receipts.fields.getByName(name)) receipts.fields.add(new TextField({name, max: 200}));
  }
  app.save(receipts);
  const students = app.findCollectionByNameOrId('student_id_receipts');
  students.fields.getByName('receipt_number').pattern = '^SID-[0-9]{4}-[0-9]{2}-[0-9]{4,}$';
  students.addIndex('idx_sid_student_identity', false, 'student_id, study_year, student_type', ''); app.save(students);
  const inventory = app.findCollectionByNameOrId('daily_inventory_entries');
  inventory.fields.getByName('amount').min = 1; app.save(inventory);
  const settings = app.settings();
  settings.meta.appName = 'Al-Salam Accounting';
  settings.batch.enabled = true; settings.batch.maxRequests = 1000; settings.batch.timeout = 60;
  app.save(settings);
  // No rollback callback: restoring the pre-upgrade backup is the safe rollback,
  // because dropping newly written fields would discard accounting information.
});
