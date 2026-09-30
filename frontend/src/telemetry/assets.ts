export interface AssetMetadata {
  assetId: string;
  displayName: string;
  location: string;
}

export const ASSET_METADATA: Record<
  string,
  AssetMetadata
> = {
  ARRAY_01: {
    assetId: "ARRAY_01",
    displayName: "Carport — Rear Row",
    location: "Ground Field / Carport",
  },

  ARRAY_02: {
    assetId: "ARRAY_02",
    displayName: "Carport — Center Row",
    location: "Ground Field / Carport",
  },

  ARRAY_03: {
    assetId: "ARRAY_03",
    displayName: "Carport — Front Row",
    location: "Ground Field / Carport",
  },

  ARRAY_04: {
    assetId: "ARRAY_04",
    displayName: "Main Building Rooftop",
    location: "Rooftop / Main Building",
  },

  ARRAY_05: {
    assetId: "ARRAY_05",
    displayName: "Annex — Front Right",
    location: "Ground Field / Annex",
  },

  ARRAY_06: {
    assetId: "ARRAY_06",
    displayName: "Upper Facility Rooftop",
    location: "Rooftop / Upper Facility",
  },
};
