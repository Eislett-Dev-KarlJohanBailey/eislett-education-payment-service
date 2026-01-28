import { DunningState } from "../value-objects/dunning-state.vo";

export interface DunningRecordProps {
  userId: string;
  state: DunningState;
  portalUrl?: string;
  expiresAt?: Date;
  detectedAt: Date;
  lastUpdatedAt: Date;
  paymentIntentId?: string;
  invoiceId?: string;
  subscriptionId?: string;
  failureCode?: string;
  failureReason?: string;
}

export class DunningRecord {
  private readonly _userId: string;
  private _state: DunningState;
  private _portalUrl?: string;
  private _expiresAt?: Date;
  private readonly _detectedAt: Date;
  private _lastUpdatedAt: Date;
  private _paymentIntentId?: string;
  private _invoiceId?: string;
  private _subscriptionId?: string;
  private _failureCode?: string;
  private _failureReason?: string;

  constructor(props: DunningRecordProps) {
    this._userId = props.userId;
    this._state = props.state;
    this._portalUrl = props.portalUrl;
    this._expiresAt = props.expiresAt;
    this._detectedAt = props.detectedAt;
    this._lastUpdatedAt = props.lastUpdatedAt;
    this._paymentIntentId = props.paymentIntentId;
    this._invoiceId = props.invoiceId;
    this._subscriptionId = props.subscriptionId;
    this._failureCode = props.failureCode;
    this._failureReason = props.failureReason;
  }

  get userId(): string {
    return this._userId;
  }

  get state(): DunningState {
    return this._state;
  }

  get portalUrl(): string | undefined {
    return this._portalUrl;
  }

  get expiresAt(): Date | undefined {
    return this._expiresAt;
  }

  get detectedAt(): Date {
    return this._detectedAt;
  }

  get lastUpdatedAt(): Date {
    return this._lastUpdatedAt;
  }

  get paymentIntentId(): string | undefined {
    return this._paymentIntentId;
  }

  get invoiceId(): string | undefined {
    return this._invoiceId;
  }

  get subscriptionId(): string | undefined {
    return this._subscriptionId;
  }

  get failureCode(): string | undefined {
    return this._failureCode;
  }

  get failureReason(): string | undefined {
    return this._failureReason;
  }

  /**
   * Calculates the number of days since the billing issue was detected
   */
  getDaysSinceDetection(): number {
    const now = new Date();
    const diffTime = now.getTime() - this._detectedAt.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Determines if the record should transition to the next state based on timeline
   */
  shouldTransition(): boolean {
    const daysSince = this.getDaysSinceDetection();

    switch (this._state) {
      case DunningState.ACTION_REQUIRED:
        // Transition to GRACE_PERIOD after 1 day
        return daysSince >= 1;
      case DunningState.GRACE_PERIOD:
        // Transition to RESTRICTED after 4 days total (3 days in grace period)
        return daysSince >= 4;
      case DunningState.RESTRICTED:
        // Transition to SUSPENDED after 8 days total (4 days in restricted)
        return daysSince >= 8;
      case DunningState.SUSPENDED:
      case DunningState.OK:
        return false;
      default:
        return false;
    }
  }

  /**
   * Gets the next state based on current state and timeline
   */
  getNextState(): DunningState {
    const daysSince = this.getDaysSinceDetection();

    switch (this._state) {
      case DunningState.ACTION_REQUIRED:
        return daysSince >= 1 ? DunningState.GRACE_PERIOD : this._state;
      case DunningState.GRACE_PERIOD:
        return daysSince >= 4 ? DunningState.RESTRICTED : this._state;
      case DunningState.RESTRICTED:
        return daysSince >= 8 ? DunningState.SUSPENDED : this._state;
      default:
        return this._state;
    }
  }

  /**
   * Updates the state and last updated timestamp
   */
  updateState(newState: DunningState): void {
    this._state = newState;
    this._lastUpdatedAt = new Date();
  }

  /**
   * Updates portal URL
   */
  updatePortalUrl(url: string): void {
    this._portalUrl = url;
    this._lastUpdatedAt = new Date();
  }

  /**
   * Resolves the billing issue (moves to OK state)
   */
  resolve(): void {
    this._state = DunningState.OK;
    this._lastUpdatedAt = new Date();
    // Clear billing issue details
    this._portalUrl = undefined;
    this._expiresAt = undefined;
    this._failureCode = undefined;
    this._failureReason = undefined;
  }

  /**
   * Checks if access should be revoked (SUSPENDED state)
   */
  shouldRevokeAccess(): boolean {
    return this._state === DunningState.SUSPENDED;
  }

  /**
   * Checks if access should be restricted (RESTRICTED state)
   */
  shouldRestrictAccess(): boolean {
    return this._state === DunningState.RESTRICTED;
  }
}
