const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const keysDir = path.resolve(process.cwd(), 'devkeys');
const privateKey = fs.readFileSync(path.join(keysDir, 'private.pem'), 'utf8');
const meta = JSON.parse(fs.readFileSync(path.join(keysDir, 'meta.json'), 'utf8'));

const issuer = process.env.JWT_ISSUER || 'sovereign-soar-dev';
const audience = process.env.JWT_AUDIENCE || 'sovereign-soar-api';
const subject = process.env.JWT_SUB || 'hud-client';

const token = jwt.sign(
  {
    scope: 'incident:write incident:read',
    role: 'hud'
  },
  privateKey,
  {
    algorithm: 'RS256',
    keyid: meta.kid,
    issuer,
    audience,
    subject,
    expiresIn: '1h'
  }
);

console.log(token);
