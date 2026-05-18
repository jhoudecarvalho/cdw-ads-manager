import { useState, useMemo, useCallback } from "react";
import _ from "lodash";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
} from "recharts";

// ============================================================
// DATA LAYER — Simulated API responses (Google Ads + Meta Ads)
// ============================================================

const REGIONS = ["Sul", "Sudeste", "Centro-Oeste", "Nordeste", "Norte"];
const STATES = {
  Sul: ["PR", "SC", "RS"],
  Sudeste: ["SP", "RJ", "MG", "ES"],
  "Centro-Oeste": ["GO", "DF", "MT", "MS"],
  Nordeste: ["BA", "PE", "CE", "MA", "PB", "RN", "PI", "AL", "SE"],
  Norte: ["AM", "PA", "TO", "RO", "AC", "RR", "AP"],
};

const CAMPAIGN_TYPES_GOOGLE = [
  "Search",
  "Display",
  "Performance Max",
  "Shopping",
  "Video",
  "Demand Gen",
];
const CAMPAIGN_TYPES_META = [
  "Conversões",
  "Tráfego",
  "Reconhecimento",
  "Engajamento",
  "Leads",
  "Vendas do Catálogo",
];
const CAMPAIGN_STATUS = ["Ativa", "Pausada", "Finalizada"];

const generateId = () => Math.random().toString(36).substr(2, 9);

const generateFranchises = () => {
  const franchises = [];
  let id = 1;
  REGIONS.forEach((region) => {
    const states = STATES[region];
    const perState = Math.ceil(60 / states.length);
    states.forEach((state) => {
      for (let i = 0; i < perState && franchises.length < 312; i++) {
        franchises.push({
          id: `FRQ-${String(id).padStart(4, "0")}`,
          name: `Franquia ${state}-${String(i + 1).padStart(3, "0")}`,
          state,
          region,
          city: `Cidade ${i + 1}`,
          active: Math.random() > 0.05,
        });
        id++;
      }
    });
  });
  return franchises;
};

const generateCampaigns = (franchises) => {
  const campaigns = [];
  franchises.forEach((f) => {
    const numGoogle = Math.floor(Math.random() * 4) + 1;
    const numMeta = Math.floor(Math.random() * 4) + 1;
    for (let i = 0; i < numGoogle; i++) {
      const spend = Math.random() * 8000 + 500;
      const impressions = Math.floor(spend * (Math.random() * 150 + 50));
      const clicks = Math.floor(impressions * (Math.random() * 0.06 + 0.01));
      const conversions = Math.floor(clicks * (Math.random() * 0.12 + 0.01));
      const convValue = conversions * (Math.random() * 120 + 20);
      campaigns.push({
        id: generateId(),
        franchiseId: f.id,
        platform: "Google Ads",
        type: CAMPAIGN_TYPES_GOOGLE[
          Math.floor(Math.random() * CAMPAIGN_TYPES_GOOGLE.length)
        ],
        name: `G_${f.state}_${CAMPAIGN_TYPES_GOOGLE[i % CAMPAIGN_TYPES_GOOGLE.length]}_${i + 1}`,
        status: CAMPAIGN_STATUS[Math.floor(Math.random() * 3)],
        spend,
        impressions,
        clicks,
        ctr: clicks / impressions,
        cpc: spend / clicks,
        cpm: (spend / impressions) * 1000,
        conversions,
        conversionRate: conversions / clicks,
        conversionValue: convValue,
        roas: convValue / spend,
        costPerConversion: spend / (conversions || 1),
        reach: Math.floor(impressions * (Math.random() * 0.7 + 0.3)),
        frequency: +(Math.random() * 3 + 1).toFixed(2),
        qualityScore: Math.floor(Math.random() * 5) + 5,
        impressionShare: +(Math.random() * 0.6 + 0.2).toFixed(2),
        bounceRate: +(Math.random() * 0.5 + 0.2).toFixed(2),
        avgSessionDuration: Math.floor(Math.random() * 180 + 30),
        viewThroughConv: Math.floor(Math.random() * 20),
        searchImprShare: +(Math.random() * 0.5 + 0.3).toFixed(2),
        invalidClicks: Math.floor(clicks * Math.random() * 0.03),
      });
    }
    for (let i = 0; i < numMeta; i++) {
      const spend = Math.random() * 6000 + 300;
      const impressions = Math.floor(spend * (Math.random() * 200 + 80));
      const reach = Math.floor(impressions * (Math.random() * 0.6 + 0.3));
      const clicks = Math.floor(impressions * (Math.random() * 0.04 + 0.005));
      const linkClicks = Math.floor(clicks * (Math.random() * 0.7 + 0.2));
      const conversions = Math.floor(linkClicks * (Math.random() * 0.1 + 0.01));
      const purchaseValue = conversions * (Math.random() * 100 + 15);
      campaigns.push({
        id: generateId(),
        franchiseId: f.id,
        platform: "Meta Ads",
        type: CAMPAIGN_TYPES_META[
          Math.floor(Math.random() * CAMPAIGN_TYPES_META.length)
        ],
        name: `M_${f.state}_${CAMPAIGN_TYPES_META[i % CAMPAIGN_TYPES_META.length]}_${i + 1}`,
        status: CAMPAIGN_STATUS[Math.floor(Math.random() * 3)],
        spend,
        impressions,
        clicks,
        ctr: clicks / impressions,
        cpc: spend / clicks,
        cpm: (spend / impressions) * 1000,
        conversions,
        conversionRate: conversions / (linkClicks || 1),
        conversionValue: purchaseValue,
        roas: purchaseValue / spend,
        costPerConversion: spend / (conversions || 1),
        reach,
        frequency: +(impressions / (reach || 1)).toFixed(2),
        linkClicks,
        linkCtr: linkClicks / impressions,
        engagement: Math.floor(Math.random() * 5000 + 200),
        videoViews: Math.floor(Math.random() * 10000),
        videoThruPlay: Math.floor(Math.random() * 5000),
        leads: Math.floor(Math.random() * 50),
        costPerLead: +(spend / (Math.floor(Math.random() * 50) || 1)).toFixed(
          2,
        ),
        socialImpressions: Math.floor(Math.random() * 3000),
        postEngagement: Math.floor(Math.random() * 2000 + 100),
      });
    }
  });
  return campaigns;
};

const generateDailyData = () => {
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      googleSpend: Math.random() * 15000 + 5000,
      metaSpend: Math.random() * 12000 + 4000,
      googleConv: Math.floor(Math.random() * 300 + 50),
      metaConv: Math.floor(Math.random() * 250 + 40),
      googleImpressions: Math.floor(Math.random() * 500000 + 100000),
      metaImpressions: Math.floor(Math.random() * 600000 + 150000),
      googleClicks: Math.floor(Math.random() * 8000 + 1000),
      metaClicks: Math.floor(Math.random() * 7000 + 800),
    });
  }
  return data;
};

const FRANCHISES = generateFranchises();
const ALL_CAMPAIGNS = generateCampaigns(FRANCHISES);
const DAILY_DATA = generateDailyData();

// ============================================================
// ROLE SYSTEM
// ============================================================
const ROLES = {
  ADMIN: { label: "Administrador (Matriz)", level: 0, icon: "👑" },
  REGIONAL: { label: "Gestor Regional", level: 1, icon: "🗺️" },
  FRANCHISE: { label: "Franqueado", level: 2, icon: "🏪" },
};

// ============================================================
// HELPERS
// ============================================================
const fmt = (n, dec = 0) => {
  if (n === undefined || n === null || isNaN(n)) return "0";
  return Number(n).toLocaleString("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
};
const fmtCurrency = (n) => `R$ ${fmt(n, 2)}`;
const fmtPct = (n) => `${fmt(n * 100, 2)}%`;

const COLORS = {
  bg: "#0a0e17",
  surface: "#111827",
  surfaceAlt: "#1a2236",
  border: "#1e293b",
  borderLight: "#2a3a52",
  text: "#e2e8f0",
  textMuted: "#8896ab",
  accent: "#22d3ee",
  accentAlt: "#a78bfa",
  google: "#4285f4",
  googleLight: "#669df6",
  meta: "#0668E1",
  metaLight: "#3b82f6",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
  chart: [
    "#22d3ee",
    "#a78bfa",
    "#34d399",
    "#fbbf24",
    "#f87171",
    "#fb923c",
    "#e879f9",
    "#38bdf8",
  ],
};

// ============================================================
// COMPONENTS
// ============================================================

const KpiCard = ({ label, value, subValue, icon, color, trend }) => (
  <div
    style={{
      background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceAlt} 100%)`,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 14,
      padding: "18px 20px",
      minWidth: 0,
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: -8,
        right: -8,
        fontSize: 48,
        opacity: 0.06,
      }}
    >
      {icon}
    </div>
    <div
      style={{
        fontSize: 11,
        color: COLORS.textMuted,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: 6,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 24,
        fontWeight: 800,
        color: color || COLORS.text,
        fontFamily: "'Space Grotesk', sans-serif",
        lineHeight: 1.1,
      }}
    >
      {value}
    </div>
    {subValue && (
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
        {subValue}
      </div>
    )}
    {trend !== undefined && (
      <div
        style={{
          fontSize: 11,
          marginTop: 4,
          color: trend >= 0 ? COLORS.success : COLORS.danger,
          fontWeight: 600,
        }}
      >
        {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
      </div>
    )}
  </div>
);

const MiniTable = ({ columns, data, maxRows = 10 }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              style={{
                textAlign: c.align || "left",
                padding: "8px 10px",
                color: COLORS.textMuted,
                borderBottom: `1px solid ${COLORS.border}`,
                fontWeight: 600,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 1,
                whiteSpace: "nowrap",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.slice(0, maxRows).map((row, i) => (
          <tr
            key={i}
            style={{
              background:
                i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
            }}
          >
            {columns.map((c) => (
              <td
                key={c.key}
                style={{
                  padding: "7px 10px",
                  color: COLORS.text,
                  borderBottom: `1px solid ${COLORS.border}`,
                  whiteSpace: "nowrap",
                  textAlign: c.align || "left",
                }}
              >
                {c.render ? c.render(row[c.key], row) : row[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const TabGroup = ({ tabs, active, onChange }) => (
  <div
    style={{
      display: "flex",
      gap: 2,
      background: COLORS.surface,
      borderRadius: 10,
      padding: 3,
      border: `1px solid ${COLORS.border}`,
    }}
  >
    {tabs.map((t) => (
      <button
        key={t.key}
        onClick={() => onChange(t.key)}
        style={{
          padding: "7px 16px",
          border: "none",
          borderRadius: 8,
          background: active === t.key ? COLORS.accent : "transparent",
          color: active === t.key ? COLORS.bg : COLORS.textMuted,
          fontWeight: 700,
          fontSize: 12,
          cursor: "pointer",
          transition: "all .2s",
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        {t.label}
      </button>
    ))}
  </div>
);

const Badge = ({ text, color }) => (
  <span
    style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 10,
      fontWeight: 700,
      background: `${color}22`,
      color,
      letterSpacing: 0.5,
    }}
  >
    {text}
  </span>
);

const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 16, marginTop: 8 }}>
    <h3
      style={{
        fontSize: 16,
        fontWeight: 800,
        color: COLORS.text,
        margin: 0,
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {children}
    </h3>
    {sub && (
      <p style={{ fontSize: 11, color: COLORS.textMuted, margin: "2px 0 0" }}>
        {sub}
      </p>
    )}
  </div>
);

const ChartCard = ({ title, children, height = 280 }) => (
  <div
    style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 14,
      padding: 20,
      marginBottom: 16,
    }}
  >
    {title && (
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: COLORS.text,
          marginBottom: 12,
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        {title}
      </div>
    )}
    <div style={{ height }}>{children}</div>
  </div>
);

const StatusDot = ({ status }) => {
  const c =
    status === "Ativa"
      ? COLORS.success
      : status === "Pausada"
        ? COLORS.warning
        : COLORS.textMuted;
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: c,
        marginRight: 6,
      }}
    />
  );
};

// ============================================================
// SUBMENU SYSTEM
// ============================================================

const SUBMENUS = [
  { key: "overview", label: "Visão Geral", icon: "📊" },
  { key: "google", label: "Google Ads", icon: "🔍" },
  { key: "meta", label: "Meta Ads", icon: "📱" },
  { key: "campaigns", label: "Campanhas", icon: "📋" },
  { key: "franchises", label: "Franquias", icon: "🏪" },
  { key: "regions", label: "Regiões", icon: "🗺️" },
  { key: "performance", label: "Performance", icon: "⚡" },
  { key: "financial", label: "Financeiro", icon: "💰" },
  { key: "comparison", label: "Comparativo", icon: "⚖️" },
];

// ============================================================
// MAIN APP
// ============================================================

export default function FranchiseAdsDashboard() {
  const [role, setRole] = useState("ADMIN");
  const [submenu, setSubmenu] = useState("overview");
  const [selectedRegion, setSelectedRegion] = useState("Todas");
  const [selectedFranchise, setSelectedFranchise] = useState("Todas");
  const [platformFilter, setPlatformFilter] = useState("Todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adsOpen, setAdsOpen] = useState(true);
  const [activeMenu, setActiveMenu] = useState("ads");

  // Filtered data based on role & filters
  const filteredCampaigns = useMemo(() => {
    let camps = [...ALL_CAMPAIGNS];
    if (platformFilter !== "Todas")
      camps = camps.filter((c) => c.platform === platformFilter);
    if (selectedRegion !== "Todas") {
      const regionFranchises = FRANCHISES.filter(
        (f) => f.region === selectedRegion,
      ).map((f) => f.id);
      camps = camps.filter((c) => regionFranchises.includes(c.franchiseId));
    }
    if (selectedFranchise !== "Todas")
      camps = camps.filter((c) => c.franchiseId === selectedFranchise);
    if (searchTerm)
      camps = camps.filter((c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    return camps;
  }, [platformFilter, selectedRegion, selectedFranchise, searchTerm]);

  const metrics = useMemo(() => {
    const m = {
      totalSpend: _.sumBy(filteredCampaigns, "spend"),
      totalImpressions: _.sumBy(filteredCampaigns, "impressions"),
      totalClicks: _.sumBy(filteredCampaigns, "clicks"),
      totalConversions: _.sumBy(filteredCampaigns, "conversions"),
      totalConvValue: _.sumBy(filteredCampaigns, "conversionValue"),
      totalReach: _.sumBy(filteredCampaigns, "reach"),
      totalCampaigns: filteredCampaigns.length,
      activeCampaigns: filteredCampaigns.filter((c) => c.status === "Ativa")
        .length,
    };
    m.avgCtr = m.totalClicks / (m.totalImpressions || 1);
    m.avgCpc = m.totalSpend / (m.totalClicks || 1);
    m.avgCpm = (m.totalSpend / (m.totalImpressions || 1)) * 1000;
    m.avgConvRate = m.totalConversions / (m.totalClicks || 1);
    m.roas = m.totalConvValue / (m.totalSpend || 1);
    m.costPerConv = m.totalSpend / (m.totalConversions || 1);
    m.avgFrequency = _.meanBy(filteredCampaigns, "frequency") || 0;

    // Platform split
    const google = filteredCampaigns.filter((c) => c.platform === "Google Ads");
    const meta = filteredCampaigns.filter((c) => c.platform === "Meta Ads");
    m.googleSpend = _.sumBy(google, "spend");
    m.metaSpend = _.sumBy(meta, "spend");
    m.googleConv = _.sumBy(google, "conversions");
    m.metaConv = _.sumBy(meta, "conversions");
    m.googleClicks = _.sumBy(google, "clicks");
    m.metaClicks = _.sumBy(meta, "clicks");
    m.googleImpressions = _.sumBy(google, "impressions");
    m.metaImpressions = _.sumBy(meta, "impressions");
    m.googleRoas = _.sumBy(google, "conversionValue") / (m.googleSpend || 1);
    m.metaRoas = _.sumBy(meta, "conversionValue") / (m.metaSpend || 1);

    // Meta specific
    m.metaLeads = _.sumBy(meta, "leads") || 0;
    m.metaVideoViews = _.sumBy(meta, "videoViews") || 0;
    m.metaEngagement = _.sumBy(meta, "engagement") || 0;
    m.metaLinkClicks = _.sumBy(meta, "linkClicks") || 0;
    m.metaReach = _.sumBy(meta, "reach") || 0;

    return m;
  }, [filteredCampaigns]);

  // Region breakdown
  const regionData = useMemo(() => {
    return REGIONS.map((r) => {
      const rFranchises = FRANCHISES.filter((f) => f.region === r).map(
        (f) => f.id,
      );
      const rCamps = filteredCampaigns.filter((c) =>
        rFranchises.includes(c.franchiseId),
      );
      return {
        region: r,
        spend: _.sumBy(rCamps, "spend"),
        conversions: _.sumBy(rCamps, "conversions"),
        clicks: _.sumBy(rCamps, "clicks"),
        impressions: _.sumBy(rCamps, "impressions"),
        roas:
          _.sumBy(rCamps, "conversionValue") / (_.sumBy(rCamps, "spend") || 1),
        franchises: rFranchises.length,
        campaigns: rCamps.length,
      };
    });
  }, [filteredCampaigns]);

  // Top franchises
  const topFranchises = useMemo(() => {
    const grouped = _.groupBy(filteredCampaigns, "franchiseId");
    return Object.entries(grouped)
      .map(([fId, camps]) => {
        const franchise = FRANCHISES.find((f) => f.id === fId);
        const google = camps.filter((c) => c.platform === "Google Ads");
        const meta = camps.filter((c) => c.platform === "Meta Ads");
        const totalSpend = _.sumBy(camps, "spend");
        const totalClicks = _.sumBy(camps, "clicks");
        const totalImpressions = _.sumBy(camps, "impressions");
        const totalConversions = _.sumBy(camps, "conversions");
        const totalConvValue = _.sumBy(camps, "conversionValue");
        const totalReach = _.sumBy(camps, "reach");
        return {
          id: fId,
          name: franchise?.name || fId,
          state: franchise?.state,
          region: franchise?.region,
          active: franchise?.active,
          spend: totalSpend,
          impressions: totalImpressions,
          clicks: totalClicks,
          conversions: totalConversions,
          convValue: totalConvValue,
          roas: totalConvValue / (totalSpend || 1),
          ctr: totalClicks / (totalImpressions || 1),
          cpc: totalSpend / (totalClicks || 1),
          cpm: (totalSpend / (totalImpressions || 1)) * 1000,
          costPerConv: totalSpend / (totalConversions || 1),
          convRate: totalConversions / (totalClicks || 1),
          reach: totalReach,
          frequency: _.meanBy(camps, "frequency") || 0,
          campaigns: camps.length,
          activeCampaigns: camps.filter((c) => c.status === "Ativa").length,
          googleSpend: _.sumBy(google, "spend"),
          metaSpend: _.sumBy(meta, "spend"),
          googleConv: _.sumBy(google, "conversions"),
          metaConv: _.sumBy(meta, "conversions"),
          googleCamps: google.length,
          metaCamps: meta.length,
          leads: _.sumBy(meta, "leads") || 0,
          engagement: _.sumBy(meta, "engagement") || 0,
        };
      })
      .sort((a, b) => b.roas - a.roas);
  }, [filteredCampaigns]);

  // Campaign type distribution
  const typeDistribution = useMemo(() => {
    const grouped = _.groupBy(filteredCampaigns, "type");
    return Object.entries(grouped)
      .map(([type, camps]) => ({
        name: type,
        value: _.sumBy(camps, "spend"),
        campaigns: camps.length,
        conversions: _.sumBy(camps, "conversions"),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredCampaigns]);

  const tooltipStyle = {
    contentStyle: {
      background: COLORS.surfaceAlt,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 10,
      fontSize: 11,
      color: COLORS.text,
    },
    labelStyle: { color: COLORS.textMuted },
  };

  // ============================================================
  // RENDER SECTIONS
  // ============================================================

  const renderOverview = () => (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="Investimento Total"
          value={fmtCurrency(metrics.totalSpend)}
          icon="💰"
          color={COLORS.accent}
          trend={12.4}
          subValue={`${fmt(metrics.totalCampaigns)} campanhas`}
        />
        <KpiCard
          label="Impressões"
          value={fmt(metrics.totalImpressions)}
          icon="👁"
          color={COLORS.accentAlt}
          trend={8.2}
        />
        <KpiCard
          label="Cliques"
          value={fmt(metrics.totalClicks)}
          icon="🖱"
          color={COLORS.google}
          trend={5.7}
        />
        <KpiCard
          label="Conversões"
          value={fmt(metrics.totalConversions)}
          icon="🎯"
          color={COLORS.success}
          trend={15.3}
        />
        <KpiCard
          label="Receita Ads"
          value={fmtCurrency(metrics.totalConvValue)}
          icon="📈"
          color={COLORS.warning}
          trend={18.1}
        />
        <KpiCard
          label="ROAS Geral"
          value={`${fmt(metrics.roas, 2)}x`}
          icon="⚡"
          color={metrics.roas >= 3 ? COLORS.success : COLORS.warning}
        />
        <KpiCard
          label="CTR Médio"
          value={fmtPct(metrics.avgCtr)}
          icon="📊"
          color={COLORS.accent}
        />
        <KpiCard
          label="CPC Médio"
          value={fmtCurrency(metrics.avgCpc)}
          icon="💳"
          color={COLORS.metaLight}
        />
        <KpiCard
          label="CPM Médio"
          value={fmtCurrency(metrics.avgCpm)}
          icon="📢"
          color={COLORS.accentAlt}
        />
        <KpiCard
          label="Custo/Conv"
          value={fmtCurrency(metrics.costPerConv)}
          icon="🏷"
          color={COLORS.danger}
        />
        <KpiCard
          label="Alcance Total"
          value={fmt(metrics.totalReach)}
          icon="🌐"
          color={COLORS.google}
        />
        <KpiCard
          label="Frequência Média"
          value={fmt(metrics.avgFrequency, 2)}
          icon="🔄"
          color={COLORS.textMuted}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <ChartCard title="📈 Investimento Diário (30 dias)" height={260}>
          <ResponsiveContainer>
            <AreaChart data={DAILY_DATA}>
              <defs>
                <linearGradient id="gGoogle" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={COLORS.google}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS.google}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="gMeta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.meta} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.meta} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="date" stroke={COLORS.textMuted} fontSize={10} />
              <YAxis
                stroke={COLORS.textMuted}
                fontSize={10}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip {...tooltipStyle} formatter={(v) => fmtCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="googleSpend"
                name="Google Ads"
                stroke={COLORS.google}
                fill="url(#gGoogle)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="metaSpend"
                name="Meta Ads"
                stroke={COLORS.meta}
                fill="url(#gMeta)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="💰 Split Investimento" height={260}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={[
                  { name: "Google Ads", value: metrics.googleSpend },
                  { name: "Meta Ads", value: metrics.metaSpend },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
                style={{ fontSize: 10 }}
              >
                <Cell fill={COLORS.google} />
                <Cell fill={COLORS.meta} />
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v) => fmtCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ChartCard title="🎯 Conversões Diárias" height={220}>
          <ResponsiveContainer>
            <BarChart data={DAILY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="date" stroke={COLORS.textMuted} fontSize={10} />
              <YAxis stroke={COLORS.textMuted} fontSize={10} />
              <Tooltip {...tooltipStyle} />
              <Bar
                dataKey="googleConv"
                name="Google"
                fill={COLORS.google}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="metaConv"
                name="Meta"
                fill={COLORS.meta}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="🗺️ Performance por Região" height={220}>
          <ResponsiveContainer>
            <RadarChart data={regionData}>
              <PolarGrid stroke={COLORS.border} />
              <PolarAngleAxis
                dataKey="region"
                stroke={COLORS.textMuted}
                fontSize={10}
              />
              <PolarRadiusAxis stroke={COLORS.border} fontSize={9} />
              <Radar
                name="Conversões"
                dataKey="conversions"
                stroke={COLORS.accent}
                fill={COLORS.accent}
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Tooltip {...tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );

  const renderGoogleAds = () => {
    const google = filteredCampaigns.filter((c) => c.platform === "Google Ads");
    const byType = _.groupBy(google, "type");
    const typeData = Object.entries(byType).map(([t, c]) => ({
      name: t,
      spend: _.sumBy(c, "spend"),
      clicks: _.sumBy(c, "clicks"),
      conversions: _.sumBy(c, "conversions"),
      roas: _.sumBy(c, "conversionValue") / (_.sumBy(c, "spend") || 1),
    }));

    return (
      <>
        <SectionTitle sub="Métricas da API do Google Ads — impressions, clicks, cost_micros, conversions, conversions_value, ctr, average_cpc, search_impression_share">
          🔍 Google Ads — Dashboard Completo
        </SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <KpiCard
            label="Investimento"
            value={fmtCurrency(metrics.googleSpend)}
            icon="💰"
            color={COLORS.google}
          />
          <KpiCard
            label="Impressões"
            value={fmt(metrics.googleImpressions)}
            icon="👁"
            color={COLORS.googleLight}
          />
          <KpiCard
            label="Cliques"
            value={fmt(metrics.googleClicks)}
            icon="🖱"
            color={COLORS.accent}
          />
          <KpiCard
            label="Conversões"
            value={fmt(metrics.googleConv)}
            icon="🎯"
            color={COLORS.success}
          />
          <KpiCard
            label="ROAS"
            value={`${fmt(metrics.googleRoas, 2)}x`}
            icon="⚡"
            color={COLORS.warning}
          />
          <KpiCard
            label="CTR"
            value={fmtPct(
              metrics.googleClicks / (metrics.googleImpressions || 1),
            )}
            icon="📊"
            color={COLORS.accentAlt}
          />
          <KpiCard
            label="CPC Médio"
            value={fmtCurrency(
              metrics.googleSpend / (metrics.googleClicks || 1),
            )}
            icon="💳"
            color={COLORS.meta}
          />
          <KpiCard
            label="Quality Score Médio"
            value={fmt(_.meanBy(google, "qualityScore"), 1)}
            icon="⭐"
            color={COLORS.warning}
          />
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <ChartCard title="Performance por Tipo de Campanha" height={250}>
            <ResponsiveContainer>
              <BarChart data={typeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis
                  type="number"
                  stroke={COLORS.textMuted}
                  fontSize={10}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke={COLORS.textMuted}
                  fontSize={10}
                  width={100}
                />
                <Tooltip {...tooltipStyle} formatter={(v) => fmtCurrency(v)} />
                <Bar
                  dataKey="spend"
                  fill={COLORS.google}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="ROAS por Tipo" height={250}>
            <ResponsiveContainer>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis
                  dataKey="name"
                  stroke={COLORS.textMuted}
                  fontSize={9}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis stroke={COLORS.textMuted} fontSize={10} />
                <Tooltip {...tooltipStyle} />
                <Bar
                  dataKey="roas"
                  name="ROAS"
                  fill={COLORS.accent}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div style={{ marginTop: 16 }}>
          <SectionTitle sub="Todas as campanhas Google Ads com métricas detalhadas">
            Campanhas Google Ads
          </SectionTitle>
          <MiniTable
            columns={[
              { key: "name", label: "Campanha" },
              { key: "type", label: "Tipo" },
              {
                key: "status",
                label: "Status",
                render: (v) => (
                  <>
                    <StatusDot status={v} />
                    {v}
                  </>
                ),
              },
              {
                key: "spend",
                label: "Custo",
                align: "right",
                render: (v) => fmtCurrency(v),
              },
              {
                key: "impressions",
                label: "Impressões",
                align: "right",
                render: (v) => fmt(v),
              },
              {
                key: "clicks",
                label: "Cliques",
                align: "right",
                render: (v) => fmt(v),
              },
              {
                key: "ctr",
                label: "CTR",
                align: "right",
                render: (v) => fmtPct(v),
              },
              {
                key: "conversions",
                label: "Conv.",
                align: "right",
                render: (v) => fmt(v),
              },
              {
                key: "roas",
                label: "ROAS",
                align: "right",
                render: (v) => (
                  <Badge
                    text={`${fmt(v, 2)}x`}
                    color={
                      v >= 3
                        ? COLORS.success
                        : v >= 1
                          ? COLORS.warning
                          : COLORS.danger
                    }
                  />
                ),
              },
              { key: "qualityScore", label: "QS", align: "center" },
            ]}
            data={google.sort((a, b) => b.spend - a.spend)}
            maxRows={15}
          />
        </div>
      </>
    );
  };

  const renderMetaAds = () => {
    const meta = filteredCampaigns.filter((c) => c.platform === "Meta Ads");
    const byType = _.groupBy(meta, "type");
    const typeData = Object.entries(byType).map(([t, c]) => ({
      name: t,
      spend: _.sumBy(c, "spend"),
      reach: _.sumBy(c, "reach"),
      conversions: _.sumBy(c, "conversions"),
      engagement: _.sumBy(c, "engagement"),
      leads: _.sumBy(c, "leads"),
    }));

    return (
      <>
        <SectionTitle sub="Métricas da Meta Marketing API — impressions, reach, frequency, clicks, link_clicks, spend, cpm, cpc, actions, action_values, video_views, leads">
          📱 Meta Ads — Dashboard Completo
        </SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <KpiCard
            label="Investimento"
            value={fmtCurrency(metrics.metaSpend)}
            icon="💰"
            color={COLORS.meta}
          />
          <KpiCard
            label="Alcance"
            value={fmt(metrics.metaReach)}
            icon="🌐"
            color={COLORS.metaLight}
          />
          <KpiCard
            label="Impressões"
            value={fmt(metrics.metaImpressions)}
            icon="👁"
            color={COLORS.accent}
          />
          <KpiCard
            label="Cliques no Link"
            value={fmt(metrics.metaLinkClicks)}
            icon="🔗"
            color={COLORS.success}
          />
          <KpiCard
            label="Conversões"
            value={fmt(metrics.metaConv)}
            icon="🎯"
            color={COLORS.warning}
          />
          <KpiCard
            label="ROAS"
            value={`${fmt(metrics.metaRoas, 2)}x`}
            icon="⚡"
            color={COLORS.accentAlt}
          />
          <KpiCard
            label="Leads"
            value={fmt(metrics.metaLeads)}
            icon="📋"
            color={COLORS.google}
          />
          <KpiCard
            label="Visualizações Vídeo"
            value={fmt(metrics.metaVideoViews)}
            icon="🎬"
            color={COLORS.danger}
          />
          <KpiCard
            label="Engajamento"
            value={fmt(metrics.metaEngagement)}
            icon="❤️"
            color={COLORS.accent}
          />
          <KpiCard
            label="CPM"
            value={fmtCurrency(
              (metrics.metaSpend / (metrics.metaImpressions || 1)) * 1000,
            )}
            icon="📢"
            color={COLORS.textMuted}
          />
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <ChartCard title="Investimento por Objetivo" height={250}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="spend"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                  style={{ fontSize: 9 }}
                >
                  {typeData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS.chart[i % COLORS.chart.length]}
                    />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v) => fmtCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Leads + Engajamento por Objetivo" height={250}>
            <ResponsiveContainer>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis
                  dataKey="name"
                  stroke={COLORS.textMuted}
                  fontSize={9}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis stroke={COLORS.textMuted} fontSize={10} />
                <Tooltip {...tooltipStyle} />
                <Bar
                  dataKey="leads"
                  name="Leads"
                  fill={COLORS.accent}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="engagement"
                  name="Engajamento"
                  fill={COLORS.accentAlt}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div style={{ marginTop: 16 }}>
          <SectionTitle>Campanhas Meta Ads</SectionTitle>
          <MiniTable
            columns={[
              { key: "name", label: "Campanha" },
              { key: "type", label: "Objetivo" },
              {
                key: "status",
                label: "Status",
                render: (v) => (
                  <>
                    <StatusDot status={v} />
                    {v}
                  </>
                ),
              },
              {
                key: "spend",
                label: "Custo",
                align: "right",
                render: (v) => fmtCurrency(v),
              },
              {
                key: "reach",
                label: "Alcance",
                align: "right",
                render: (v) => fmt(v),
              },
              {
                key: "clicks",
                label: "Cliques",
                align: "right",
                render: (v) => fmt(v),
              },
              {
                key: "linkClicks",
                label: "Link Clicks",
                align: "right",
                render: (v) => fmt(v || 0),
              },
              {
                key: "conversions",
                label: "Conv.",
                align: "right",
                render: (v) => fmt(v),
              },
              {
                key: "roas",
                label: "ROAS",
                align: "right",
                render: (v) => (
                  <Badge
                    text={`${fmt(v, 2)}x`}
                    color={
                      v >= 3
                        ? COLORS.success
                        : v >= 1
                          ? COLORS.warning
                          : COLORS.danger
                    }
                  />
                ),
              },
              {
                key: "leads",
                label: "Leads",
                align: "right",
                render: (v) => fmt(v || 0),
              },
            ]}
            data={meta.sort((a, b) => b.spend - a.spend)}
            maxRows={15}
          />
        </div>
      </>
    );
  };

  const renderCampaigns = () => (
    <>
      <SectionTitle
        sub={`${filteredCampaigns.length} campanhas encontradas — Google Ads + Meta Ads`}
      >
        📋 Todas as Campanhas
      </SectionTitle>
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Buscar campanha..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 400,
            padding: "8px 14px",
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceAlt,
            color: COLORS.text,
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>
      <MiniTable
        columns={[
          {
            key: "platform",
            label: "Plataforma",
            render: (v) => (
              <Badge
                text={v}
                color={v === "Google Ads" ? COLORS.google : COLORS.meta}
              />
            ),
          },
          { key: "name", label: "Campanha" },
          { key: "type", label: "Tipo" },
          {
            key: "status",
            label: "Status",
            render: (v) => (
              <>
                <StatusDot status={v} />
                {v}
              </>
            ),
          },
          {
            key: "spend",
            label: "Custo",
            align: "right",
            render: (v) => fmtCurrency(v),
          },
          {
            key: "impressions",
            label: "Impr.",
            align: "right",
            render: (v) => fmt(v),
          },
          {
            key: "clicks",
            label: "Cliques",
            align: "right",
            render: (v) => fmt(v),
          },
          {
            key: "ctr",
            label: "CTR",
            align: "right",
            render: (v) => fmtPct(v),
          },
          {
            key: "conversions",
            label: "Conv.",
            align: "right",
            render: (v) => fmt(v),
          },
          {
            key: "roas",
            label: "ROAS",
            align: "right",
            render: (v) => (
              <Badge
                text={`${fmt(v, 2)}x`}
                color={
                  v >= 3
                    ? COLORS.success
                    : v >= 1
                      ? COLORS.warning
                      : COLORS.danger
                }
              />
            ),
          },
          {
            key: "costPerConversion",
            label: "CPA",
            align: "right",
            render: (v) => fmtCurrency(v),
          },
        ]}
        data={filteredCampaigns.sort((a, b) => b.spend - a.spend)}
        maxRows={20}
      />
    </>
  );

  const [franchisePage, setFranchisePage] = useState(0);
  const [franchiseSearch, setFranchiseSearch] = useState("");
  const [expandedFranchise, setExpandedFranchise] = useState(null);
  const CARDS_PER_PAGE = 12;

  const filteredTopFranchises = useMemo(() => {
    if (!franchiseSearch) return topFranchises;
    return topFranchises.filter(
      (f) =>
        f.name.toLowerCase().includes(franchiseSearch.toLowerCase()) ||
        f.id.toLowerCase().includes(franchiseSearch.toLowerCase()) ||
        f.state?.toLowerCase().includes(franchiseSearch.toLowerCase()) ||
        f.region?.toLowerCase().includes(franchiseSearch.toLowerCase()),
    );
  }, [topFranchises, franchiseSearch]);

  const pagedFranchises = filteredTopFranchises.slice(
    franchisePage * CARDS_PER_PAGE,
    (franchisePage + 1) * CARDS_PER_PAGE,
  );
  const totalPages = Math.ceil(filteredTopFranchises.length / CARDS_PER_PAGE);

  const RoasBar = ({ value, max = 8 }) => {
    const pct = Math.min((value / max) * 100, 100);
    const color =
      value >= 4 ? COLORS.success : value >= 2 ? COLORS.warning : COLORS.danger;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: `${COLORS.border}`,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: 3,
              background: color,
              transition: "width .4s",
            }}
          />
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color,
            minWidth: 36,
            textAlign: "right",
          }}
        >
          {fmt(value, 2)}x
        </span>
      </div>
    );
  };

  const PlatformSplit = ({ googleVal, metaVal, label }) => {
    const total = googleVal + metaVal;
    const gPct = total > 0 ? (googleVal / total) * 100 : 50;
    return (
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 9,
            color: COLORS.textMuted,
            marginBottom: 3,
          }}
        >
          <span>Google {gPct.toFixed(0)}%</span>
          <span style={{ fontWeight: 600, color: COLORS.text }}>{label}</span>
          <span>Meta {(100 - gPct).toFixed(0)}%</span>
        </div>
        <div
          style={{
            display: "flex",
            height: 5,
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${gPct}%`,
              background: COLORS.google,
              transition: "width .3s",
            }}
          />
          <div
            style={{
              width: `${100 - gPct}%`,
              background: COLORS.meta,
              transition: "width .3s",
            }}
          />
        </div>
      </div>
    );
  };

  const FranchiseCard = ({ f, rank }) => {
    const isExpanded = expandedFranchise === f.id;
    const roasColor =
      f.roas >= 4
        ? COLORS.success
        : f.roas >= 2
          ? COLORS.warning
          : COLORS.danger;
    return (
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceAlt} 100%)`,
          border: `1px solid ${isExpanded ? COLORS.accent + "60" : COLORS.border}`,
          borderRadius: 14,
          overflow: "hidden",
          transition: "all .2s",
          cursor: "pointer",
          boxShadow: isExpanded ? `0 0 20px ${COLORS.accent}10` : "none",
        }}
        onClick={() => setExpandedFranchise(isExpanded ? null : f.id)}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 16px 10px",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              flexShrink: 0,
              background: `linear-gradient(135deg, ${roasColor}30, ${roasColor}10)`,
              border: `1px solid ${roasColor}40`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: roasColor,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            #{rank}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: COLORS.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {f.name}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
              <Badge text={f.id} color={COLORS.textMuted} />
              <Badge
                text={`${f.state} · ${f.region}`}
                color={COLORS.accentAlt}
              />
              <Badge
                text={`${f.activeCampaigns}/${f.campaigns} ativas`}
                color={f.activeCampaigns > 0 ? COLORS.success : COLORS.danger}
              />
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              color: COLORS.textMuted,
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform .2s",
            }}
          >
            ▼
          </span>
        </div>

        {/* KPIs Grid */}
        <div
          style={{
            padding: "0 16px 12px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
          }}
        >
          {[
            {
              label: "Investimento",
              value: fmtCurrency(f.spend),
              color: COLORS.accent,
            },
            {
              label: "Receita Ads",
              value: fmtCurrency(f.convValue),
              color: COLORS.success,
            },
            { label: "ROAS", value: `${fmt(f.roas, 2)}x`, color: roasColor },
            {
              label: "Conversões",
              value: fmt(f.conversions),
              color: COLORS.warning,
            },
            { label: "Cliques", value: fmt(f.clicks), color: COLORS.google },
            { label: "CTR", value: fmtPct(f.ctr), color: COLORS.metaLight },
          ].map((kpi) => (
            <div
              key={kpi.label}
              style={{
                background: `${kpi.color}08`,
                borderRadius: 8,
                padding: "8px 10px",
                border: `1px solid ${kpi.color}15`,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: COLORS.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  marginBottom: 2,
                }}
              >
                {kpi.label}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: kpi.color,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* ROAS Bar */}
        <div style={{ padding: "0 16px 12px" }}>
          <RoasBar value={f.roas} />
        </div>

        {/* Platform Split */}
        <div style={{ padding: "0 16px 14px" }}>
          <PlatformSplit
            googleVal={f.googleSpend}
            metaVal={f.metaSpend}
            label="Investimento"
          />
          <PlatformSplit
            googleVal={f.googleConv}
            metaVal={f.metaConv}
            label="Conversões"
          />
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div
            style={{
              borderTop: `1px solid ${COLORS.border}`,
              padding: 16,
              background: `${COLORS.bg}80`,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {[
                { label: "CPC Médio", value: fmtCurrency(f.cpc) },
                { label: "CPM", value: fmtCurrency(f.cpm) },
                { label: "Custo/Conv", value: fmtCurrency(f.costPerConv) },
                { label: "Taxa Conv.", value: fmtPct(f.convRate) },
                { label: "Impressões", value: fmt(f.impressions) },
                { label: "Alcance", value: fmt(f.reach) },
                { label: "Frequência", value: fmt(f.frequency, 2) },
                { label: "Leads (Meta)", value: fmt(f.leads) },
                { label: "Engajamento", value: fmt(f.engagement) },
                { label: "Google Camps", value: f.googleCamps },
                { label: "Meta Camps", value: f.metaCamps },
                {
                  label: "Lucro Ads",
                  value: fmtCurrency(f.convValue - f.spend),
                },
              ].map((item) => (
                <div key={item.label} style={{ padding: "6px 0" }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: COLORS.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: COLORS.text,
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Mini campaign list */}
            <div
              style={{
                fontSize: 10,
                color: COLORS.textMuted,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
                fontWeight: 700,
              }}
            >
              Campanhas desta Franquia
            </div>
            <div style={{ maxHeight: 180, overflowY: "auto" }}>
              {filteredCampaigns
                .filter((c) => c.franchiseId === f.id)
                .sort((a, b) => b.spend - a.spend)
                .map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.02)",
                      marginBottom: 2,
                      fontSize: 11,
                    }}
                  >
                    <StatusDot status={c.status} />
                    <Badge
                      text={c.platform === "Google Ads" ? "G" : "M"}
                      color={
                        c.platform === "Google Ads"
                          ? COLORS.google
                          : COLORS.meta
                      }
                    />
                    <span
                      style={{
                        flex: 1,
                        color: COLORS.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.name}
                    </span>
                    <span
                      style={{
                        color: COLORS.textMuted,
                        minWidth: 70,
                        textAlign: "right",
                      }}
                    >
                      {fmtCurrency(c.spend)}
                    </span>
                    <Badge
                      text={`${fmt(c.roas, 1)}x`}
                      color={
                        c.roas >= 3
                          ? COLORS.success
                          : c.roas >= 1
                            ? COLORS.warning
                            : COLORS.danger
                      }
                    />
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFranchises = () => (
    <>
      <SectionTitle
        sub={`${filteredTopFranchises.length} franquias · Ranking por ROAS · Clique no card para expandir detalhes`}
      >
        🏪 Visão por Franquia
      </SectionTitle>

      {/* Summary KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <KpiCard
          label="Total Franquias"
          value={fmt(filteredTopFranchises.length)}
          icon="🏪"
          color={COLORS.accent}
        />
        <KpiCard
          label="Investimento Total"
          value={fmtCurrency(_.sumBy(filteredTopFranchises, "spend"))}
          icon="💰"
          color={COLORS.warning}
        />
        <KpiCard
          label="ROAS Médio"
          value={`${fmt(_.meanBy(filteredTopFranchises, "roas"), 2)}x`}
          icon="⚡"
          color={COLORS.success}
        />
        <KpiCard
          label="Melhor ROAS"
          value={`${filteredTopFranchises[0] ? fmt(filteredTopFranchises[0].roas, 2) : 0}x`}
          subValue={filteredTopFranchises[0]?.name}
          icon="🏆"
          color={COLORS.accentAlt}
        />
        <KpiCard
          label="Total Conversões"
          value={fmt(_.sumBy(filteredTopFranchises, "conversions"))}
          icon="🎯"
          color={COLORS.google}
        />
        <KpiCard
          label="Total Campanhas"
          value={fmt(_.sumBy(filteredTopFranchises, "campaigns"))}
          icon="📋"
          color={COLORS.metaLight}
        />
      </div>

      {/* Search + Pagination */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <input
          type="text"
          placeholder="Buscar franquia por nome, ID, UF ou região..."
          value={franchiseSearch}
          onChange={(e) => {
            setFranchiseSearch(e.target.value);
            setFranchisePage(0);
          }}
          style={{
            flex: 1,
            minWidth: 250,
            maxWidth: 420,
            padding: "9px 14px",
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceAlt,
            color: COLORS.text,
            fontSize: 12,
            outline: "none",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setFranchisePage(Math.max(0, franchisePage - 1))}
            disabled={franchisePage === 0}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surfaceAlt,
              color: franchisePage === 0 ? COLORS.textMuted : COLORS.text,
              cursor: franchisePage === 0 ? "default" : "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ◀
          </button>
          <span
            style={{
              fontSize: 11,
              color: COLORS.textMuted,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {franchisePage + 1} / {totalPages || 1}
          </span>
          <button
            onClick={() =>
              setFranchisePage(Math.min(totalPages - 1, franchisePage + 1))
            }
            disabled={franchisePage >= totalPages - 1}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surfaceAlt,
              color:
                franchisePage >= totalPages - 1
                  ? COLORS.textMuted
                  : COLORS.text,
              cursor: franchisePage >= totalPages - 1 ? "default" : "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ▶
          </button>
        </div>
      </div>

      {/* Franchise Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 14,
        }}
      >
        {pagedFranchises.map((f, i) => (
          <FranchiseCard
            key={f.id}
            f={f}
            rank={franchisePage * CARDS_PER_PAGE + i + 1}
          />
        ))}
      </div>

      {pagedFranchises.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: COLORS.textMuted,
            fontSize: 14,
          }}
        >
          Nenhuma franquia encontrada para "{franchiseSearch}"
        </div>
      )}
    </>
  );

  const renderRegions = () => (
    <>
      <SectionTitle sub="Comparativo de performance entre as 5 regiões do Brasil">
        🗺️ Análise Regional
      </SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {regionData.map((r) => (
          <div
            key={r.region}
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: COLORS.text,
                marginBottom: 8,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {r.region}
            </div>
            <div
              style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}
            >
              {r.franchises} franquias · {r.campaigns} campanhas
            </div>
            <div style={{ fontSize: 11, color: COLORS.text }}>
              Invest: <b>{fmtCurrency(r.spend)}</b>
            </div>
            <div style={{ fontSize: 11, color: COLORS.text }}>
              Conv: <b>{fmt(r.conversions)}</b>
            </div>
            <div style={{ fontSize: 11, color: COLORS.text }}>
              ROAS:{" "}
              <Badge
                text={`${fmt(r.roas, 2)}x`}
                color={r.roas >= 3 ? COLORS.success : COLORS.warning}
              />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ChartCard title="Investimento por Região" height={250}>
          <ResponsiveContainer>
            <BarChart data={regionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="region" stroke={COLORS.textMuted} fontSize={11} />
              <YAxis
                stroke={COLORS.textMuted}
                fontSize={10}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip {...tooltipStyle} formatter={(v) => fmtCurrency(v)} />
              <Bar dataKey="spend" fill={COLORS.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="ROAS por Região" height={250}>
          <ResponsiveContainer>
            <BarChart data={regionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="region" stroke={COLORS.textMuted} fontSize={11} />
              <YAxis stroke={COLORS.textMuted} fontSize={10} />
              <Tooltip {...tooltipStyle} />
              <Bar
                dataKey="roas"
                fill={COLORS.accentAlt}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );

  const renderPerformance = () => (
    <>
      <SectionTitle sub="Indicadores avançados de performance de campanhas">
        ⚡ Análise de Performance
      </SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="Taxa de Conversão"
          value={fmtPct(metrics.avgConvRate)}
          icon="🎯"
          color={COLORS.success}
        />
        <KpiCard
          label="Custo por Conversão"
          value={fmtCurrency(metrics.costPerConv)}
          icon="🏷"
          color={COLORS.danger}
        />
        <KpiCard
          label="Campanhas Ativas"
          value={`${metrics.activeCampaigns} / ${metrics.totalCampaigns}`}
          icon="✅"
          color={COLORS.accent}
        />
        <KpiCard
          label="Receita/Clique"
          value={fmtCurrency(
            metrics.totalConvValue / (metrics.totalClicks || 1),
          )}
          icon="💎"
          color={COLORS.warning}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ChartCard title="Cliques Diários" height={220}>
          <ResponsiveContainer>
            <LineChart data={DAILY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="date" stroke={COLORS.textMuted} fontSize={10} />
              <YAxis stroke={COLORS.textMuted} fontSize={10} />
              <Tooltip {...tooltipStyle} />
              <Line
                type="monotone"
                dataKey="googleClicks"
                name="Google"
                stroke={COLORS.google}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="metaClicks"
                name="Meta"
                stroke={COLORS.meta}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Distribuição por Tipo de Campanha" height={220}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={typeDistribution.slice(0, 8)}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name.slice(0, 12)} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
                style={{ fontSize: 8 }}
              >
                {typeDistribution.slice(0, 8).map((_, i) => (
                  <Cell key={i} fill={COLORS.chart[i % COLORS.chart.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v) => fmtCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );

  const renderFinancial = () => (
    <>
      <SectionTitle sub="Análise financeira detalhada — custos, receita, margens e retorno">
        💰 Painel Financeiro
      </SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="Custo Total"
          value={fmtCurrency(metrics.totalSpend)}
          icon="💸"
          color={COLORS.danger}
        />
        <KpiCard
          label="Receita Ads"
          value={fmtCurrency(metrics.totalConvValue)}
          icon="💰"
          color={COLORS.success}
        />
        <KpiCard
          label="Lucro Bruto Ads"
          value={fmtCurrency(metrics.totalConvValue - metrics.totalSpend)}
          icon="📈"
          color={
            metrics.totalConvValue > metrics.totalSpend
              ? COLORS.success
              : COLORS.danger
          }
        />
        <KpiCard
          label="Margem"
          value={fmtPct(
            (metrics.totalConvValue - metrics.totalSpend) /
              (metrics.totalConvValue || 1),
          )}
          icon="📊"
          color={COLORS.accentAlt}
        />
        <KpiCard
          label="Google Ads"
          value={fmtCurrency(metrics.googleSpend)}
          subValue={`ROAS ${fmt(metrics.googleRoas, 2)}x`}
          icon="🔍"
          color={COLORS.google}
        />
        <KpiCard
          label="Meta Ads"
          value={fmtCurrency(metrics.metaSpend)}
          subValue={`ROAS ${fmt(metrics.metaRoas, 2)}x`}
          icon="📱"
          color={COLORS.meta}
        />
        <KpiCard
          label="Custo/Dia (média)"
          value={fmtCurrency(metrics.totalSpend / 30)}
          icon="📅"
          color={COLORS.textMuted}
        />
        <KpiCard
          label="Receita/Dia (média)"
          value={fmtCurrency(metrics.totalConvValue / 30)}
          icon="🌟"
          color={COLORS.warning}
        />
      </div>
      <ChartCard title="Investimento vs Receita (30 dias)" height={280}>
        <ResponsiveContainer>
          <ComposedChart
            data={DAILY_DATA.map((d) => ({
              ...d,
              totalSpend: d.googleSpend + d.metaSpend,
              totalRevenue:
                (d.googleConv + d.metaConv) * (Math.random() * 50 + 30),
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey="date" stroke={COLORS.textMuted} fontSize={10} />
            <YAxis
              stroke={COLORS.textMuted}
              fontSize={10}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip {...tooltipStyle} formatter={(v) => fmtCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="totalSpend"
              name="Investimento"
              fill={COLORS.danger}
              opacity={0.6}
              radius={[3, 3, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="totalRevenue"
              name="Receita"
              stroke={COLORS.success}
              strokeWidth={2.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );

  const renderComparison = () => (
    <>
      <SectionTitle sub="Comparação direta entre Google Ads e Meta Ads">
        ⚖️ Comparativo de Plataformas
      </SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {[
          {
            label: "Investimento",
            g: fmtCurrency(metrics.googleSpend),
            m: fmtCurrency(metrics.metaSpend),
          },
          {
            label: "Impressões",
            g: fmt(metrics.googleImpressions),
            m: fmt(metrics.metaImpressions),
          },
          {
            label: "Cliques",
            g: fmt(metrics.googleClicks),
            m: fmt(metrics.metaClicks),
          },
          {
            label: "Conversões",
            g: fmt(metrics.googleConv),
            m: fmt(metrics.metaConv),
          },
          {
            label: "ROAS",
            g: `${fmt(metrics.googleRoas, 2)}x`,
            m: `${fmt(metrics.metaRoas, 2)}x`,
          },
          {
            label: "CPC",
            g: fmtCurrency(metrics.googleSpend / (metrics.googleClicks || 1)),
            m: fmtCurrency(metrics.metaSpend / (metrics.metaClicks || 1)),
          },
          {
            label: "CPM",
            g: fmtCurrency(
              (metrics.googleSpend / (metrics.googleImpressions || 1)) * 1000,
            ),
            m: fmtCurrency(
              (metrics.metaSpend / (metrics.metaImpressions || 1)) * 1000,
            ),
          },
          {
            label: "CTR",
            g: fmtPct(metrics.googleClicks / (metrics.googleImpressions || 1)),
            m: fmtPct(metrics.metaClicks / (metrics.metaImpressions || 1)),
          },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: 10,
              alignItems: "center",
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: "10px 16px",
            }}
          >
            <div style={{ textAlign: "right" }}>
              <div
                style={{ fontSize: 14, fontWeight: 700, color: COLORS.google }}
              >
                {row.g}
              </div>
              <div style={{ fontSize: 9, color: COLORS.textMuted }}>
                Google Ads
              </div>
            </div>
            <div
              style={{
                fontSize: 10,
                color: COLORS.textMuted,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 1,
                textAlign: "center",
                minWidth: 80,
              }}
            >
              {row.label}
            </div>
            <div style={{ textAlign: "left" }}>
              <div
                style={{ fontSize: 14, fontWeight: 700, color: COLORS.meta }}
              >
                {row.m}
              </div>
              <div style={{ fontSize: 9, color: COLORS.textMuted }}>
                Meta Ads
              </div>
            </div>
          </div>
        ))}
      </div>
      <ChartCard title="Impressões Diárias — Google vs Meta" height={240}>
        <ResponsiveContainer>
          <AreaChart data={DAILY_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey="date" stroke={COLORS.textMuted} fontSize={10} />
            <YAxis
              stroke={COLORS.textMuted}
              fontSize={10}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip {...tooltipStyle} formatter={(v) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="googleImpressions"
              name="Google"
              stroke={COLORS.google}
              fill={COLORS.google}
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="metaImpressions"
              name="Meta"
              stroke={COLORS.meta}
              fill={COLORS.meta}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );

  const renderComingSoon = (title, icon, description) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 400,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 64, marginBottom: 16 }}>{icon}</div>
      <h2
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: COLORS.text,
          marginBottom: 8,
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: 14,
          color: COLORS.textMuted,
          maxWidth: 440,
          lineHeight: 1.6,
          marginBottom: 20,
        }}
      >
        {description}
      </p>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 24px",
          borderRadius: 10,
          background: `${COLORS.warning}15`,
          border: `1px solid ${COLORS.warning}40`,
          color: COLORS.warning,
          fontWeight: 700,
          fontSize: 13,
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        🚧 Em desenvolvimento — disponível em breve
      </div>
    </div>
  );

  const renderContent = () => {
    if (activeMenu === "ecocentauro")
      return renderComingSoon(
        "Dados Ecocentauro",
        "🦎",
        "Integração com os dados do sistema Ecocentauro. Acompanhe métricas operacionais, relatórios e indicadores diretamente no Franchise HUB.",
      );
    if (activeMenu === "indicacao")
      return renderComingSoon(
        "Programa de Indicação",
        "🤝",
        "Gerencie o programa de indicações das franquias. Acompanhe leads indicados, conversões, comissões e ranking dos melhores indicadores da rede.",
      );
    if (activeMenu === "pipedrive")
      return renderComingSoon(
        "Sellflux",
        "🔄",
        "Integração completa com o Sellflux. Visualize o funil de vendas, deals em aberto, atividades e performance comercial de cada franquia.",
      );
    if (activeMenu === "landingpage")
      return renderComingSoon(
        "Landing Page",
        "🌐",
        "Gerencie e monitore as landing pages de cada franquia. Acompanhe taxas de conversão, testes A/B, formulários e performance de cada página de destino.",
      );

    switch (submenu) {
      case "overview":
        return renderOverview();
      case "google":
        return renderGoogleAds();
      case "meta":
        return renderMetaAds();
      case "campaigns":
        return renderCampaigns();
      case "franchises":
        return renderFranchises();
      case "regions":
        return renderRegions();
      case "performance":
        return renderPerformance();
      case "financial":
        return renderFinancial();
      case "comparison":
        return renderComparison();
      default:
        return renderOverview();
    }
  };

  return (
    <div
      style={{
        fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
        background: COLORS.bg,
        color: COLORS.text,
        minHeight: "100vh",
        display: "flex",
        fontSize: 13,
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      {/* SIDEBAR */}
      <div
        style={{
          width: sidebarOpen ? 240 : 60,
          minHeight: "100vh",
          background: `linear-gradient(180deg, ${COLORS.surface} 0%, #0d1220 100%)`,
          borderRight: `1px solid ${COLORS.border}`,
          transition: "width .3s",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Logo area */}
        <div
          style={{
            padding: sidebarOpen ? "20px 16px 12px" : "20px 8px 12px",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
            }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentAlt})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 800,
                color: COLORS.bg,
                flexShrink: 0,
              }}
            >
              F
            </div>
            {sidebarOpen && (
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: COLORS.text,
                    lineHeight: 1.1,
                  }}
                >
                  Franchise HUB
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: COLORS.textMuted,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                  }}
                >
                  Painel Integrado
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Menu Items */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: sidebarOpen ? "12px 8px" : "12px 4px",
          }}
        >
          {/* CAMPANHAS ADS — expandable */}
          <button
            onClick={() => setAdsOpen(!adsOpen)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: sidebarOpen ? "10px 12px" : "10px 0",
              justifyContent: sidebarOpen ? "flex-start" : "center",
              border: "none",
              borderRadius: 8,
              background: adsOpen ? `${COLORS.accent}12` : "transparent",
              color: COLORS.accent,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: 2,
              transition: "all .15s",
            }}
          >
            <span style={{ fontSize: 16 }}>📣</span>
            {sidebarOpen && (
              <>
                <span style={{ flex: 1, textAlign: "left" }}>
                  Campanhas Ads
                </span>
                <span
                  style={{
                    fontSize: 10,
                    transition: "transform .2s",
                    transform: adsOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  ▼
                </span>
              </>
            )}
          </button>

          {/* Submenus de Campanhas Ads */}
          {adsOpen && (
            <div style={{ paddingLeft: sidebarOpen ? 12 : 0, marginBottom: 8 }}>
              {SUBMENUS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    setSubmenu(s.key);
                    setActiveMenu("ads");
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: sidebarOpen ? "8px 12px" : "8px 0",
                    justifyContent: sidebarOpen ? "flex-start" : "center",
                    border: "none",
                    borderRadius: 8,
                    background:
                      submenu === s.key && activeMenu === "ads"
                        ? `${COLORS.accent}18`
                        : "transparent",
                    color:
                      submenu === s.key && activeMenu === "ads"
                        ? COLORS.accent
                        : COLORS.textMuted,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight:
                      submenu === s.key && activeMenu === "ads" ? 700 : 500,
                    transition: "all .15s",
                    marginBottom: 1,
                    fontFamily: "'Space Grotesk', sans-serif",
                    borderLeft:
                      submenu === s.key && activeMenu === "ads"
                        ? `3px solid ${COLORS.accent}`
                        : "3px solid transparent",
                  }}
                >
                  <span style={{ fontSize: 13 }}>{s.icon}</span>
                  {sidebarOpen && s.label}
                </button>
              ))}
            </div>
          )}

          {/* SEPARATOR */}
          <div
            style={{ height: 1, background: COLORS.border, margin: "8px 8px" }}
          />

          {/* DADOS ECOCENTAURO — BREVE */}
          <button
            onClick={() => setActiveMenu("ecocentauro")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: sidebarOpen ? "10px 12px" : "10px 0",
              justifyContent: sidebarOpen ? "flex-start" : "center",
              border: "none",
              borderRadius: 8,
              background:
                activeMenu === "ecocentauro"
                  ? `${COLORS.accentAlt}18`
                  : "transparent",
              color:
                activeMenu === "ecocentauro"
                  ? COLORS.accentAlt
                  : COLORS.textMuted,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: 2,
              transition: "all .15s",
              opacity: 0.7,
            }}
          >
            <span style={{ fontSize: 16 }}>🦎</span>
            {sidebarOpen && (
              <>
                <span style={{ flex: 1, textAlign: "left" }}>
                  Dados Ecocentauro
                </span>
                <span
                  style={{
                    fontSize: 8,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: `${COLORS.warning}25`,
                    color: COLORS.warning,
                    fontWeight: 800,
                    letterSpacing: 0.8,
                  }}
                >
                  BREVE
                </span>
              </>
            )}
          </button>

          {/* PROGRAMA INDICAÇÃO — BREVE */}
          <button
            onClick={() => setActiveMenu("indicacao")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: sidebarOpen ? "10px 12px" : "10px 0",
              justifyContent: sidebarOpen ? "flex-start" : "center",
              border: "none",
              borderRadius: 8,
              background:
                activeMenu === "indicacao"
                  ? `${COLORS.accentAlt}18`
                  : "transparent",
              color:
                activeMenu === "indicacao"
                  ? COLORS.accentAlt
                  : COLORS.textMuted,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: 2,
              transition: "all .15s",
              opacity: 0.7,
            }}
          >
            <span style={{ fontSize: 16 }}>🤝</span>
            {sidebarOpen && (
              <>
                <span style={{ flex: 1, textAlign: "left" }}>
                  Programa Indicação
                </span>
                <span
                  style={{
                    fontSize: 8,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: `${COLORS.warning}25`,
                    color: COLORS.warning,
                    fontWeight: 800,
                    letterSpacing: 0.8,
                  }}
                >
                  BREVE
                </span>
              </>
            )}
          </button>

          {/* PIPEDRIVE — BREVE */}
          <button
            onClick={() => setActiveMenu("pipedrive")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: sidebarOpen ? "10px 12px" : "10px 0",
              justifyContent: sidebarOpen ? "flex-start" : "center",
              border: "none",
              borderRadius: 8,
              background:
                activeMenu === "pipedrive"
                  ? `${COLORS.accentAlt}18`
                  : "transparent",
              color:
                activeMenu === "pipedrive"
                  ? COLORS.accentAlt
                  : COLORS.textMuted,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: 2,
              transition: "all .15s",
              opacity: 0.7,
            }}
          >
            <span style={{ fontSize: 16 }}>🔄</span>
            {sidebarOpen && (
              <>
                <span style={{ flex: 1, textAlign: "left" }}>Sellflux</span>
                <span
                  style={{
                    fontSize: 8,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: `${COLORS.warning}25`,
                    color: COLORS.warning,
                    fontWeight: 800,
                    letterSpacing: 0.8,
                  }}
                >
                  BREVE
                </span>
              </>
            )}
          </button>

          {/* LANDING PAGE — BREVE */}
          <button
            onClick={() => setActiveMenu("landingpage")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: sidebarOpen ? "10px 12px" : "10px 0",
              justifyContent: sidebarOpen ? "flex-start" : "center",
              border: "none",
              borderRadius: 8,
              background:
                activeMenu === "landingpage"
                  ? `${COLORS.accentAlt}18`
                  : "transparent",
              color:
                activeMenu === "landingpage"
                  ? COLORS.accentAlt
                  : COLORS.textMuted,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: 2,
              transition: "all .15s",
              opacity: 0.7,
            }}
          >
            <span style={{ fontSize: 16 }}>🌐</span>
            {sidebarOpen && (
              <>
                <span style={{ flex: 1, textAlign: "left" }}>Landing Page</span>
                <span
                  style={{
                    fontSize: 8,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: `${COLORS.warning}25`,
                    color: COLORS.warning,
                    fontWeight: 800,
                    letterSpacing: 0.8,
                  }}
                >
                  BREVE
                </span>
              </>
            )}
          </button>
        </div>
        {sidebarOpen && (
          <div
            style={{
              padding: "12px 14px",
              borderTop: `1px solid ${COLORS.border}`,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: COLORS.textMuted,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                marginBottom: 6,
              }}
            >
              Nível de Acesso
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surfaceAlt,
                color: COLORS.text,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {Object.entries(ROLES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        {/* TOP BAR */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 24px",
            borderBottom: `1px solid ${COLORS.border}`,
            background: `${COLORS.surface}cc`,
            backdropFilter: "blur(10px)",
            position: "sticky",
            top: 0,
            zIndex: 10,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {activeMenu === "ads" && (
                <>
                  {SUBMENUS.find((s) => s.key === submenu)?.icon}{" "}
                  {SUBMENUS.find((s) => s.key === submenu)?.label}
                </>
              )}
              {activeMenu === "ecocentauro" && <>🦎 Dados Ecocentauro</>}
              {activeMenu === "indicacao" && <>🤝 Programa Indicação</>}
              {activeMenu === "pipedrive" && <>🔄 Sellflux</>}
              {activeMenu === "landingpage" && <>🌐 Landing Page</>}
            </div>
            <Badge
              text={`${ROLES[role].icon} ${ROLES[role].label}`}
              color={COLORS.accent}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {/* Filters */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surfaceAlt,
                color: COLORS.text,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              <option value="Todas">Todas Plataformas</option>
              <option value="Google Ads">Google Ads</option>
              <option value="Meta Ads">Meta Ads</option>
            </select>

            {(role === "ADMIN" || role === "REGIONAL") && (
              <select
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  setSelectedFranchise("Todas");
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.surfaceAlt,
                  color: COLORS.text,
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                <option value="Todas">Todas Regiões</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}

            {role === "ADMIN" && (
              <select
                value={selectedFranchise}
                onChange={(e) => setSelectedFranchise(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.surfaceAlt,
                  color: COLORS.text,
                  fontSize: 11,
                  cursor: "pointer",
                  maxWidth: 180,
                }}
              >
                <option value="Todas">Todas Franquias</option>
                {FRANCHISES.filter(
                  (f) =>
                    selectedRegion === "Todas" || f.region === selectedRegion,
                )
                  .slice(0, 50)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ padding: 24 }}>
          {renderContent()}

          {/* API INFO FOOTER */}
          <div
            style={{
              marginTop: 32,
              padding: 16,
              background: COLORS.surfaceAlt,
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              fontSize: 10,
              color: COLORS.textMuted,
              lineHeight: 1.6,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: COLORS.accent,
                marginBottom: 6,
                fontSize: 11,
              }}
            >
              🔌 Franchise HUB — Integrações de API
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <b style={{ color: COLORS.google }}>Google Ads API v23</b> —
                metrics.impressions, metrics.clicks, metrics.cost_micros,
                metrics.conversions, metrics.conversions_value, metrics.ctr,
                metrics.average_cpc, metrics.average_cpm,
                metrics.cost_per_conversion, metrics.search_impression_share,
                metrics.interaction_rate, metrics.invalid_clicks,
                metrics.video_views, campaign.id, campaign.name,
                campaign.status, campaign.advertising_channel_type,
                segments.date, segments.device, segments.ad_network_type
              </div>
              <div>
                <b style={{ color: COLORS.meta }}>Meta Marketing API v25</b> —
                impressions, reach, frequency, clicks, link_clicks, ctr, spend,
                cpm, cpc, actions, action_values, conversions,
                cost_per_action_type, video_views,
                video_thruplay_watched_actions, leads, cost_per_lead,
                engagement, social_impressions, post_engagement, campaign_id,
                campaign_name, objective, status — Breakdowns: age, gender,
                country, region, placement, device_platform
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
