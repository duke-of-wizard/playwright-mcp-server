/**
 * MCP Server Integration Test
 * Navigates to google.com and searches for "shoes"
 */

const MCP_URL = 'https://playwright-mcp-server-production-57e6.up.railway.app/mcp';
const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/event-stream',
};

let sessionId = null;
let reqId = 0;

// ─── MCP helpers ────────────────────────────────────────────────────────────

async function mcpCall(method, params = {}) {
  const id = ++reqId;
  const headers = { ...HEADERS };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });

  // Capture session ID from response
  const newSid = res.headers.get('mcp-session-id');
  if (newSid) sessionId = newSid;

  const text = await res.text();

  // Parse SSE or plain JSON
  const dataLine = text.split('\n').find(l => l.startsWith('data:'));
  const json = dataLine ? JSON.parse(dataLine.replace('data:', '').trim()) : JSON.parse(text);

  if (json.error) throw new Error(`MCP error: ${json.error.message}`);
  return json.result;
}

async function callTool(name, args = {}) {
  const result = await mcpCall('tools/call', { name, arguments: args });
  return result?.content?.[0]?.text ?? '';
}

// ─── Assertions ─────────────────────────────────────────────────────────────

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  ✓ ${message}`);
}

// ─── Test ────────────────────────────────────────────────────────────────────

async function runTest() {
  console.log('\n🎭 MCP Integration Test: Google Search\n');

  // 1. Initialize
  process.stdout.write('Connecting to MCP server... ');
  const init = await mcpCall('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mcp-test', version: '1.0' },
  });
  console.log(`connected (${init.serverInfo.name} v${init.serverInfo.version})`);

  // 2. List tools
  const { tools } = await mcpCall('tools/list');
  assert(tools.length > 0, `Server exposes ${tools.length} tools`);
  assert(tools.some(t => t.name === 'browser_navigate'), 'browser_navigate tool available');
  assert(tools.some(t => t.name === 'browser_snapshot'), 'browser_snapshot tool available');
  assert(tools.some(t => t.name === 'browser_type'), 'browser_type tool available');

  // 3. Navigate to Google
  console.log('\nStep 1: Navigate to google.com');
  const navResult = await callTool('browser_navigate', { url: 'https://www.google.com' });
  console.log('  nav response:', navResult.slice(0, 200));
  assert(!navResult.toLowerCase().includes('error'), 'Navigated to google.com without error');

  // 4. Snapshot to verify Google loaded
  console.log('\nStep 2: Verify Google search page loaded');
  const snapshot = await callTool('browser_snapshot');
  assert(snapshot.includes('google') || snapshot.includes('Search'), 'Google search page loaded');

  // 5. Type search query
  console.log('\nStep 3: Type "shoes" in search box');
  const typeResult = await callTool('browser_type', {
    element: 'search input',
    ref: 'textarea[name="q"], input[name="q"]',
    text: 'shoes',
  });
  assert(!typeResult.toLowerCase().includes('error'), 'Typed "shoes" in search box');

  // 6. Press Enter to search
  console.log('\nStep 4: Press Enter to submit search');
  await callTool('browser_press_key', { key: 'Enter' });

  // 7. Wait for results
  await new Promise(r => setTimeout(r, 2000));

  // 8. Snapshot results page
  console.log('\nStep 5: Verify search results');
  const resultsSnapshot = await callTool('browser_snapshot');
  assert(
    resultsSnapshot.toLowerCase().includes('shoes'),
    'Search results page contains "shoes"'
  );

  // 9. Take screenshot as proof
  console.log('\nStep 6: Take screenshot of results');
  const screenshot = await callTool('browser_take_screenshot');
  assert(screenshot.length > 0, 'Screenshot captured');

  console.log('\n✅ All tests passed!\n');
}

// ─── Run ─────────────────────────────────────────────────────────────────────

runTest().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
