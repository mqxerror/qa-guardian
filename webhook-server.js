const http = require('http');
const { exec } = require('child_process');

const SECRET = process.env.WEBHOOK_SECRET || 'qa-guardian-deploy-2024';
const PORT = 9000;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/deploy') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('Received deploy webhook');
      exec('/opt/qa-guardian/deploy.sh', (error, stdout, stderr) => {
        if (error) {
          console.error('Deploy error:', error);
          res.writeHead(500);
          res.end('Deploy failed');
        } else {
          console.log('Deploy output:', stdout);
          res.writeHead(200);
          res.end('Deploy started');
        }
      });
    });
  } else if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
