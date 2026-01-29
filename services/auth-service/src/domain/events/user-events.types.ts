export enum UserEventType {
  USER_CREATED = "user.created",
  USER_UPDATED = "user.updated",
}

export interface UserCreatedEventPayload {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  role: string;
  preferredLanguage?: string;
  provider: string; // e.g., "google", "email", etc.
  providerId: string;
  createdAt: string;
}

export interface UserCreatedEvent {
  type: UserEventType.USER_CREATED;
  payload: UserCreatedEventPayload;
  meta: {
    eventId: string;
    occurredAt: string;
    source: "auth-service";
  };
  version: number;
}

export interface UserUpdatedEventPayload {
  userId: string;
  email?: string;
  name?: string;
  picture?: string;
  role?: string;
  preferredLanguage?: string;
  updatedAt: string;
}

export interface UserUpdatedEvent {
  type: UserEventType.USER_UPDATED;
  payload: UserUpdatedEventPayload;
  meta: {
    eventId: string;
    occurredAt: string;
    source: "auth-service";
  };
  version: number;
}

export type UserDomainEvent = UserCreatedEvent | UserUpdatedEvent;
