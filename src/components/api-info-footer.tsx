/**
 * Footer "API info" — referência rápida dos endpoints e campos que os
 * providers (Google Ads API v23 + Meta Marketing API v25) consomem. Útil
 * para devs sabendo de onde vem cada métrica, e para reviews/conformidade.
 *
 * Exibido no rodapé das telas de Campanhas Ads.
 */
export function ApiInfoFooter() {
  return (
    <div className="mt-8 rounded-[10px] border border-border bg-surface-alt p-4 text-[10px] leading-[1.6] text-text-muted">
      <div className="mb-1.5 text-[11px] font-bold text-accent">
        🔌 Franchise HUB — Integrações de API
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <b className="text-google">Google Ads API v23</b> —
          metrics.impressions, metrics.clicks, metrics.cost_micros,
          metrics.conversions, metrics.conversions_value, metrics.ctr,
          metrics.average_cpc, metrics.average_cpm, metrics.cost_per_conversion,
          metrics.search_impression_share, metrics.interaction_rate,
          metrics.invalid_clicks, metrics.video_views, campaign.id,
          campaign.name, campaign.status, campaign.advertising_channel_type,
          segments.date, segments.device, segments.ad_network_type
        </div>
        <div>
          <b className="text-meta">Meta Marketing API v25</b> — impressions,
          reach, frequency, clicks, link_clicks, ctr, spend, cpm, cpc, actions,
          action_values, conversions, cost_per_action_type, video_views,
          video_thruplay_watched_actions, leads, cost_per_lead, engagement,
          social_impressions, post_engagement, campaign_id, campaign_name,
          objective, status — Breakdowns: age, gender, country, region,
          placement, device_platform
        </div>
      </div>
    </div>
  );
}
