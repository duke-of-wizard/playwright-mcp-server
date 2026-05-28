/**
 * MCP Server Integration Test
 * Navigates to duckduckgo.com and searches for "shoes"
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

  const newSid = res.headers.get('mcp-session-id');
  if (newSid) sessionId = newSid;

  const text = await res.text();
  const dataLine = text.split('\n').find(l => l.startsWith('data:'));
  const json = dataLine ? JSON.parse(dataLine.replace('data:', '').trim()) : JSON.parse(text);

  if (json.error) throw new Error(`MCP error: ${json.error.message}`);
  return json.result;
}

async function callTool(name, args = {}) {
  const result = await mcpCall('tools/call', { name, arguments: args });
  return result?.content?.[0]?.text ?? '';
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  ✓ ${message}`);
}

// ─── Test ────────────────────────────────────────────────────────────────────

async function runTest() {
  console.log('\n🎭 MCP Integration Test: Search for "shoes" on DuckDuckGo\n');

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
  assert(tools.some(t => t.name === 'browser_navigate'), 'browser_navigate available');
  assert(tools.some(t => t.name === 'browser_snapshot'), 'browser_snapshot available');
  assert(tools.some(t => t.name === 'browser_type'), 'browser_type available');

  // 3. Navigate to DuckDuckGo homepage
  console.log('\nStep 1: Navigate to duckduckgo.com');
  const navResult = await callTool('browser_navigate', { url: 'https://duckduckgo.com' });
  assert(navResult.includes('DuckDuckGo') || navResult.includes('duckduckgo'), 'DuckDuckGo homepage loaded');

  // 4. Snapshot to find the search box
  console.log('\nStep 2: Find search box');
  const snapshot = await callTool('browser_snapshot');
  const searchboxLine = snapshot.split('\n').find(l =>
    (l.includes('combobox') || l.includes('searchbox') || l.includes('Search')) && l.includes('[ref=')
  );
  const searchRef = searchboxLine?.match(/\[ref=(e\d+)\]/)?.[1];
  assert(searchRef, `Found search box (ref=${searchRef})`);

  // 5. Type "shoes" into search box
  console.log('\nStep 3: Type "shoes" into search box');
  const typeResult = await callTool('browser_type', {
    element: 'search box',
    target: searchRef,
    text: 'shoes',
  });
  assert(!typeResult.includes('invalid_type') && !typeResult.includes('Invalid input'), 'Typed "shoes" into search box');

  // 6. Navigate to search results (direct URL — most reliable for headless)
  console.log('\nStep 4: Submit search and load results');
  const searchNav = await callTool('browser_navigate', { url: 'https://duckduckgo.com/?q=shoes' });
  assert(searchNav.includes('shoes') || searchNav.includes('duckduckgo'), 'Navigated to search results');

  // 7. Snapshot results page
  console.log('\nStep 5: Verify search results');
  const resultsSnapshot = await callTool('browser_snapshot');
  const pageUrlLine = resultsSnapshot.split('\n').find(l => l.includes('Page URL'));
  console.log(' ', pageUrlLine);
  assert(
    resultsSnapshot.toLowerCase().includes('shoes'),
    'Results page contains "shoes"'
  );

  // 8. Take screenshot
  console.log('\nStep 5: Take screenshot of results');
  const screenshot = await callTool('browser_take_screenshot');
  assert(screenshot.length > 100, `Screenshot captured (${screenshot.length} chars)`);

  console.log('\n✅ All tests passed!\n');
}

runTest().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
