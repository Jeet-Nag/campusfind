/**
 * CHANDIL HOME SERVICES — WEBAUTHN PASSKEY ORIGIN & RP ID VERIFICATION REGRESSION TEST SUITE
 *
 * Verifies strict origin matching, Android Credential Manager key-hash support,
 * RP ID validation, challenge verification, cryptographic signature checks,
 * and environment isolation (staging vs production).
 */

import assert from 'node:assert';
import crypto from 'node:crypto';
import {
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { validateEnvConfig, getExpectedOrigins } from '../src/config/env.js';

let passed = 0;
let failed = 0;

async function it(desc: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  [PASS] ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${desc}:`, err?.message ?? err);
    failed++;
  }
}

// ─── Test Constants ────────────────────────────────────────────────────────────

const STAGING_RP_ID = 'chandil-home-services-staging.onrender.com';
const STAGING_WEB_ORIGIN = 'https://chandil-home-services-staging.onrender.com';
const ANDROID_KEY_HASH_ORIGIN = 'android:apk-key-hash:QvqGMd9Y62ft9qp0WMLv8VRdDWYkt10FdT3g4XcgkQ8';

const PROD_RP_ID = 'chandilhomeservices.devs.surf';
const PROD_WEB_ORIGIN = 'https://chandilhomeservices.devs.surf';

const STAGING_EXPECTED_ORIGINS = [STAGING_WEB_ORIGIN, ANDROID_KEY_HASH_ORIGIN];
const PROD_EXPECTED_ORIGINS = [PROD_WEB_ORIGIN, ANDROID_KEY_HASH_ORIGIN];

// ─── Cryptographic Helpers ─────────────────────────────────────────────────────

function createECKeyPair() {
  const keyPair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = keyPair.publicKey.export({ format: 'jwk' });
  const x = Buffer.from(jwk.x!, 'base64url');
  const y = Buffer.from(jwk.y!, 'base64url');
  // Encode P-256 COSE Public Key: a5 (map:5), 1:2 (EC2), 3:-7 (ES256), -1:1 (P-256), -2:x, -3:y
  const cosePublicKey = Buffer.concat([
    Buffer.from('a5010203262001215820', 'hex'),
    x,
    Buffer.from('225820', 'hex'),
    y,
  ]);
  return { keyPair, cosePublicKey };
}

function createRegistrationPayload(options: {
  rpId: string;
  challenge: string;
  origin: string;
  keyPair: crypto.KeyPairSyncResult<Buffer, Buffer>;
  cosePublicKey: Buffer;
  credId?: Buffer;
}) {
  const credId = options.credId ?? crypto.randomBytes(32);
  const rpIdHash = crypto.createHash('sha256').update(options.rpId).digest();
  const flags = Buffer.from([0x45]); // UP (0x01) + UV (0x04) + AT (0x40)
  const signCount = Buffer.from([0, 0, 0, 0]);
  const aaguid = Buffer.alloc(16, 0);
  const credIdLen = Buffer.from([0x00, 0x20]); // 32 bytes

  const authData = Buffer.concat([
    rpIdHash,
    flags,
    signCount,
    aaguid,
    credIdLen,
    credId,
    options.cosePublicKey,
  ]);

  const authDataHeader = Buffer.alloc(3);
  authDataHeader[0] = 0x59; // CBOR byte string with 2-byte length
  authDataHeader.writeUInt16BE(authData.length, 1);

  const attestationObject = Buffer.concat([
    Buffer.from('a363666d74646e6f6e656761747453746d74a0686175746844617461', 'hex'),
    authDataHeader,
    authData,
  ]);

  const clientDataJSON = Buffer.from(
    JSON.stringify({
      type: 'webauthn.create',
      challenge: options.challenge,
      origin: options.origin,
    })
  ).toString('base64url');

  return {
    response: {
      id: credId.toString('base64url'),
      rawId: credId.toString('base64url'),
      response: {
        clientDataJSON,
        attestationObject: attestationObject.toString('base64url'),
      },
      type: 'public-key' as const,
    },
    credId,
  };
}

function createAuthenticationPayload(options: {
  rpId: string;
  challenge: string;
  origin: string;
  keyPair: crypto.KeyPairSyncResult<Buffer, Buffer>;
  credId: Buffer;
  counter?: number;
  corruptSignature?: boolean;
}) {
  const clientDataJSON = Buffer.from(
    JSON.stringify({
      type: 'webauthn.get',
      challenge: options.challenge,
      origin: options.origin,
    })
  ).toString('base64url');

  const clientDataHash = crypto
    .createHash('sha256')
    .update(Buffer.from(clientDataJSON, 'base64url'))
    .digest();

  const rpIdHash = crypto.createHash('sha256').update(options.rpId).digest();
  const flags = Buffer.from([0x05]); // UP (0x01) + UV (0x04)
  const count = options.counter ?? 1;
  const signCount = Buffer.alloc(4);
  signCount.writeUInt32BE(count, 0);

  const authData = Buffer.concat([rpIdHash, flags, signCount]);
  const signatureBase = Buffer.concat([authData, clientDataHash]);

  const signer = crypto.createSign('SHA256');
  signer.update(signatureBase);
  let signature = signer.sign(options.keyPair.privateKey);

  if (options.corruptSignature) {
    // Flip bytes in signature
    signature = Buffer.from(signature);
    signature[signature.length - 1] ^= 0xff;
  }

  return {
    id: options.credId.toString('base64url'),
    rawId: options.credId.toString('base64url'),
    response: {
      clientDataJSON,
      authenticatorData: authData.toString('base64url'),
      signature: signature.toString('base64url'),
    },
    type: 'public-key' as const,
  };
}

// ─── Main Test Runner ──────────────────────────────────────────────────────────

async function runTests() {
  console.log('='.repeat(65));
  console.log('CHANDIL HOME SERVICES — WEBAUTHN ORIGIN VERIFICATION TESTS');
  console.log('='.repeat(65));

  // ── 1. Schema & Environment Parsing Tests ──────────────────────────────────
  console.log('\n--- 1. EXPECTED_ORIGIN Schema Validation & Parsing ---');

  await it('1.1 Accepts single valid HTTPS web origin', () => {
    const parsed = validateEnvConfig({
      EXPECTED_ORIGIN: STAGING_WEB_ORIGIN,
      NODE_ENV: 'development',
    });
    assert.strictEqual(parsed.EXPECTED_ORIGIN, STAGING_WEB_ORIGIN);
  });

  await it('1.2 Accepts single valid Android APK key-hash origin', () => {
    const parsed = validateEnvConfig({
      EXPECTED_ORIGIN: ANDROID_KEY_HASH_ORIGIN,
      NODE_ENV: 'development',
    });
    assert.strictEqual(parsed.EXPECTED_ORIGIN, ANDROID_KEY_HASH_ORIGIN);
  });

  await it('1.3 Accepts combined web and Android origins separated by comma', () => {
    const combined = `${STAGING_WEB_ORIGIN},${ANDROID_KEY_HASH_ORIGIN}`;
    const parsed = validateEnvConfig({
      EXPECTED_ORIGIN: combined,
      NODE_ENV: 'development',
    });
    const origins = getExpectedOrigins(parsed.EXPECTED_ORIGIN);
    assert.deepStrictEqual(origins, [STAGING_WEB_ORIGIN, ANDROID_KEY_HASH_ORIGIN]);
  });

  await it('1.4 Strictly rejects wildcard origin (*)', () => {
    assert.throws(
      () => validateEnvConfig({ EXPECTED_ORIGIN: '*' }),
      /EXPECTED_ORIGIN must contain valid HTTP\/HTTPS URLs or android:apk-key-hash/
    );
  });

  await it('1.5 Strictly rejects malformed Android key-hash (invalid length)', () => {
    assert.throws(
      () => validateEnvConfig({ EXPECTED_ORIGIN: 'android:apk-key-hash:too-short' }),
      /EXPECTED_ORIGIN must contain valid HTTP\/HTTPS URLs or android:apk-key-hash/
    );
  });

  await it('1.6 Strictly rejects unencrypted HTTP web origin in production mode', () => {
    assert.throws(
      () =>
        validateEnvConfig({
          NODE_ENV: 'production',
          JWT_SECRET: 'min-32-chars-secret-for-testing-production!',
          EXPECTED_ORIGIN: 'http://chandilhomeservices.devs.surf',
        }),
      /must use HTTPS protocol/
    );
  });


  await it('1.7 Allows Android origin alongside HTTPS web origin in production mode', () => {
    const combined = `${PROD_WEB_ORIGIN},${ANDROID_KEY_HASH_ORIGIN}`;
    const parsed = validateEnvConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'min-32-chars-secret-for-testing-production!',
      EXPECTED_ORIGIN: combined,
    });
    const origins = getExpectedOrigins(parsed.EXPECTED_ORIGIN);
    assert.strictEqual(origins.length, 2);
    assert.strictEqual(origins[0], PROD_WEB_ORIGIN);
    assert.strictEqual(origins[1], ANDROID_KEY_HASH_ORIGIN);
  });

  // ── 2. WebAuthn Registration Origin Tests ──────────────────────────────────
  console.log('\n--- 2. WebAuthn Registration Origin Verification ---');

  await it('2.1 Approved staging web origin SUCCEEDS registration', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const challenge = 'reg-challenge-web-staging-001';
    const payload = createRegistrationPayload({
      rpId: STAGING_RP_ID,
      challenge,
      origin: STAGING_WEB_ORIGIN,
      keyPair,
      cosePublicKey,
    });

    const verification = await verifyRegistrationResponse({
      response: payload.response,
      expectedChallenge: challenge,
      expectedOrigin: STAGING_EXPECTED_ORIGINS,
      expectedRPID: STAGING_RP_ID,
      requireUserVerification: true,
    });

    assert.strictEqual(verification.verified, true);
    assert.ok(verification.registrationInfo);
  });

  await it('2.2 Approved native Android origin SUCCEEDS registration', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const challenge = 'reg-challenge-android-staging-002';
    const payload = createRegistrationPayload({
      rpId: STAGING_RP_ID,
      challenge,
      origin: ANDROID_KEY_HASH_ORIGIN,
      keyPair,
      cosePublicKey,
    });

    const verification = await verifyRegistrationResponse({
      response: payload.response,
      expectedChallenge: challenge,
      expectedOrigin: STAGING_EXPECTED_ORIGINS,
      expectedRPID: STAGING_RP_ID,
      requireUserVerification: true,
    });

    assert.strictEqual(verification.verified, true);
    assert.ok(verification.registrationInfo);
  });

  await it('2.3 Unknown web origin is strictly REJECTED in registration', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const challenge = 'reg-challenge-unauthorized-003';
    const payload = createRegistrationPayload({
      rpId: STAGING_RP_ID,
      challenge,
      origin: 'https://attacker.example.com',
      keyPair,
      cosePublicKey,
    });

    await assert.rejects(
      async () => {
        await verifyRegistrationResponse({
          response: payload.response,
          expectedChallenge: challenge,
          expectedOrigin: STAGING_EXPECTED_ORIGINS,
          expectedRPID: STAGING_RP_ID,
          requireUserVerification: true,
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes('Unexpected registration response origin "https://attacker.example.com"'));
        assert.ok(err.message.includes(STAGING_WEB_ORIGIN));
        assert.ok(err.message.includes(ANDROID_KEY_HASH_ORIGIN));
        return true;
      }
    );
  });

  await it('2.4 Unknown Android APK key-hash origin is strictly REJECTED in registration', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const challenge = 'reg-challenge-unknown-apk-004';
    const fakeApkOrigin = 'android:apk-key-hash:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const payload = createRegistrationPayload({
      rpId: STAGING_RP_ID,
      challenge,
      origin: fakeApkOrigin,
      keyPair,
      cosePublicKey,
    });

    await assert.rejects(
      async () => {
        await verifyRegistrationResponse({
          response: payload.response,
          expectedChallenge: challenge,
          expectedOrigin: STAGING_EXPECTED_ORIGINS,
          expectedRPID: STAGING_RP_ID,
          requireUserVerification: true,
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes(`Unexpected registration response origin "${fakeApkOrigin}"`));
        return true;
      }
    );
  });

  await it('2.5 Wrong RP ID is strictly REJECTED in registration', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const challenge = 'reg-challenge-wrong-rp-005';
    // Authenticator signed for wrong RP ID
    const payload = createRegistrationPayload({
      rpId: 'wrong-rpid.example.com',
      challenge,
      origin: ANDROID_KEY_HASH_ORIGIN,
      keyPair,
      cosePublicKey,
    });

    await assert.rejects(
      async () => {
        await verifyRegistrationResponse({
          response: payload.response,
          expectedChallenge: challenge,
          expectedOrigin: STAGING_EXPECTED_ORIGINS,
          expectedRPID: STAGING_RP_ID,
          requireUserVerification: true,
        });
      },
      /Unexpected RP ID hash/
    );
  });


  await it('2.6 Invalid challenge is strictly REJECTED in registration', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const payload = createRegistrationPayload({
      rpId: STAGING_RP_ID,
      challenge: 'client-challenge-mismatch',
      origin: ANDROID_KEY_HASH_ORIGIN,
      keyPair,
      cosePublicKey,
    });

    await assert.rejects(
      async () => {
        await verifyRegistrationResponse({
          response: payload.response,
          expectedChallenge: 'expected-server-challenge-006',
          expectedOrigin: STAGING_EXPECTED_ORIGINS,
          expectedRPID: STAGING_RP_ID,
          requireUserVerification: true,
        });
      },
      /Unexpected registration response challenge/
    );
  });

  // ── 3. WebAuthn Authentication (Login) Origin Tests ────────────────────────
  console.log('\n--- 3. WebAuthn Login Assertion Origin Verification ---');

  await it('3.1 Approved staging web origin SUCCEEDS login assertion', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const credId = crypto.randomBytes(32);
    const challenge = 'login-challenge-web-001';

    const authPayload = createAuthenticationPayload({
      rpId: STAGING_RP_ID,
      challenge,
      origin: STAGING_WEB_ORIGIN,
      keyPair,
      credId,
      counter: 1,
    });

    const verification = await verifyAuthenticationResponse({
      response: authPayload,
      expectedChallenge: challenge,
      expectedOrigin: STAGING_EXPECTED_ORIGINS,
      expectedRPID: STAGING_RP_ID,
      credential: {
        id: credId.toString('base64url'),
        publicKey: cosePublicKey,
        counter: 0,
      },
      requireUserVerification: true,
    });

    assert.strictEqual(verification.verified, true);
    assert.strictEqual(verification.authenticationInfo.newCounter, 1);
  });

  await it('3.2 Approved native Android origin SUCCEEDS login assertion', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const credId = crypto.randomBytes(32);
    const challenge = 'login-challenge-android-002';

    const authPayload = createAuthenticationPayload({
      rpId: STAGING_RP_ID,
      challenge,
      origin: ANDROID_KEY_HASH_ORIGIN,
      keyPair,
      credId,
      counter: 1,
    });

    const verification = await verifyAuthenticationResponse({
      response: authPayload,
      expectedChallenge: challenge,
      expectedOrigin: STAGING_EXPECTED_ORIGINS,
      expectedRPID: STAGING_RP_ID,
      credential: {
        id: credId.toString('base64url'),
        publicKey: cosePublicKey,
        counter: 0,
      },
      requireUserVerification: true,
    });

    assert.strictEqual(verification.verified, true);
    assert.strictEqual(verification.authenticationInfo.newCounter, 1);
  });

  await it('3.3 Unknown origin is strictly REJECTED in login assertion', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const credId = crypto.randomBytes(32);
    const challenge = 'login-challenge-unknown-003';

    const authPayload = createAuthenticationPayload({
      rpId: STAGING_RP_ID,
      challenge,
      origin: 'https://phishing.example.com',
      keyPair,
      credId,
      counter: 1,
    });

    await assert.rejects(
      async () => {
        await verifyAuthenticationResponse({
          response: authPayload,
          expectedChallenge: challenge,
          expectedOrigin: STAGING_EXPECTED_ORIGINS,
          expectedRPID: STAGING_RP_ID,
          credential: {
            id: credId.toString('base64url'),
            publicKey: cosePublicKey,
            counter: 0,
          },
          requireUserVerification: true,
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes('Unexpected authentication response origin "https://phishing.example.com"'));
        return true;
      }
    );
  });

  await it('3.4 Wrong RP ID is strictly REJECTED in login assertion', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const credId = crypto.randomBytes(32);
    const challenge = 'login-challenge-wrong-rp-004';

    const authPayload = createAuthenticationPayload({
      rpId: 'wrong-rpid.example.com',
      challenge,
      origin: ANDROID_KEY_HASH_ORIGIN,
      keyPair,
      credId,
      counter: 1,
    });

    await assert.rejects(
      async () => {
        await verifyAuthenticationResponse({
          response: authPayload,
          expectedChallenge: challenge,
          expectedOrigin: STAGING_EXPECTED_ORIGINS,
          expectedRPID: STAGING_RP_ID,
          credential: {
            id: credId.toString('base64url'),
            publicKey: cosePublicKey,
            counter: 0,
          },
          requireUserVerification: true,
        });
      },
      /Unexpected RP ID hash/
    );
  });

  await it('3.5 Forged or invalid cryptographic signature is strictly REJECTED in login assertion', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const wrongKeyPair = createECKeyPair().keyPair;
    const credId = crypto.randomBytes(32);
    const challenge = 'login-challenge-bad-sig-005';

    // Signed by wrong private key
    const authPayload = createAuthenticationPayload({
      rpId: STAGING_RP_ID,
      challenge,
      origin: ANDROID_KEY_HASH_ORIGIN,
      keyPair: wrongKeyPair,
      credId,
      counter: 1,
    });

    const verification = await verifyAuthenticationResponse({
      response: authPayload,
      expectedChallenge: challenge,
      expectedOrigin: STAGING_EXPECTED_ORIGINS,
      expectedRPID: STAGING_RP_ID,
      credential: {
        id: credId.toString('base64url'),
        publicKey: cosePublicKey,
        counter: 0,
      },
      requireUserVerification: true,
    });

    assert.strictEqual(verification.verified, false);

    // Also test malformed signature buffer
    const corruptPayload = {
      ...authPayload,
      response: {
        ...authPayload.response,
        signature: Buffer.from('malformed-signature-bytes').toString('base64url'),
      },
    };

    await assert.rejects(async () => {
      await verifyAuthenticationResponse({
        response: corruptPayload,
        expectedChallenge: challenge,
        expectedOrigin: STAGING_EXPECTED_ORIGINS,
        expectedRPID: STAGING_RP_ID,
        credential: {
          id: credId.toString('base64url'),
          publicKey: cosePublicKey,
          counter: 0,
        },
        requireUserVerification: true,
      });
    });
  });


  // ── 4. Cross-Environment Isolation Tests ────────────────────────────────────
  console.log('\n--- 4. Staging vs Production Cross-Environment Isolation ---');

  await it('4.1 Production web origin is strictly REJECTED against staging configuration', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const challenge = 'reg-prod-against-staging-001';
    const payload = createRegistrationPayload({
      rpId: STAGING_RP_ID,
      challenge,
      origin: PROD_WEB_ORIGIN,
      keyPair,
      cosePublicKey,
    });

    await assert.rejects(
      async () => {
        await verifyRegistrationResponse({
          response: payload.response,
          expectedChallenge: challenge,
          expectedOrigin: STAGING_EXPECTED_ORIGINS,
          expectedRPID: STAGING_RP_ID,
          requireUserVerification: true,
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes(`Unexpected registration response origin "${PROD_WEB_ORIGIN}"`));
        return true;
      }
    );
  });

  await it('4.2 Staging web origin is strictly REJECTED against production configuration', async () => {
    const { keyPair, cosePublicKey } = createECKeyPair();
    const challenge = 'reg-staging-against-prod-002';
    const payload = createRegistrationPayload({
      rpId: PROD_RP_ID,
      challenge,
      origin: STAGING_WEB_ORIGIN,
      keyPair,
      cosePublicKey,
    });

    await assert.rejects(
      async () => {
        await verifyRegistrationResponse({
          response: payload.response,
          expectedChallenge: challenge,
          expectedOrigin: PROD_EXPECTED_ORIGINS,
          expectedRPID: PROD_RP_ID,
          requireUserVerification: true,
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes(`Unexpected registration response origin "${STAGING_WEB_ORIGIN}"`));
        return true;
      }
    );
  });

  await it('4.3 Staging and production configurations remain strictly distinct', () => {
    const stagingOrigins = getExpectedOrigins(`${STAGING_WEB_ORIGIN},${ANDROID_KEY_HASH_ORIGIN}`);
    const prodOrigins = getExpectedOrigins(`${PROD_WEB_ORIGIN},${ANDROID_KEY_HASH_ORIGIN}`);

    assert.notDeepStrictEqual(stagingOrigins, prodOrigins);
    assert.ok(stagingOrigins.includes(STAGING_WEB_ORIGIN));
    assert.ok(!stagingOrigins.includes(PROD_WEB_ORIGIN));
    assert.ok(prodOrigins.includes(PROD_WEB_ORIGIN));
    assert.ok(!prodOrigins.includes(STAGING_WEB_ORIGIN));
    assert.notStrictEqual(STAGING_RP_ID, PROD_RP_ID);
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(65));
  console.log(`WEBAUTHN ORIGIN VERIFICATION TESTS: ${passed} PASS, ${failed} FAIL`);
  console.log('='.repeat(65));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
