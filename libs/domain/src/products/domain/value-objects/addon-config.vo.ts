export interface AddonConfig {
  productId: string;
  required?: boolean;        // Must-have vs optional add-on
  minQuantity?: number;      // Minimum quantity (default: 1)
  maxQuantity?: number;       // Maximum quantity (default: unlimited)
  dependencies?: string[];    // Other add-on productIds that must be included
  conflicts?: string[];       // Add-on productIds that cannot coexist
  pricing?: {
    type: "fixed" | "per_unit" | "percentage";
    amount?: number;
    currency?: string;
    percentage?: number;      // For percentage-based pricing
  };
  metadata?: Record<string, any>; // Additional configuration
}
