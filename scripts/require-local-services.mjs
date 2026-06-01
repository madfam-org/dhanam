const value = String(process.env.LOCAL_SERVICES ?? '').trim().toLowerCase();

if (!['1', 'true', 'yes'].includes(value)) {
  console.error('Refusing to start local Dhanam services without LOCAL_SERVICES=yes. This repo handles sensitive financial, identity, billing, provider, document, and estate-planning data.');
  process.exit(1);
}
