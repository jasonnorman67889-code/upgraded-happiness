const express = require('express');
const supertest = require('supertest');
const { generateKeyPairSync, createHash } = require('crypto');
const jwt = require('jsonwebtoken');

const issuer = 'sovereign-soar-test-issuer';
const audience = 'sovereign-soar-test-audience';

async function run() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicPem = publicKey.export({ type: 'pkcs1', format: 'pem' });
  const jwk = publicKey.export({ format: 'jwk' });
  const kid = createHash('sha256').update(publicPem).digest('hex').slice(0, 16);

  jwk.kid = kid;
  jwk.use = 'sig';
  jwk.alg = 'RS256';

  const jwksApp = express();
  jwksApp.get('/.well-known/jwks.json', (_req, res) => {
    res.json({ keys: [jwk] });
  });

  const jwksServer = jwksApp.listen(0);
  const jwksPort = jwksServer.address().port;

  process.env.JWT_MODE = 'jwks';
  process.env.JWT_ISSUER = issuer;
  process.env.JWT_AUDIENCE = audience;
  process.env.JWKS_URI = `http://127.0.0.1:${jwksPort}/.well-known/jwks.json`;

  const { validateJwt } = require('../src/middleware/auth');

  const app = express();
  app.get('/protected', validateJwt, (_req, res) => res.json({ ok: true }));

  const token = jwt.sign(
    { role: 'tester' },
    privateKey.export({ type: 'pkcs1', format: 'pem' }),
    {
      algorithm: 'RS256',
      keyid: kid,
      issuer,
      audience,
      expiresIn: '10m'
    }
  );

  try {
    await supertest(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await supertest(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    console.log('JWKS smoke test passed');
  } finally {
    jwksServer.close();
  }
}

run().catch((err) => {
  console.error('JWKS smoke test failed', err);
  process.exit(1);
});
