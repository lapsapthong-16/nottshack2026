import { PrivateKey } from '@dashevo/evo-sdk';
import crypto from 'crypto';

function ripemd160(data) {
  return crypto.createHash('ripemd160').update(
    crypto.createHash('sha256').update(data).digest()
  ).digest();
}

const wif = 'cUd4HcA7D1vFZemU5PaeLJrr85YwvWKdGixVq7GzabgR7D5gkeug';
const pk = PrivateKey.fromWIF(wif);
console.log('Hash for cUd4...:', ripemd160(pk.getPublicKey().toBytes()).toString('hex'));
