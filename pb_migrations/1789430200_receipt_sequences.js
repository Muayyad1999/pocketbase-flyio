migrate((app) => {
  app.save(new Collection({
    name: 'accounting_sequences', type: 'base',
    fields: [
      {name: 'key', type: 'text', required: true, max: 100},
      {name: 'value', type: 'number', min: 0, onlyInt: true},
    ],
    indexes: ['CREATE UNIQUE INDEX idx_accounting_sequence_key ON accounting_sequences (key)'],
  }));
});
