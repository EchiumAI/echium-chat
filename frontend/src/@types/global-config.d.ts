import { AVAILABLE_MODEL_KEYS } from '../constants/index';

export interface GlobalConfig {
  globalAvailableModels: string[];
  defaultModel?: string;
  logoPath?: string;
  // Base URL of the collaborative-docs ("Quip-like") app. Empty/undefined
  // until that service is deployed; the Documents page hides "Open in editor".
  docsAppUrl?: string;
  // Base URL of the Echium Draw app. Empty/undefined until deployed; the drawer
  // hides the "Draw" entry when unset.
  drawAppUrl?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GetGlobalConfigResponse extends GlobalConfig {}

export interface ModelItem {
  modelId: (typeof AVAILABLE_MODEL_KEYS)[number];
  label: string;
  supportMediaType: string[];
  supportReasoning: boolean;
  forceReasoningEnabled?: boolean;
  description?: string;
}
