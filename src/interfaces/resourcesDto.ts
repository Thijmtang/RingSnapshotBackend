import { DonutChartCell } from "./DonutChartCell.js";
import { MediaDetails } from "./MediaDetails.js";
import { RingSubscriptionMoneySaved } from "./RingSubscriptionSaved.js";

export interface ResourcesDTO {
  storageSpaceUsedToday: DonutChartCell[];
  mediaDetails: MediaDetails;
  financeDetails: RingSubscriptionMoneySaved;
}
