import { featuresEncoder } from "./features.ts";
import { flatEncoder } from "./flat.ts";
import type { Encoder } from "./types.ts";

export const ENCODERS: Record<string, Encoder> = {
  flat: flatEncoder,
  features: featuresEncoder,
};

export const DEFAULT_ENCODER = "flat";
