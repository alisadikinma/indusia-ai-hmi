/**
 * Generate JWT for local PostgREST
 * Run: node scripts/generate-local-jwt.js
 */

const crypto = require('crypto')

const secret = 'c102d75e7de1a92f0913ba0c195693df1e047c7468bf2a7e42aaa56c5f54b124'

const header = {
  alg: 'HS256',
  typ: 'JWT'
}

const payload = {
  role: 'indusia_user',
  aud: 'local'
}

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function createJWT() {
  const headerEncoded = base64UrlEncode(JSON.stringify(header))
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload))
  
  const signatureInput = `${headerEncoded}.${payloadEncoded}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  
  return `${headerEncoded}.${payloadEncoded}.${signature}`
}

const jwt = createJWT()
console.log('Generated JWT for local PostgREST:\n')
console.log(jwt)
console.log('\nUpdate .env.local:')
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${jwt}`)
