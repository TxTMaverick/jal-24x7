/**
 * Pricing constants shown in copy.
 *
 * The backend is always the authority on what a customer is actually charged:
 * every figure on an invoice comes from `/api/quote`. These exist only so the
 * surrounding text ("free delivery above X", "+Y for express") can be written
 * without scattering literals through the components, where they quietly go
 * stale the next time the catalogue is repriced.
 *
 * Keep in step with `backend/app/config.py` and `backend/app/services/pricing.py`.
 */

/** Orders at or above this subtotal ship free. */
export const FREE_DELIVERY_THRESHOLD = 150;

/** Flat delivery fee below the threshold. */
export const BASE_DELIVERY_FEE = 15;

/** Express dispatch fee, charged instead of the base fee. */
export const EXPRESS_DELIVERY_FEE = 30;

/** A tanker trip covers this radius before a per-km surcharge applies. */
export const TANKER_FREE_RADIUS_KM = 8;

/** Per-kilometre tanker surcharge beyond the free radius. */
export const TANKER_PER_KM_SURCHARGE = 10;

/** GST applied to the order total. */
export const GST_RATE = 0.18;
