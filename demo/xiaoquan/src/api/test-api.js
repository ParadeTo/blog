import http from 'http'

export function startTestApi(runner, {host = '127.0.0.1', port = 9090} = {}) {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/test/message') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', async () => {
        try {
          const {routing_key, content} = JSON.parse(body)
          const {createInboundMessage} = await import('../models.js')
          const inbound = createInboundMessage({
            routingKey: routing_key || 'p2p:ou_test',
            content: content || '',
            msgId: `test_${Date.now()}`,
            senderId: 'ou_test',
          })
          await runner.dispatch(inbound)
          await new Promise(r => setTimeout(r, 100))
          res.writeHead(200, {'Content-Type': 'application/json'})
          res.end(JSON.stringify({ok: true, msg_id: inbound.msgId}))
        } catch (e) {
          res.writeHead(500, {'Content-Type': 'application/json'})
          res.end(JSON.stringify({error: e.message}))
        }
      })
    } else {
      res.writeHead(404)
      res.end('Not Found')
    }
  })

  server.listen(port, host, () => {
    console.log(`[TestAPI] http://${host}:${port}/api/test/message`)
  })
  return server
}
