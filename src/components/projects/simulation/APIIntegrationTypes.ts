// Phase 9: API Integration Types

// External SCADA Systems
export interface ScadaConnection {
  id: string;
  name: string;
  vendor: 'schneider' | 'siemens' | 'abb' | 'honeywell' | 'generic';
  apiEndpoint: string;
  authType: 'apiKey' | 'oauth2' | 'basic';
  isActive: boolean;
  lastSync: string | null;
  syncInterval: number; // minutes
  meterMappings: ScadaMeterMapping[];
}

export interface ScadaMeterMapping {
  scadaMeterId: string;
  localMeterId: string;
  scaleFactor: number;
}

export interface ScadaConfig {
  enabled: boolean;
  connections: ScadaConnection[];
  realtimeStreaming: boolean;
  autoProfileUpdate: boolean;
  syncOnStartup: boolean;
}

// CRM Integration
export interface CRMConnection {
  provider: 'salesforce' | 'hubspot' | 'zoho' | 'pipedrive';
  isConnected: boolean;
  lastSync: string | null;
  syncDirection: 'bidirectional' | 'crm-to-app' | 'app-to-crm';
}

export interface CRMFieldMapping {
  crmField: string;
  localField: string;
  syncEnabled: boolean;
}

export interface CRMConfig {
  enabled: boolean;
  connection: CRMConnection | null;
  opportunitySync: boolean;
  contactSync: boolean;
  companySync: boolean;
  autoProposalCreation: boolean;
  fieldMappings: CRMFieldMapping[];
  syncInterval: number; // minutes
}

// Automated Report Scheduling
export interface ReportSchedule {
  id: string;
  name: string;
  reportType: 'simulation' | 'portfolio' | 'performance' | 'financial';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM format
  timezone: string;
  format: 'pdf' | 'excel' | 'both';
  recipients: string[];
  projectIds: string[];
  isActive: boolean;
  lastRun: string | null;
  nextRun: string | null;
}

export interface ReportTemplate {
  id: string;
  name: string;
  sections: string[];
  includeCharts: boolean;
  includeRawData: boolean;
  customBranding: boolean;
}

export interface ReportSchedulingConfig {
  enabled: boolean;
  schedules: ReportSchedule[];
  templates: ReportTemplate[];
  defaultRecipients: string[];
  smtpConfigured: boolean;
}

// Webhook Notifications
export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  secretKey: string;
  retryPolicy: 'none' | 'exponential' | 'linear';
  maxRetries: number;
  lastTriggered: string | null;
  failureCount: number;
}

export type WebhookEvent = 
  | 'simulation.completed'
  | 'simulation.failed'
  | 'proposal.created'
  | 'proposal.approved'
  | 'proposal.signed'
  | 'project.created'
  | 'project.updated'
  | 'meter.data.received'
  | 'report.generated';

export interface SlackIntegration {
  enabled: boolean;
  webhookUrl: string;
  channel: string;
  events: WebhookEvent[];
}

export interface TeamsIntegration {
  enabled: boolean;
  webhookUrl: string;
  events: WebhookEvent[];
}

export interface DiscordIntegration {
  enabled: boolean;
  webhookUrl: string;
  events: WebhookEvent[];
}

export interface WebhookConfig {
  enabled: boolean;
  endpoints: WebhookEndpoint[];
  slack: SlackIntegration;
  teams: TeamsIntegration;
  discord: DiscordIntegration;
  globalRetryPolicy: 'none' | 'exponential' | 'linear';
  logRetention: number; // days
}

// Combined API Integration Config
export interface APIIntegrationConfig {
  scada: ScadaConfig;
  crm: CRMConfig;
  reportScheduling: ReportSchedulingConfig;
  webhooks: WebhookConfig;
}

// Default configurations
export const defaultScadaConfig: ScadaConfig = {
  enabled: false,
  connections: [],
  realtimeStreaming: false,
  autoProfileUpdate: true,
  syncOnStartup: true,
};

export const defaultCRMConfig: CRMConfig = {
  enabled: false,
  connection: null,
  opportunitySync: true,
  contactSync: true,
  companySync: true,
  autoProposalCreation: false,
  fieldMappings: [],
  syncInterval: 60,
};

export const defaultReportSchedulingConfig: ReportSchedulingConfig = {
  enabled: false,
  schedules: [],
  templates: [],
  defaultRecipients: [],
  smtpConfigured: false,
};

export const defaultWebhookConfig: WebhookConfig = {
  enabled: false,
  endpoints: [],
  slack: { enabled: false, webhookUrl: '', channel: '#notifications', events: [] },
  teams: { enabled: false, webhookUrl: '', events: [] },
  discord: { enabled: false, webhookUrl: '', events: [] },
  globalRetryPolicy: 'exponential',
  logRetention: 30,
};

export const defaultAPIIntegrationConfig: APIIntegrationConfig = {
  scada: defaultScadaConfig,
  crm: defaultCRMConfig,
  reportScheduling: defaultReportSchedulingConfig,
  webhooks: defaultWebhookConfig,
};
