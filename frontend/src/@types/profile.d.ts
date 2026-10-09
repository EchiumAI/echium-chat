// The user's Profile & memory: one short, editable description of the person
// that Echium uses to personalise answers. See backend usecases/user_profile.py.

export type UserProfile = {
  enabled: boolean;
  profile: string;
  // Only non-empty while sensitiveConsent is true.
  sensitive: string;
  sensitiveConsent: boolean;
  consentTime: number | null;
  consentVersion: string | null;
  // Version of the consent wording the UI shows.
  currentConsentVersion: string;
  shareAllAgents: boolean;
  allowedAgentIds: string[];
  updateTime: number;
};

export type UserProfileInput = {
  enabled: boolean;
  profile: string;
  sensitive: string;
  sensitiveConsent: boolean;
  shareAllAgents: boolean;
  allowedAgentIds: string[];
};
