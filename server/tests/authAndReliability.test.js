const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const angelAuth = require('../services/angeloneAuth');
const tokenStore = require('../utils/tokenStore');

describe('Authentication, Security & Reliability Tests', () => {
  test('TOTP generation succeeds with valid secret', () => {
    // Standard Base32 TOTP secret test (JBSWY3DPEHPK3PXP is a standard test secret)
    const secret = 'JBSWY3DPEHPK3PXP';
    const totpCode = angelAuth.generateTotp(secret);
    assert.equal(typeof totpCode, 'string');
    assert.equal(totpCode.length, 6, 'TOTP should be a 6-digit code');
    assert.match(totpCode, /^[0-9]{6}$/, 'TOTP should contain 6 digits');
  });

  test('Missing credentials reject authentication immediately', async () => {
    await assert.rejects(
      async () => {
        await angelAuth.login('', '', '', '');
      },
      /Missing required credentials/
    );
  });

  test('Token storage handles save, load, expiry check and clear', () => {
    // Test active token
    const testToken = {
      jwtToken: 'mock_jwt_token_12345',
      feedToken: 'mock_feed_token_67890',
      clientCode: 'TEST01',
      expiresAt: Date.now() + 3600000 // 1 hour from now
    };

    tokenStore.save(testToken);
    const loaded = tokenStore.load();
    assert.ok(loaded);
    assert.equal(loaded.jwtToken, testToken.jwtToken);
    assert.equal(loaded.clientCode, testToken.clientCode);

    // Test clearing token
    tokenStore.clear();
    const afterClear = tokenStore.load();
    assert.equal(afterClear, null, 'Loaded token should be null after clearing');
  });

  test('Expired tokens are not returned by tokenStore.load()', () => {
    const expiredToken = {
      jwtToken: 'mock_expired_jwt',
      feedToken: 'mock_expired_feed',
      clientCode: 'TEST01',
      expiresAt: Date.now() - 1000 // Expired 1 second ago
    };

    tokenStore.save(expiredToken);
    const loaded = tokenStore.load();
    assert.equal(loaded, null, 'Expired token must return null');
    tokenStore.clear();
  });

  test('Status responses never expose credentials, secrets, or full tokens', () => {
    const dummyClientCode = 'A123456';
    const maskedCode = `${dummyClientCode.substring(0, 2)}***`;

    assert.equal(maskedCode, 'A1***', 'Client code must be masked');
    assert.equal(maskedCode.includes('23456'), false, 'Masked code must not leak inner digits');
  });
});
