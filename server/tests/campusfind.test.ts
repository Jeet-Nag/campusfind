import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app';

const TEST_JWT_SECRET = 'test-secret-key-campusfind-minimum-32-chars-long!';

describe('CampusFind Lost & Found Full Backend Test Suite', () => {
  let app: any;
  let alexToken: string;
  let priyaToken: string;
  let marcusToken: string;
  let createdLostItemId: string;
  let createdFoundItemId: string;
  let submittedClaimId: string;

  it('Initializes Fastify app', async () => {
    app = await buildApp({
      customEnv: {
        NODE_ENV: 'test',
        JWT_SECRET: TEST_JWT_SECRET,
      },
    });
    await app.ready();
    assert.ok(app);
  });

  it('1. Student Authentication — Registration and Login', async () => {
    // 1.1 Register new student
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        fullName: 'Test Student Zara',
        email: `zara.${Date.now()}@campus.edu`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        studentId: 'STU-9901',
        password: 'Password123!',
      },
    });

    assert.strictEqual(regRes.statusCode, 201);
    const regBody = JSON.parse(regRes.body);
    assert.strictEqual(regBody.success, true);
    assert.ok(regBody.data.token);
    assert.strictEqual(regBody.data.user.fullName, 'Test Student Zara');

    // 1.2 Login with seeded student Alex Chen
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        emailOrPhone: 'alex@campus.edu',
        password: 'Password123!',
      },
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.body);
    assert.strictEqual(loginBody.success, true);
    alexToken = loginBody.data.token;
    assert.ok(alexToken);

    // 1.3 Login with seeded student Priya Patel
    const priyaRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        emailOrPhone: 'priya@campus.edu',
        password: 'Password123!',
      },
    });
    assert.strictEqual(priyaRes.statusCode, 200);
    priyaToken = JSON.parse(priyaRes.body).data.token;

    // 1.4 Login with seeded student Marcus Vance
    const marcusRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        emailOrPhone: 'marcus@campus.edu',
        password: 'Password123!',
      },
    });
    assert.strictEqual(marcusRes.statusCode, 200);
    marcusToken = JSON.parse(marcusRes.body).data.token;

    // 1.5 Login with invalid password fails
    const badLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        emailOrPhone: 'alex@campus.edu',
        password: 'WrongPassword999!',
      },
    });
    assert.strictEqual(badLoginRes.statusCode, 401);
    assert.strictEqual(JSON.parse(badLoginRes.body).success, false);

    // 1.6 Authenticated /me endpoint returns user profile
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${alexToken}` },
    });
    assert.strictEqual(meRes.statusCode, 200);
    const meBody = JSON.parse(meRes.body);
    assert.strictEqual(meBody.data.user.email, 'alex@campus.edu');
  });

  it('2. Public Browsing, Search, and Filtering', async () => {
    // 2.1 Fetch all items
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/campus/items',
    });
    assert.strictEqual(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.body);
    assert.strictEqual(listBody.success, true);
    assert.ok(Array.isArray(listBody.data));
    assert.ok(listBody.data.length >= 4);

    // 2.2 Filter by type = 'lost'
    const lostRes = await app.inject({
      method: 'GET',
      url: '/api/campus/items?type=lost',
    });
    const lostBody = JSON.parse(lostRes.body);
    assert.strictEqual(lostBody.success, true);
    for (const item of lostBody.data) {
      assert.strictEqual(item.type, 'lost');
    }

    // 2.3 Filter by type = 'found'
    const foundRes = await app.inject({
      method: 'GET',
      url: '/api/campus/items?type=found',
    });
    const foundBody = JSON.parse(foundRes.body);
    assert.strictEqual(foundBody.success, true);
    for (const item of foundBody.data) {
      assert.strictEqual(item.type, 'found');
    }

    // 2.4 Search by keyword 'Calculator'
    const searchRes = await app.inject({
      method: 'GET',
      url: '/api/campus/items?search=Calculator',
    });
    const searchBody = JSON.parse(searchRes.body);
    assert.strictEqual(searchBody.success, true);
    assert.ok(searchBody.data.some((i: any) => i.title.includes('Calculator')));

    // 2.5 Filter by location
    const locRes = await app.inject({
      method: 'GET',
      url: '/api/campus/items?location=Main%20Library',
    });
    const locBody = JSON.parse(locRes.body);
    assert.strictEqual(locBody.success, true);
    for (const item of locBody.data) {
      assert.strictEqual(item.location, 'Main Library');
    }
  });

  it('3. Report a Lost Item — Validation and Persistence', async () => {
    // 3.1 Unauthenticated attempt fails with 401
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/api/campus/items',
      payload: {
        type: 'lost',
        title: 'Sony WH-1000XM4 Headphones',
        category: 'electronics',
        description: 'Black over-ear headphones left in study pod 4.',
        location: 'Main Library',
        dateOccurred: '2026-10-20',
        contactMethod: 'alex@campus.edu',
      },
    });
    assert.strictEqual(unauthRes.statusCode, 401);

    // 3.2 Invalid inputs fail validation (missing required fields)
    const invalidRes = await app.inject({
      method: 'POST',
      url: '/api/campus/items',
      headers: { Authorization: `Bearer ${alexToken}` },
      payload: {
        type: 'lost',
        title: 'A', // too short (< 2)
        category: 'invalid_category',
        description: 'No',
        location: '',
      },
    });
    assert.strictEqual(invalidRes.statusCode, 400);
    const invalidBody = JSON.parse(invalidRes.body);
    assert.strictEqual(invalidBody.error.code, 'VALIDATION_ERROR');

    // 3.3 Valid lost report succeeds and persists
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/campus/items',
      headers: { Authorization: `Bearer ${alexToken}` },
      payload: {
        type: 'lost',
        title: 'Sony WH-1000XM4 Noise-Cancelling Headphones',
        category: 'electronics',
        description: 'Black over-ear headphones left in study pod 4 on 3rd floor. Has a small white sticker on inside left cup.',
        location: 'Main Library',
        dateOccurred: '2026-10-22',
        contactMethod: 'Campus Email or Portal Claim',
      },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const createBody = JSON.parse(createRes.body);
    assert.strictEqual(createBody.success, true);
    createdLostItemId = createBody.data.id;
    assert.strictEqual(createBody.data.title, 'Sony WH-1000XM4 Noise-Cancelling Headphones');
    assert.strictEqual(createBody.data.status, 'open');
  });

  it('4. Report a Found Item — Privacy and Sensitive Info Protection', async () => {
    // Report a sensitive found wallet/ID item
    const foundRes = await app.inject({
      method: 'POST',
      url: '/api/campus/items',
      headers: { Authorization: `Bearer ${priyaToken}` },
      payload: {
        type: 'found',
        title: 'Brown Leather Fossil Wallet with Cards',
        category: 'keys_wallets',
        description: 'Found on grass near Campus Green bench. Turned in to campus security.',
        location: 'Campus Green / Central Quad',
        dateOccurred: '2026-10-23',
        contactMethod: 'Campus Security Front Desk',
        isSensitive: true,
        sensitiveDetails: 'Contains state ID for David M., Chase Debit card ending in 4102, and $25 cash.',
      },
    });

    assert.strictEqual(foundRes.statusCode, 201);
    const foundBody = JSON.parse(foundRes.body);
    createdFoundItemId = foundBody.data.id;
    assert.strictEqual(foundBody.data.isSensitive, true);

    // 4.1 Non-owner public viewing DOES NOT reveal sensitiveDetails!
    const publicViewRes = await app.inject({
      method: 'GET',
      url: `/api/campus/items/${createdFoundItemId}`,
      headers: { Authorization: `Bearer ${alexToken}` }, // Alex is not owner
    });
    assert.strictEqual(publicViewRes.statusCode, 200);
    const publicViewBody = JSON.parse(publicViewRes.body);
    assert.strictEqual(publicViewBody.data.item.sensitiveDetails, null);
    assert.ok(!publicViewBody.data.item.description.includes('4102'));

    // 4.2 Owner viewing DOES reveal sensitiveDetails
    const ownerViewRes = await app.inject({
      method: 'GET',
      url: `/api/campus/items/${createdFoundItemId}`,
      headers: { Authorization: `Bearer ${priyaToken}` }, // Priya is owner
    });
    assert.strictEqual(ownerViewRes.statusCode, 200);
    const ownerViewBody = JSON.parse(ownerViewRes.body);
    assert.ok(ownerViewBody.data.item.sensitiveDetails.includes('4102'));
  });

  it('5. Claim Process & Distinguishing Feature Proof', async () => {
    // 5.1 Owner cannot submit a claim on their own item
    const ownClaimRes = await app.inject({
      method: 'POST',
      url: `/api/campus/items/${createdFoundItemId}/claim`,
      headers: { Authorization: `Bearer ${priyaToken}` },
      payload: {
        claimantName: 'Priya Patel',
        claimantContact: 'priya@campus.edu',
        distinguishingFeature: 'I lost this wallet myself',
      },
    });
    assert.strictEqual(ownClaimRes.statusCode, 400);
    assert.strictEqual(JSON.parse(ownClaimRes.body).error.code, 'CANNOT_CLAIM_OWN_ITEM');

    // 5.2 Distinguishing feature must not be empty or too short
    const shortClaimRes = await app.inject({
      method: 'POST',
      url: `/api/campus/items/${createdFoundItemId}/claim`,
      headers: { Authorization: `Bearer ${marcusToken}` },
      payload: {
        claimantName: 'Marcus Vance',
        claimantContact: 'marcus@campus.edu',
        distinguishingFeature: 'mine',
      },
    });
    assert.strictEqual(shortClaimRes.statusCode, 400);

    // 5.3 Valid claim from Marcus with distinguishing feature
    const validClaimRes = await app.inject({
      method: 'POST',
      url: `/api/campus/items/${createdFoundItemId}/claim`,
      headers: { Authorization: `Bearer ${marcusToken}` },
      payload: {
        claimantName: 'Marcus Vance',
        claimantContact: 'marcus@campus.edu',
        distinguishingFeature: 'The wallet has a small folded library receipt inside and card ending in 4102.',
        message: 'I can show my student ID card at the security desk to verify.',
      },
    });
    assert.strictEqual(validClaimRes.statusCode, 201);
    const claimBody = JSON.parse(validClaimRes.body);
    assert.strictEqual(claimBody.success, true);
    submittedClaimId = claimBody.data.id;
    assert.strictEqual(claimBody.data.status, 'pending');

    // 5.4 Item status transitioned to 'claim_pending' (NOT returned)
    const itemCheckRes = await app.inject({
      method: 'GET',
      url: `/api/campus/items/${createdFoundItemId}`,
    });
    assert.strictEqual(JSON.parse(itemCheckRes.body).data.item.status, 'claim_pending');

    // 5.5 Owner Priya reviews the claim and accepts it
    const reviewRes = await app.inject({
      method: 'PATCH',
      url: `/api/campus/claims/${submittedClaimId}/review`,
      headers: { Authorization: `Bearer ${priyaToken}` },
      payload: {
        status: 'accepted',
        ownerResponse: 'Confirmed! The wallet is at the Campus Security office desk in Administration building.',
      },
    });
    assert.strictEqual(reviewRes.statusCode, 200);
    const reviewBody = JSON.parse(reviewRes.body);
    assert.strictEqual(reviewBody.data.status, 'accepted');

    // 5.6 Non-owner Alex cannot review or modify Marcus\'s claim (403 FORBIDDEN)
    const unauthorizedReviewRes = await app.inject({
      method: 'PATCH',
      url: `/api/campus/claims/${submittedClaimId}/review`,
      headers: { Authorization: `Bearer ${alexToken}` },
      payload: {
        status: 'rejected',
      },
    });
    assert.strictEqual(unauthorizedReviewRes.statusCode, 403);
  });

  it('6. My Reports & Access Control Guard', async () => {
    // 6.1 Alex checks his own reports
    const myReportsRes = await app.inject({
      method: 'GET',
      url: '/api/campus/items/my-reports',
      headers: { Authorization: `Bearer ${alexToken}` },
    });
    assert.strictEqual(myReportsRes.statusCode, 200);
    const myReportsBody = JSON.parse(myReportsRes.body);
    assert.ok(myReportsBody.data.some((i: any) => i.id === createdLostItemId));

    // 6.2 Non-owner Priya attempts to edit Alex\'s item -> rejected with 403 FORBIDDEN
    const hijackEditRes = await app.inject({
      method: 'PATCH',
      url: `/api/campus/items/${createdLostItemId}`,
      headers: { Authorization: `Bearer ${priyaToken}` },
      payload: {
        title: 'Hijacked Title by Unauthorized User',
      },
    });
    assert.strictEqual(hijackEditRes.statusCode, 403);
    assert.strictEqual(JSON.parse(hijackEditRes.body).error.code, 'FORBIDDEN');

    // 6.3 Alex updates his own report to 'returned'
    const ownerUpdateRes = await app.inject({
      method: 'PATCH',
      url: `/api/campus/items/${createdLostItemId}`,
      headers: { Authorization: `Bearer ${alexToken}` },
      payload: {
        status: 'returned',
      },
    });
    assert.strictEqual(ownerUpdateRes.statusCode, 200);
    assert.strictEqual(JSON.parse(ownerUpdateRes.body).data.status, 'returned');

    // 6.4 Non-owner Priya attempts to delete Alex\'s item -> rejected with 403 FORBIDDEN
    const hijackDeleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/campus/items/${createdLostItemId}`,
      headers: { Authorization: `Bearer ${priyaToken}` },
    });
    assert.strictEqual(hijackDeleteRes.statusCode, 403);

    // 6.5 Alex deletes his own report -> succeeds
    const ownerDeleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/campus/items/${createdLostItemId}`,
      headers: { Authorization: `Bearer ${alexToken}` },
    });
    assert.strictEqual(ownerDeleteRes.statusCode, 200);

    // 6.6 Marcus views his submitted claims
    const myClaimsRes = await app.inject({
      method: 'GET',
      url: '/api/campus/claims/my-claims',
      headers: { Authorization: `Bearer ${marcusToken}` },
    });
    assert.strictEqual(myClaimsRes.statusCode, 200);
    const myClaimsBody = JSON.parse(myClaimsRes.body);
    assert.ok(myClaimsBody.data.some((c: any) => c.id === submittedClaimId));
  });

  it('7. Data Persistence across simulated refresh and direct query', async () => {
    // 7.1 Direct query to the database verifying data was persistently committed to disk
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/campus/items/${createdFoundItemId}`,
    });
    assert.strictEqual(checkRes.statusCode, 200);
    const itemData = JSON.parse(checkRes.body).data.item;
    assert.strictEqual(itemData.title, 'Brown Leather Fossil Wallet with Cards');
    assert.strictEqual(itemData.status, 'claim_pending');

    // 7.2 Verify item appears in the list after refresh
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/campus/items',
    });
    assert.strictEqual(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.body);
    const persisted = listBody.data.find((i: any) => i.id === createdFoundItemId);
    assert.ok(persisted, 'Item must be persistently present in public items list');
    assert.strictEqual(persisted.title, 'Brown Leather Fossil Wallet with Cards');
  });
});
