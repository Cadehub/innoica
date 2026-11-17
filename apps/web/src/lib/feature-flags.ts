/**
 * INNOICA Feature Flags
 * Controls progressive release of modules without deleting or breaking underlying code.
 */

// Controls public & dashboard visibility of the native e-commerce store module.
// When false:
// - Dashboard navigation hides "/store"
// - Pricing shows Free & INNOICA Agent (3 500 FCFA) as recommended
// - Subscription manager focuses strictly on Free & INNOICA Agent
// To re-enable instantly: set NEXT_PUBLIC_ENABLE_STORE=true in environment.
export const isStoreModuleEnabled = process.env.NEXT_PUBLIC_ENABLE_STORE === 'true';
