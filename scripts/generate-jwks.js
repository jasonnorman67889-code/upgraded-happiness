const fs = require('fs');
const path = require('path');
const { generateKeyPairSync, createHash } = require('crypto');

const outputDir = path.resolve(process.cwd(), 'devkeys');
fs.mkdirSync(outputDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048
});

const publicJwk = publicKey.export({ format: 'jwk' });
const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' });
const publicPem = publicKey.export({ type: 'pkcs1', format: 'pem' });

const kid = createHash('sha256').update(publicPem).digest('hex').slice(0, 16);
publicJwk.kid = kid;
publicJwk.use = 'sig';
publicJwk.alg = 'RS256';

const jwks = { keys: [publicJwk] };

fs.writeFileSync(path.join(outputDir, 'private.pem'), privatePem);
fs.writeFileSync(path.join(outputDir, 'public.pem'), publicPem);
fs.writeFileSync(path.join(outputDir, 'jwks.json'), JSON.stringify(jwks, null, 2));
fs.writeFileSync(path.join(outputDir, 'meta.json'), JSON.stringify({ kid }, null, 2));

console.log(`Generated JWKS material in ${outputDir}`);
console.log(`kid=${kid}`);
