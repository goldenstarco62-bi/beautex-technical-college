const http = require('http');
const fs = require('fs');
http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'POST') { res.end('ok'); return; }
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
        try {
            const idx = body.indexOf('base64,');
            const name = (body.slice(0, idx).match(/_m_\w+/) || ['_m_out'])[0];
            fs.writeFileSync(name + '.png', Buffer.from(body.slice(idx + 7), 'base64'));
            res.end('saved');
        } catch (e) { res.statusCode = 500; res.end(String(e)); }
    });
}).listen(8124, () => console.log('receiver on 8124'));
