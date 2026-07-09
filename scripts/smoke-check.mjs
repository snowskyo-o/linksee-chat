const target = "http://localhost:3010/health";

try {
  const response = await fetch(target);
  const payload = await response.json();
  console.log(JSON.stringify(payload, null, 2));
  process.exit(response.ok ? 0 : 1);
} catch (error) {
  console.error(`[smoke-check] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
