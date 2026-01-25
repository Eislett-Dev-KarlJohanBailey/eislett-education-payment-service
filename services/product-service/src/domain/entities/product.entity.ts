import { DomainError } from "../errors/domain.error";
import { EntitlementKey } from "../value-objects/entitlement-key.vo";
import { ProductType } from "../value-objects/product-type.vo";
import { UsageLimit } from "../value-objects/useage-limit.vo";

export interface ProductProps {
    productId: string;
    name: string;
    description?: string;
    type: ProductType;
  
    entitlements: EntitlementKey[];
  
    usageLimits?: UsageLimit[];
  
    addons?: string[]; // productIds of add-ons
  
    isActive: boolean;
  
    createdAt: Date;
    updatedAt: Date;
  }
  
  export class Product {
    private readonly _productId: string;
    private _name: string;
    private _description?: string;
    private readonly _type: ProductType;
    private _entitlements: EntitlementKey[];
    private _usageLimits: UsageLimit[];
    private _addons: string[];
    private _isActive: boolean;
    private _createdAt: Date;
    private _updatedAt: Date;
  
    private constructor(props: ProductProps) {
      this._productId = props.productId;
      this._name = props.name;
      this._description = props.description;
      this._type = props.type;
      this._entitlements = props.entitlements;
      this._usageLimits = props.usageLimits ?? [];
      this._addons = props.addons ?? [];
      this._isActive = props.isActive;
      this._createdAt = props.createdAt;
      this._updatedAt = props.updatedAt;
  
      this.validate();
    }
  
    // ---------- FACTORY ----------
  
    static create(props: Omit<ProductProps, "createdAt" | "updatedAt">): Product {
      return new Product({
        ...props,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  
    // ---------- GETTERS ----------
  
    get productId(): string {
      return this._productId;
    }
  
    get name(): string {
      return this._name;
    }
  
    get description(): string | undefined {
      return this._description;
    }
  
    get type(): ProductType {
      return this._type;
    }
  
    get entitlements(): EntitlementKey[] {
      return [...this._entitlements];
    }
  
    get usageLimits(): UsageLimit[] {
      return [...this._usageLimits];
    }
  
    get addons(): string[] {
      return [...this._addons];
    }
  
    get isActive(): boolean {
      return this._isActive;
    }
  
    get createdAt(): Date {
      return this._createdAt;
    }
  
    get updatedAt(): Date {
      return this._updatedAt;
    }
  
    // ---------- BEHAVIOR ----------
  
    rename(name: string): void {
      if (!name || name.trim().length < 3) {
        throw new DomainError("Product name must be at least 3 characters");
      }
      this._name = name.trim();
      this.touch();
    }
  
    updateDescription(description?: string): void {
      this._description = description;
      this.touch();
    }
  
    activate(): void {
      this._isActive = true;
      this.touch();
    }
  
    deactivate(): void {
      this._isActive = false;
      this.touch();
    }
  
    addEntitlement(entitlement: EntitlementKey): void {
      if (this._entitlements.includes(entitlement)) return;
      this._entitlements.push(entitlement);
      this.touch();
    }
  
    removeEntitlement(entitlement: EntitlementKey): void {
      this._entitlements = this._entitlements.filter(e => e !== entitlement);
      this.touch();
    }
  
    addUsageLimit(limit: UsageLimit): void {
      const exists = this._usageLimits.find(
        l => l.metric === limit.metric && l.period === limit.period
      );
  
      if (exists) {
        throw new DomainError(
          `Usage limit for ${limit.metric}/${limit.period} already exists`
        );
      }
  
      this._usageLimits.push(limit);
      this.touch();
    }
  
    addAddon(productId: string): void {
      if (this._type !== ProductType.SUBSCRIPTION) {
        throw new DomainError("Only subscription products can have add-ons");
      }
  
      if (this._addons.includes(productId)) return;
      this._addons.push(productId);
      this.touch();
    }
  
    // ---------- VALIDATION ----------
  
    private validate(): void {
      if (!this._productId) {
        throw new DomainError("Product must have an ID");
      }
  
      if (!this._name || this._name.trim().length < 3) {
        throw new DomainError("Product name must be at least 3 characters");
      }
  
      if (this._entitlements.length === 0) {
        throw new DomainError("Product must define at least one entitlement");
      }
  
      if (
        this._type === ProductType.ADDON &&
        this._addons.length > 0
      ) {
        throw new DomainError("Add-on products cannot have add-ons");
      }
    }
  
    private touch(): void {
      this._updatedAt = new Date();
    }
  }