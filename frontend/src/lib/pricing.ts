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

/**
 * Standard delivery is free because it is already inside the listed price:
 * a 20L jar is about Rs 20 from a local supplier and lists here at Rs 30.
 */
export const FREE_DELIVERY_THRESHOLD = 0;

/** Standard delivery costs nothing extra at checkout. */
export const BASE_DELIVERY_FEE = 0;

/** Express dispatch genuinely costs more to serve, so it is charged. */
export const EXPRESS_DELIVERY_FEE = 20;

/** A tanker trip covers this radius before a per-km surcharge applies. */
export const TANKER_FREE_RADIUS_KM = 8;

/** Per-kilometre tanker surcharge beyond the free radius. */
export const TANKER_PER_KM_SURCHARGE = 10;

/** GST applied to the order total. */
export const GST_RATE = 0.18;
