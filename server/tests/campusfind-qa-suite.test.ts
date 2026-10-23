import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app';

const TEST_SECRET = 'test-secret-key-campusfind-minimum-32-chars-long!';

describe('CampusFind Mandatory QA & User Flow Verification', () => {
  let app: any;
  let alexToken: string;
  let priyaToken: string;
  let testItemId: string;
  let testClaimId: string;

  it('Bootstraps server and verifies static HTML delivery', async () => {
    app = await buildApp({
      customEnv: {
        NODE_ENV: 'test',
        JWT_SECRET: TEST_SECRET,
      },
    });
    await app.ready();

    // Verify root landing page delivers CampusFind HTML
    const rootRes = await app.inject({ method: 'GET', url: '/' });
    assert.strictEqual(rootRes.statusCode, 200);
    assert.ok(rootRes.payload.includes('<div id="app"></div>'));
    assert.ok(rootRes.payload.includes('CampusFind'));

    // Verify SPA routing for client paths
    const browseRoute = await app.inject({ method: 'GET', url: '/browse' });
    assert.strictEqual(browseRoute.statusCode, 200);
    assert.ok(browseRoute.payload.includes('<div id="app"></div>'));

    const reportLostRoute = await app.inject({ method: 'GET', url: '/report-lost' });
    assert.strictEqual(reportLostRoute.statusCode, 200);

    const reportFoundRoute = await app.inject({ method: 'GET', url: '/report-found' });
    assert.strictEqual(reportFoundRoute.statusCode, 200);

    const myReportsRoute = await app.inject({ method: 'GET', url: '/my-reports' });
    assert.strictEqual(myReportsRoute.statusCode, 200);
  });

  it('Verifies Authentication & Demo Users', async () => {
    // Check demo users endpoint
    const demoRes = await app.inject({ method: 'GET', url: '/api/auth/demo-students' });
    assert.strictEqual(demoRes.statusCode, 200);
    const demoBody = JSON.parse(demoRes.body);
    assert.strictEqual(demoBody.success, true);
    assert.ok(demoBody.data.length >= 2);

    // Login Alex
    const alexRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { emailOrPhone: 'alex@campus.edu', password: 'Password123!' },
    });
    assert.strictEqual(alexRes.statusCode, 200);
    alexToken = JSON.parse(alexRes.body).data.token;
    assert.ok(alexToken);

    // Login Priya
    const priyaRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { emailOrPhone: 'priya@campus.edu', password: 'Password123!' },
    });
    assert.strictEqual(priyaRes.statusCode, 200);
    priyaToken = JSON.parse(priyaRes.body).data.token;
    assert.ok(priyaToken);
  });

  it('Verifies Form Validation on Empty and Invalid Inputs', async () => {
    // Missing required fields
    const emptyRes = await app.inject({
      method: 'POST',
      url: '/api/campus/items',
      headers: { Authorization: `Bearer ${alexToken}` },
      payload: {},
    });
    assert.strictEqual(emptyRes.statusCode, 400);
    const emptyBody = JSON.parse(emptyRes.body);
    assert.strictEqual(emptyBody.error.code, 'VALIDATION_ERROR');

    // Invalid date format
    const badDateRes = await app.inject({
      method: 'POST',
      url: '/api/campus/items',
      headers: { Authorization: `Bearer ${alexToken}` },
      payload: {
        type: 'lost',
        title: 'Apple Watch Series 9',
        category: 'electronics',
        description: 'Lost in locker room',
        location: 'Campus Recreation / Gym',
        dateOccurred: 'invalid-date-format',
        contactMethod: 'alex@campus.edu',
      },
    });
    assert.strictEqual(badDateRes.statusCode, 400);

    // Invalid category
    const badCategoryRes = await app.inject({
      method: 'POST',
      url: '/api/campus/items',
      headers: { Authorization: `Bearer ${alexToken}` },
      payload: {
        type: 'lost',
        title: 'Apple Watch Series 9',
        category: 'not_a_valid_category',
        description: 'Lost in locker room',
        location: 'Campus Recreation / Gym',
        dateOccurred: '2026-10-23',
        contactMethod: 'alex@campus.edu',
      },
    });
    assert.strictEqual(badCategoryRes.statusCode, 400);
  });

  it('Verifies Item Creation, Persistence, and Listing Filters', async () => {
    // Alex creates a lost item report
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/campus/items',
      headers: { Authorization: `Bearer ${alexToken}` },
      payload: {
        type: 'lost',
        title: 'Dell XPS 15 Laptop in Grey Sleeve',
        category: 'electronics',
        description: 'Left on table 4 at Student Union second floor coffee shop.',
        location: 'Student Union / Center',
        dateOccurred: '2026-10-23',
        contactMethod: 'alex@campus.edu',
      },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const itemData = JSON.parse(createRes.body).data;
    testItemId = itemData.id;
    assert.strictEqual(itemData.title, 'Dell XPS 15 Laptop in Grey Sleeve');
    assert.strictEqual(itemData.status, 'open');

    // Verify it appears in search by keyword
    const searchRes = await app.inject({
      method: 'GET',
      url: '/api/campus/items?search=XPS',
    });
    assert.strictEqual(searchRes.statusCode, 200);
    const searchBody = JSON.parse(searchRes.body);
    assert.ok(searchBody.data.some((i: any) => i.id === testItemId));

    // Verify it appears in category filter
    const catRes = await app.inject({
      method: 'GET',
      url: '/api/campus/items?category=electronics',
    });
    assert.strictEqual(catRes.statusCode, 200);
    const catBody = JSON.parse(catRes.body);
    assert.ok(catBody.data.some((i: any) => i.id === testItemId));

    // Verify it appears in location filter
    const locRes = await app.inject({
      method: 'GET',
      url: '/api/campus/items?location=Student%20Union%20/%20Center',
    });
    assert.strictEqual(locRes.statusCode, 200);
    const locBody = JSON.parse(locRes.body);
    assert.ok(locBody.data.some((i: any) => i.id === testItemId));
  });

  it('Verifies Sensitive Info Concealment and Privacy Safeguards', async () => {
    // Priya reports a found government ID / credit card
    const sensitiveRes = await app.inject({
      method: 'POST',
      url: '/api/campus/items',
      headers: { Authorization: `Bearer ${priyaToken}` },
      payload: {
        type: 'found',
        title: 'Campus ID Card & Transit Pass',
        category: 'student_ids_cards',
        description: 'Found on walkway leading to Humanities Building.',
        location: 'Humanities Building',
        dateOccurred: '2026-10-23',
        contactMethod: 'Handed to Humanities Dept Admin Office',
        isSensitive: true,
        sensitiveDetails: 'Student ID: 2024-99881, Name on card: Sarah Jenkins',
      },
    });
    assert.strictEqual(sensitiveRes.statusCode, 201);
    const sensId = JSON.parse(sensitiveRes.body).data.id;

    // Public / non-owner viewing must NOT reveal sensitive details
    const publicView = await app.inject({
      method: 'GET',
      url: `/api/campus/items/${sensId}`,
      headers: { Authorization: `Bearer ${alexToken}` },
    });
    assert.strictEqual(publicView.statusCode, 200);
    const publicData = JSON.parse(publicView.body).data.item;
    assert.strictEqual(publicData.sensitiveDetails, null);
    assert.ok(!publicData.description.includes('99881'));
  });

  it('Verifies Distinguishing Feature Claim & Status Workflow', async () => {
    // 1. Alex cannot claim his own lost item
    const selfClaim = await app.inject({
      method: 'POST',
      url: `/api/campus/items/${testItemId}/claim`,
      headers: { Authorization: `Bearer ${alexToken}` },
      payload: {
        claimantName: 'Alex Chen',
        claimantContact: 'alex@campus.edu',
        distinguishingFeature: 'I lost this myself',
      },
    });
    assert.strictEqual(selfClaim.statusCode, 400);

    // 2. Priya submits a claim describing the distinguishing feature
    const priyaClaim = await app.inject({
      method: 'POST',
      url: `/api/campus/items/${testItemId}/claim`,
      headers: { Authorization: `Bearer ${priyaToken}` },
      payload: {
        claimantName: 'Priya Patel',
        claimantContact: 'priya@campus.edu',
        distinguishingFeature: 'Inside the grey sleeve there is a green USB-C dongle and an Intel Core i7 sticker.',
        message: 'I turned it into the Student Union info desk this morning.',
      },
    });
    assert.strictEqual(priyaClaim.statusCode, 201);
    testClaimId = JSON.parse(priyaClaim.body).data.id;

    // 3. Status changes to 'claim_pending', NOT 'returned'
    const statusCheck = await app.inject({
      method: 'GET',
      url: `/api/campus/items/${testItemId}`,
    });
    assert.strictEqual(JSON.parse(statusCheck.body).data.item.status, 'claim_pending');

    // 4. Alex (owner) accepts the claim
    const acceptRes = await app.inject({
      method: 'PATCH',
      url: `/api/campus/claims/${testClaimId}/review`,
      headers: { Authorization: `Bearer ${alexToken}` },
      payload: {
        status: 'accepted',
        ownerResponse: 'Thank you so much! Picking it up from the info desk now.',
      },
    });
    assert.strictEqual(acceptRes.statusCode, 200);
    assert.strictEqual(JSON.parse(acceptRes.body).data.status, 'accepted');

    // 5. Alex marks item as 'returned'
    const returnRes = await app.inject({
      method: 'PATCH',
      url: `/api/campus/items/${testItemId}`,
      headers: { Authorization: `Bearer ${alexToken}` },
      payload: { status: 'returned' },
    });
    assert.strictEqual(returnRes.statusCode, 200);
    assert.strictEqual(JSON.parse(returnRes.body).data.status, 'returned');
  });

  it('Verifies Access Control: User Cannot Edit or Delete Another User\'s Report', async () => {
    // Priya tries to edit Alex's item
    const unauthorizedEdit = await app.inject({
      method: 'PATCH',
      url: `/api/campus/items/${testItemId}`,
      headers: { Authorization: `Bearer ${priyaToken}` },
      payload: { title: 'Malicious modification' },
    });
    assert.strictEqual(unauthorizedEdit.statusCode, 403);
    assert.strictEqual(JSON.parse(unauthorizedEdit.body).error.code, 'FORBIDDEN');

    // Priya tries to delete Alex's item
    const unauthorizedDelete = await app.inject({
      method: 'DELETE',
      url: `/api/campus/items/${testItemId}`,
      headers: { Authorization: `Bearer ${priyaToken}` },
    });
    assert.strictEqual(unauthorizedDelete.statusCode, 403);
    assert.strictEqual(JSON.parse(unauthorizedDelete.body).error.code, 'FORBIDDEN');
  });
});
