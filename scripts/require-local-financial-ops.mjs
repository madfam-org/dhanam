const value = String(process.env.LOCAL_FINANCIAL_OPS ?? '').trim().toLowerCase();

if (!['1', 'true', 'yes'].includes(value)) {
  console.error('Refusing to run payment/billing/provider/webhook/import/export/load-test operations without LOCAL_FINANCIAL_OPS=yes and explicit operator approval.');
  process.exit(1);
}
