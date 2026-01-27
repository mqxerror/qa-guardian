const http = require('http');

const loginData = JSON.stringify({email:'owner@example.com',password:'Owner123!'});
const loginReq = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Content-Length': loginData.length}
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const token = JSON.parse(data).token;
    const injectReq = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/debug/inject-test-failures',
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Content-Length': 2}
    }, (res2) => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => console.log(data2));
    });
    injectReq.write('{}');
    injectReq.end();
  });
});
loginReq.write(loginData);
loginReq.end();
