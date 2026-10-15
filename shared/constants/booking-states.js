export const VALID_STATUS_TRANSITIONS = {
    SERVICE_REQUESTED: [
        'PROVIDER_ASSIGNED',
        'PROVIDER_ACCEPTED',
        'CANCELLED_BY_CUSTOMER',
        'CANCELLED_BY_ADMIN'
    ],
    PROVIDER_ASSIGNED: [
        'PROVIDER_ACCEPTED',
        'REJECTED_BY_PROVIDER',
        'CANCELLED_BY_CUSTOMER',
        'CANCELLED_BY_ADMIN'
    ],
    REJECTED_BY_PROVIDER: [
        'SERVICE_REQUESTED',
        'PROVIDER_ASSIGNED',
        'CANCELLED_BY_ADMIN'
    ],
    PROVIDER_ACCEPTED: [
        'PROVIDER_ON_THE_WAY',
        'REJECTED_BY_PROVIDER',
        'CANCELLED_BY_CUSTOMER',
        'CANCELLED_BY_ADMIN'
    ],
    PROVIDER_ON_THE_WAY: [
        'SERVICE_STARTED',
        'CANCELLED_BY_ADMIN'
    ],
    SERVICE_STARTED: [
        'SERVICE_COMPLETED',
        'CANCELLED_BY_ADMIN'
    ],
    SERVICE_COMPLETED: [
        'PAYMENT_PENDING',
        'CANCELLED_BY_ADMIN'
    ],
    PAYMENT_PENDING: [
        'PAYMENT_COLLECTED',
        'CANCELLED_BY_ADMIN'
    ],
    PAYMENT_COLLECTED: [
        'BOOKING_COMPLETED'
    ],
    BOOKING_COMPLETED: [],
    CANCELLED_BY_CUSTOMER: [],
    CANCELLED_BY_ADMIN: []
};
export function canTransition(from, to, role) {
    const allowed = VALID_STATUS_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
        return false;
    }
    // Role-specific transition permissions
    if (role === 'customer') {
        // Customers can ONLY cancel, and only before provider is on the way
        return to === 'CANCELLED_BY_CUSTOMER' && ['SERVICE_REQUESTED', 'PROVIDER_ASSIGNED', 'PROVIDER_ACCEPTED'].includes(from);
    }
    if (role === 'provider') {
        // Providers can accept, reject, mark on the way, start, complete, and confirm payment collected
        const providerAllowed = [
            'PROVIDER_ACCEPTED',
            'REJECTED_BY_PROVIDER',
            'PROVIDER_ON_THE_WAY',
            'SERVICE_STARTED',
            'SERVICE_COMPLETED',
            'PAYMENT_PENDING',
            'PAYMENT_COLLECTED',
            'BOOKING_COMPLETED'
        ];
        return providerAllowed.includes(to);
    }
    // Admin can perform all valid transitions
    return true;
}
/**
 * Canonical active-booking statuses that represent an active commitment
 * or pending assigned offer for a provider, preventing them from receiving
 * or claiming additional jobs.
 */
export const ACTIVE_BOOKING_STATUSES = [
    'PROVIDER_ASSIGNED',
    'PROVIDER_ACCEPTED',
    'PROVIDER_ON_THE_WAY',
    'SERVICE_STARTED',
    'SERVICE_COMPLETED',
    'PAYMENT_PENDING',
    'PAYMENT_COLLECTED',
];
