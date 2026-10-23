import { db } from '../db';
import { CampusItem, CampusClaim, CampusItemType, CampusCategory, CampusItemStatus, CampusClaimStatus } from '@shared';

export interface ListItemsFilters {
  search?: string;
  type?: string;
  category?: string;
  location?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface CreateItemInput {
  type: CampusItemType;
  title: string;
  category: CampusCategory;
  description: string;
  location: string;
  dateOccurred: string;
  contactMethod: string;
  imageUrl?: string | null;
  isSensitive?: boolean;
  sensitiveDetails?: string | null;
}

export interface UpdateItemInput {
  title?: string;
  category?: CampusCategory;
  description?: string;
  location?: string;
  dateOccurred?: string;
  contactMethod?: string;
  imageUrl?: string | null;
  isSensitive?: boolean;
  sensitiveDetails?: string | null;
  status?: CampusItemStatus;
}

export class CampusService {
  /**
   * Lists items with search, filters, and pagination.
   * Public listings omit confidential/sensitive details.
   */
  public async listItems(filters: ListItemsFilters): Promise<CampusItem[]> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.type && (filters.type === 'lost' || filters.type === 'found')) {
      conditions.push(`ci.type = $${idx++}`);
      values.push(filters.type);
    }

    if (filters.category && filters.category !== 'all') {
      conditions.push(`ci.category = $${idx++}`);
      values.push(filters.category);
    }

    if (filters.location && filters.location !== 'all') {
      conditions.push(`ci.location = $${idx++}`);
      values.push(filters.location);
    }

    if (filters.status && filters.status !== 'all') {
      conditions.push(`ci.status = $${idx++}`);
      values.push(filters.status);
    }

    if (filters.search && filters.search.trim().length > 0) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      conditions.push(`(LOWER(ci.title) LIKE $${idx} OR LOWER(ci.description) LIKE $${idx} OR LOWER(ci.location) LIKE $${idx})`);
      values.push(term);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ? Math.min(filters.limit, 100) : 50;
    const offset = filters.offset || 0;

    const query = `
      SELECT 
        ci.id,
        ci.user_id as "userId",
        ci.type,
        ci.title,
        ci.category,
        ci.description,
        ci.location,
        ci.date_occurred::text as "dateOccurred",
        ci.image_url as "imageUrl",
        ci.contact_method as "contactMethod",
        ci.is_sensitive as "isSensitive",
        ci.status,
        ci.created_at::text as "createdAt",
        ci.updated_at::text as "updatedAt",
        u.full_name as "reporterName",
        (SELECT COUNT(*)::int FROM campus_claims cc WHERE cc.item_id = ci.id) as "claimsCount"
      FROM campus_items ci
      JOIN users u ON u.id = ci.user_id
      ${whereClause}
      ORDER BY ci.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    values.push(limit, offset);

    const { rows } = await pool.query<CampusItem>(query, values);
    return rows;
  }

  /**
   * Retrieves single item detail.
   * If requesting user is the owner, includes sensitiveDetails and attached claims.
   */
  public async getItemById(itemId: string, requestingUserId?: string): Promise<{ item: CampusItem; claims?: CampusClaim[] } | null> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const query = `
      SELECT 
        ci.id,
        ci.user_id as "userId",
        ci.type,
        ci.title,
        ci.category,
        ci.description,
        ci.location,
        ci.date_occurred::text as "dateOccurred",
        ci.image_url as "imageUrl",
        ci.contact_method as "contactMethod",
        ci.is_sensitive as "isSensitive",
        ci.sensitive_details as "sensitiveDetails",
        ci.status,
        ci.created_at::text as "createdAt",
        ci.updated_at::text as "updatedAt",
        u.full_name as "reporterName",
        (SELECT COUNT(*)::int FROM campus_claims cc WHERE cc.item_id = ci.id) as "claimsCount"
      FROM campus_items ci
      JOIN users u ON u.id = ci.user_id
      WHERE ci.id = $1
      LIMIT 1
    `;

    const { rows } = await pool.query<CampusItem>(query, [itemId]);
    if (rows.length === 0) return null;

    const item = rows[0];
    const isOwner = requestingUserId && requestingUserId === item.userId;

    if (!isOwner) {
      // Conceal confidential identifying details and direct personal contact info from public view
      item.sensitiveDetails = null;
      if (item.isSensitive) {
        item.description = `${item.description} (Note: Confidential details hidden for privacy. Claimant must verify with distinguishing features.)`;
      }
      return { item };
    }

    // If owner, fetch submitted claims
    const claimsQuery = `
      SELECT 
        cc.id,
        cc.item_id as "itemId",
        cc.claimant_id as "claimantId",
        cc.claimant_name as "claimantName",
        cc.claimant_contact as "claimantContact",
        cc.distinguishing_feature as "distinguishingFeature",
        cc.message,
        cc.status,
        cc.owner_response as "ownerResponse",
        cc.created_at::text as "createdAt",
        cc.updated_at::text as "updatedAt"
      FROM campus_claims cc
      WHERE cc.item_id = $1
      ORDER BY cc.created_at DESC
    `;

    const claimsRes = await pool.query<CampusClaim>(claimsQuery, [itemId]);
    return { item, claims: claimsRes.rows };
  }

  /**
   * Creates a new lost or found report.
   */
  public async createItem(userId: string, input: CreateItemInput): Promise<CampusItem> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const query = `
      INSERT INTO campus_items (
        user_id, type, title, category, description, location, 
        date_occurred, contact_method, image_url, is_sensitive, sensitive_details, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open')
      RETURNING 
        id, user_id as "userId", type, title, category, description, location,
        date_occurred::text as "dateOccurred", contact_method as "contactMethod",
        image_url as "imageUrl", is_sensitive as "isSensitive", sensitive_details as "sensitiveDetails",
        status, created_at::text as "createdAt", updated_at::text as "updatedAt"
    `;

    const values = [
      userId,
      input.type,
      input.title.trim(),
      input.category,
      input.description.trim(),
      input.location.trim(),
      input.dateOccurred,
      input.contactMethod.trim(),
      input.imageUrl || null,
      Boolean(input.isSensitive),
      input.sensitiveDetails ? input.sensitiveDetails.trim() : null,
    ];

    const { rows } = await pool.query<CampusItem>(query, values);
    return rows[0];
  }

  /**
   * Updates an item report. Protected: owner only.
   */
  public async updateItem(itemId: string, userId: string, input: UpdateItemInput): Promise<CampusItem> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    // Verify ownership
    const check = await pool.query<{ user_id: string }>('SELECT user_id FROM campus_items WHERE id = $1', [itemId]);
    if (check.rows.length === 0) {
      throw new Error('ITEM_NOT_FOUND');
    }
    if (check.rows[0].user_id !== userId) {
      throw new Error('FORBIDDEN');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${idx++}`);
      values.push(input.title.trim());
    }
    if (input.category !== undefined) {
      updates.push(`category = $${idx++}`);
      values.push(input.category);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(input.description.trim());
    }
    if (input.location !== undefined) {
      updates.push(`location = $${idx++}`);
      values.push(input.location.trim());
    }
    if (input.dateOccurred !== undefined) {
      updates.push(`date_occurred = $${idx++}`);
      values.push(input.dateOccurred);
    }
    if (input.contactMethod !== undefined) {
      updates.push(`contact_method = $${idx++}`);
      values.push(input.contactMethod.trim());
    }
    if (input.imageUrl !== undefined) {
      updates.push(`image_url = $${idx++}`);
      values.push(input.imageUrl);
    }
    if (input.isSensitive !== undefined) {
      updates.push(`is_sensitive = $${idx++}`);
      values.push(input.isSensitive);
    }
    if (input.sensitiveDetails !== undefined) {
      updates.push(`sensitive_details = $${idx++}`);
      values.push(input.sensitiveDetails);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(input.status);
    }

    updates.push(`updated_at = NOW()`);

    const query = `
      UPDATE campus_items
      SET ${updates.join(', ')}
      WHERE id = $${idx++}
      RETURNING 
        id, user_id as "userId", type, title, category, description, location,
        date_occurred::text as "dateOccurred", contact_method as "contactMethod",
        image_url as "imageUrl", is_sensitive as "isSensitive", sensitive_details as "sensitiveDetails",
        status, created_at::text as "createdAt", updated_at::text as "updatedAt"
    `;

    values.push(itemId);

    const { rows } = await pool.query<CampusItem>(query, values);
    return rows[0];
  }

  /**
   * Deletes an item report. Protected: owner only.
   */
  public async deleteItem(itemId: string, userId: string): Promise<void> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const check = await pool.query<{ user_id: string }>('SELECT user_id FROM campus_items WHERE id = $1', [itemId]);
    if (check.rows.length === 0) {
      throw new Error('ITEM_NOT_FOUND');
    }
    if (check.rows[0].user_id !== userId) {
      throw new Error('FORBIDDEN');
    }

    await pool.query('DELETE FROM campus_items WHERE id = $1', [itemId]);
  }

  /**
   * Lists all reports created by the current user.
   */
  public async listUserReports(userId: string): Promise<CampusItem[]> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const query = `
      SELECT 
        ci.id,
        ci.user_id as "userId",
        ci.type,
        ci.title,
        ci.category,
        ci.description,
        ci.location,
        ci.date_occurred::text as "dateOccurred",
        ci.image_url as "imageUrl",
        ci.contact_method as "contactMethod",
        ci.is_sensitive as "isSensitive",
        ci.sensitive_details as "sensitiveDetails",
        ci.status,
        ci.created_at::text as "createdAt",
        ci.updated_at::text as "updatedAt",
        (SELECT COUNT(*)::int FROM campus_claims cc WHERE cc.item_id = ci.id) as "claimsCount"
      FROM campus_items ci
      WHERE ci.user_id = $1
      ORDER BY ci.created_at DESC
    `;

    const { rows } = await pool.query<CampusItem>(query, [userId]);
    return rows;
  }

  /**
   * Submits a claim / contact request for an item.
   * Claimant must provide distinguishing feature proof and cannot claim their own item.
   */
  public async submitClaim(
    itemId: string,
    claimantId: string,
    input: {
      claimantName: string;
      claimantContact: string;
      distinguishingFeature: string;
      message?: string;
    }
  ): Promise<CampusClaim> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    // 1. Fetch item to verify existence and check ownership
    const itemRes = await pool.query<{ id: string; user_id: string; status: string }>(
      'SELECT id, user_id, status FROM campus_items WHERE id = $1',
      [itemId]
    );

    if (itemRes.rows.length === 0) {
      throw new Error('ITEM_NOT_FOUND');
    }

    const item = itemRes.rows[0];
    if (item.user_id === claimantId) {
      throw new Error('CANNOT_CLAIM_OWN_ITEM');
    }

    if (!input.distinguishingFeature || input.distinguishingFeature.trim().length < 5) {
      throw new Error('DISTINGUISHING_FEATURE_REQUIRED');
    }

    if (!input.claimantContact || input.claimantContact.trim().length < 3) {
      throw new Error('CLAIMANT_CONTACT_REQUIRED');
    }

    // 2. Insert claim record
    const insertQuery = `
      INSERT INTO campus_claims (
        item_id, claimant_id, claimant_name, claimant_contact, 
        distinguishing_feature, message, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING 
        id, item_id as "itemId", claimant_id as "claimantId",
        claimant_name as "claimantName", claimant_contact as "claimantContact",
        distinguishing_feature as "distinguishingFeature", message,
        status, owner_response as "ownerResponse",
        created_at::text as "createdAt", updated_at::text as "updatedAt"
    `;

    const { rows } = await pool.query<CampusClaim>(insertQuery, [
      itemId,
      claimantId,
      input.claimantName.trim(),
      input.claimantContact.trim(),
      input.distinguishingFeature.trim(),
      input.message ? input.message.trim() : null,
    ]);

    // 3. Update item status to 'claim_pending' if currently 'open'
    if (item.status === 'open') {
      await pool.query("UPDATE campus_items SET status = 'claim_pending', updated_at = NOW() WHERE id = $1", [itemId]);
    }

    return rows[0];
  }

  /**
   * Updates claim status (accepted or rejected) by item owner.
   */
  public async reviewClaim(
    claimId: string,
    ownerId: string,
    status: 'accepted' | 'rejected',
    ownerResponse?: string
  ): Promise<CampusClaim> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    // Verify claim exists and that ownerId owns the corresponding item
    const check = await pool.query<{ id: string; user_id: string; item_id: string }>(
      `SELECT cc.id, ci.user_id, cc.item_id 
       FROM campus_claims cc
       JOIN campus_items ci ON ci.id = cc.item_id
       WHERE cc.id = $1`,
      [claimId]
    );

    if (check.rows.length === 0) {
      throw new Error('CLAIM_NOT_FOUND');
    }

    if (check.rows[0].user_id !== ownerId) {
      throw new Error('FORBIDDEN');
    }

    const { rows } = await pool.query<CampusClaim>(
      `UPDATE campus_claims
       SET status = $1, owner_response = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING 
         id, item_id as "itemId", claimant_id as "claimantId",
         claimant_name as "claimantName", claimant_contact as "claimantContact",
         distinguishing_feature as "distinguishingFeature", message,
         status, owner_response as "ownerResponse",
         created_at::text as "createdAt", updated_at::text as "updatedAt"`,
      [status, ownerResponse ? ownerResponse.trim() : null, claimId]
    );

    return rows[0];
  }

  /**
   * Lists claims submitted by a given user.
   */
  public async listUserClaims(claimantId: string): Promise<CampusClaim[]> {
    const pool = db.getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const query = `
      SELECT 
        cc.id,
        cc.item_id as "itemId",
        cc.claimant_id as "claimantId",
        cc.claimant_name as "claimantName",
        cc.claimant_contact as "claimantContact",
        cc.distinguishing_feature as "distinguishingFeature",
        cc.message,
        cc.status,
        cc.owner_response as "ownerResponse",
        cc.created_at::text as "createdAt",
        cc.updated_at::text as "updatedAt",
        ci.title as "itemTitle",
        ci.type as "itemType",
        ci.location as "itemLocation",
        ci.image_url as "itemImageUrl"
      FROM campus_claims cc
      JOIN campus_items ci ON ci.id = cc.item_id
      WHERE cc.claimant_id = $1
      ORDER BY cc.created_at DESC
    `;

    const { rows } = await pool.query<CampusClaim>(query, [claimantId]);
    return rows;
  }
}

export const campusService = new CampusService();
