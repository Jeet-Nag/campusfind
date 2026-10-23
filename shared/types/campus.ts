export type CampusItemType = 'lost' | 'found';

export type CampusItemStatus = 'open' | 'claim_pending' | 'returned';

export type CampusCategory =
  | 'electronics'
  | 'student_ids_cards'
  | 'keys_wallets'
  | 'books'
  | 'clothing'
  | 'accessories'
  | 'other';

export type CampusClaimStatus = 'pending' | 'accepted' | 'rejected';

export interface CampusItem {
  id: string;
  userId: string;
  type: CampusItemType;
  title: string;
  category: CampusCategory;
  description: string;
  location: string;
  dateOccurred: string;
  imageUrl?: string | null;
  contactMethod: string;
  isSensitive: boolean;
  sensitiveDetails?: string | null;
  status: CampusItemStatus;
  createdAt: string;
  updatedAt: string;
  reporterName?: string;
  claimsCount?: number;
}

export interface CampusClaim {
  id: string;
  itemId: string;
  claimantId: string;
  claimantName: string;
  claimantContact: string;
  distinguishingFeature: string;
  message?: string | null;
  status: CampusClaimStatus;
  ownerResponse?: string | null;
  createdAt: string;
  updatedAt: string;
  itemTitle?: string;
  itemType?: CampusItemType;
  itemLocation?: string;
  itemImageUrl?: string | null;
}

export interface StudentProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  studentId?: string | null;
  role: 'customer' | 'admin' | 'provider';
  createdAt: string;
}

export const CAMPUS_CATEGORIES: { id: CampusCategory; label: string; icon: string }[] = [
  { id: 'electronics', label: 'Electronics & Gadgets', icon: '💻' },
  { id: 'student_ids_cards', label: 'Student IDs & Bank Cards', icon: '🪪' },
  { id: 'keys_wallets', label: 'Keys & Wallets', icon: '🔑' },
  { id: 'books', label: 'Books & Stationeries', icon: '📚' },
  { id: 'clothing', label: 'Clothing & Apparel', icon: '👕' },
  { id: 'accessories', label: 'Bags, Bottles & Accessories', icon: '🎒' },
  { id: 'other', label: 'Other Items', icon: '📦' },
];

export const CAMPUS_LOCATIONS: string[] = [
  'Main Library',
  'Student Union / Center',
  'Science & Engineering Complex',
  'Campus Recreation / Gym',
  'Dining Hall & Cafeteria',
  'Humanities Building',
  'Business School Hall',
  'Campus Dorms / Residential Hall',
  'Administration & Registrar',
  'Campus Green / Central Quad',
  'Athletic Center / Stadium',
  'Campus Shuttle / Bus Stop',
  'Other Campus Location',
];
