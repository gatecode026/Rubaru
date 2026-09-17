/**
 * Enforces explicit user permission before allowing any database seeding scripts to run.
 * To run a seed script, the caller MUST set RUBARU_ALLOW_SEEDING=true AND pass --confirm-seed-rubaru flag.
 */
function assertSeedPermission(scriptName = 'Seed Script') {
  const envAllowed = process.env.RUBARU_ALLOW_SEEDING === 'true';
  const flagProvided = process.argv.includes('--confirm-seed-rubaru');

  if (!envAllowed || !flagProvided) {
    console.error('\n' + '='.repeat(70));
    console.error(`🛑 FATAL: ${scriptName} BLOCKED.`);
    console.error('Database seeding is strictly forbidden without explicit permission.');
    console.error('To proceed, you must:');
    console.error('  1. Set environment variable: RUBARU_ALLOW_SEEDING=true');
    console.error('  2. Pass execution flag:     --confirm-seed-rubaru');
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }

  console.log(`[SEED PERMISSION GRANTED] Executing ${scriptName} with explicit user confirmation.`);
}

module.exports = assertSeedPermission;
