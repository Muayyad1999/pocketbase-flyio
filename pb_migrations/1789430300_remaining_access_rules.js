migrate((app) => {
  const active = "@request.auth.id != '' && @request.auth.status = 'active' && (@request.auth.locked_until = '' || @request.auth.locked_until <= @now)";
  for (const name of ['notifications', 'sessions', 'backup_logs']) {
    const collection = app.findCollectionByNameOrId(name);
    for (const key of ['listRule','viewRule','createRule','updateRule','deleteRule']) {
      if (collection[key] !== null) collection[key] = active + ' && (' + collection[key] + ')';
    }
    app.save(collection);
  }
});
