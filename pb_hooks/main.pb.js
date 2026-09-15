// Request hooks stamp trusted actor identities; model hooks enforce invariants,
// including writes made by batch API calls, dashboard and server code.
// Public capability metadata lets clients reject an older server before writes.
routerAdd('GET', '/api/accounting/status', (e) => e.json(200, {schema_version: 3}));

onRecordCreateRequest((e) => {
  if (e.record.collection().name === 'receipts' && e.record.getString('receipt_type') === 'salary' && e.auth && !e.auth.isSuperuser()) {
    const permissions = JSON.parse(e.auth.getString('permissions') || 'null');
    const role = e.auth.getString('role');
    if (!['admin','manager'].includes(role) && !(permissions ? permissions.payroll && permissions.payroll.process : role === 'accountant')) throw new ForbiddenError('Payroll processing permission is required for salary payments.');
  }
  if (e.auth) {
    e.record.set('__audit_actor', {id: e.auth.isSuperuser() ? '' : e.auth.id, username: e.auth.getString('username') || 'superuser'});
    if (!e.auth.isSuperuser() && e.record.collection().fields.getByName('created_by')) e.record.set('created_by', e.auth.id);
  }
  e.next();
}, 'employees', 'departments', 'external_parties', 'representatives', 'receipts', 'payroll_entries', 'payroll_months', 'daily_inventory_entries', 'student_id_receipts', 'users');

onRecordUpdateRequest((e) => {
  if (e.record.collection().name === 'receipts' && (e.record.getString('receipt_type') === 'salary' || e.record.original().getString('receipt_type') === 'salary') && e.auth && !e.auth.isSuperuser()) {
    const permissions = JSON.parse(e.auth.getString('permissions') || 'null');
    const role = e.auth.getString('role');
    if (!['admin','manager'].includes(role) && !(permissions ? permissions.payroll && permissions.payroll.process : role === 'accountant')) throw new ForbiddenError('Payroll processing permission is required for salary payments.');
  }
  if (e.auth) e.record.set('__audit_actor', {id: e.auth.isSuperuser() ? '' : e.auth.id, username: e.auth.getString('username') || 'superuser'});
  if (e.record.collection().fields.getByName('created_by')) e.record.set('created_by', e.record.original().getString('created_by'));
  e.next();
}, 'employees', 'departments', 'external_parties', 'representatives', 'receipts', 'payroll_entries', 'payroll_months', 'daily_inventory_entries', 'student_id_receipts', 'users');

onRecordDeleteRequest((e) => {
  if (e.record.collection().name === 'receipts' && e.record.getString('receipt_type') === 'salary' && e.auth && !e.auth.isSuperuser()) {
    const permissions = JSON.parse(e.auth.getString('permissions') || 'null');
    const role = e.auth.getString('role');
    if (!['admin','manager'].includes(role) && !(permissions ? permissions.payroll && permissions.payroll.process : role === 'accountant')) throw new ForbiddenError('Payroll processing permission is required for salary reversals.');
  }
  if (e.auth) e.record.set('__audit_actor', {id: e.auth.isSuperuser() ? '' : e.auth.id, username: e.auth.getString('username') || 'superuser'});
  e.next();
}, 'employees', 'departments', 'external_parties', 'representatives', 'receipts', 'payroll_entries', 'payroll_months', 'daily_inventory_entries', 'student_id_receipts', 'users');

onRecordCreate((e) => require(__hooks + '/accounting.js').mutate(e, 'create'), 'employees', 'departments', 'external_parties', 'representatives', 'receipts', 'payroll_entries', 'payroll_months', 'daily_inventory_entries', 'student_id_receipts', 'users');
onRecordUpdate((e) => require(__hooks + '/accounting.js').mutate(e, 'update'), 'employees', 'departments', 'external_parties', 'representatives', 'receipts', 'payroll_entries', 'payroll_months', 'daily_inventory_entries', 'student_id_receipts', 'users');
onRecordDelete((e) => require(__hooks + '/accounting.js').mutate(e, 'delete'), 'employees', 'departments', 'external_parties', 'representatives', 'receipts', 'payroll_entries', 'payroll_months', 'daily_inventory_entries', 'student_id_receipts', 'users');

// Client event telemetry is explicitly distinguishable from authoritative changes.
onRecordCreateRequest((e) => {
  if (!e.auth || e.auth.isSuperuser()) return e.next();
  e.record.set('user_id', e.auth.id); e.record.set('username', e.auth.getString('username'));
  e.record.set('timestamp', new Date().toISOString());
  const metadata = JSON.parse(e.record.getString('metadata') || 'null') || {};
  metadata.source = 'client'; metadata.transactional = false;
  e.record.set('metadata', metadata);
  e.next();
}, 'audit_logs');

onRecordEnrich((e) => {
  const auth = e.requestInfo.auth;
  if (auth && (auth.isSuperuser() || auth.id === e.record.id || auth.getString('role') === 'admin')) return e.next();
  e.record.hide('permissions', 'email', 'failed_login_attempts', 'locked_until', 'last_login', 'last_password_change');
  e.next();
}, 'users');

routerAdd('GET', '/api/accounting/students', (e) => {
  if (!e.auth || e.auth.collection().name !== 'users' || e.auth.getString('status') !== 'active') throw new ForbiddenError();
  const lockedUntil = e.auth.getString('locked_until');
  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) throw new ForbiddenError();
  const role = e.auth.getString('role'); const permissions = JSON.parse(e.auth.getString('permissions') || 'null');
  if (!['admin', 'manager'].includes(role) && !(permissions ? permissions.student_id_receipts && permissions.student_id_receipts.view : ['accountant','viewer','auditor'].includes(role))) throw new ForbiddenError();
  const type = e.request.url.query().get('type');
  const q = e.request.url.query().get('q').trim();
  if (!['accepted', 'enrolled'].includes(type) || q.length < 2 || q.length > 100) throw new BadRequestError('Choose a valid student type and enter 2 to 100 characters.');
  const token = $os.getenv('STUDENT_API_TOKEN');
  const endpoint = $os.getenv(type === 'accepted' ? 'STUDENT_ACCEPTED_API_URL' : 'STUDENT_ENROLLED_API_URL');
  if (!token || !endpoint) return e.json(503, {message: 'Student search is not configured on the server.'});
  if (!/^https?:\/\//.test(endpoint)) return e.json(503, {message: 'Student service URL is invalid.'});
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = endpoint + separator + 'searchTxt=' + encodeURIComponent(q) + (type === 'accepted' ? '&searchType=AllAcceptStudents' : '');
  try {
    const result = $http.send({url, method: 'GET', headers: {'Authorization': 'Bearer ' + token, 'Accept': 'application/json'}, timeout: 10});
    if (result.statusCode !== 200 || !Array.isArray(result.json)) return e.json(503, {message: 'The student service returned an invalid response.'});
    return e.json(200, result.json);
  } catch (_) {
    return e.json(503, {message: 'The student service is currently unavailable. Please try again.'});
  }
}, $apis.requireAuth('users'));

routerAdd('POST', '/api/accounting/payroll/{id}/reconcile', (e) => {
  if (e.auth.getString('status') !== 'active') throw new ForbiddenError();
  const lockedUntil = e.auth.getString('locked_until');
  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) throw new ForbiddenError();
  const role = e.auth.getString('role');
  const permissions = JSON.parse(e.auth.getString('permissions') || 'null');
  if (!['admin','manager'].includes(role) && !(permissions ? permissions.payroll && permissions.payroll.process : role === 'accountant')) throw new ForbiddenError();
  return require(__hooks + '/accounting.js').reconcile(e);
}, $apis.requireAuth('users'));
