export interface ListingLimits {
  // How many listings can be created
  cap: number;
  // How many listings are currently created
  used: number;
  // How many listings can be promoted
  promoted: number;
  // When the limits were last updated
  updatedAt: number;
}
