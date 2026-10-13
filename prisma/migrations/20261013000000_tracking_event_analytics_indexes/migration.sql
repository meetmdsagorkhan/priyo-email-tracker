CREATE INDEX "tracking_event_campaign_timestamp_idx"
ON "TrackingEvent"("campaignId", "timestamp");

CREATE INDEX "tracking_event_campaign_recipient_idx"
ON "TrackingEvent"("campaignId", "eventType", "campaignRecipientId");

CREATE INDEX "tracking_event_campaign_link_idx"
ON "TrackingEvent"("campaignId", "eventType", "campaignLinkId");
