import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Database, 
  Users, 
  Calendar, 
  Bell, 
  Plus, 
  Trash2, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Slack,
  MessageSquare
} from "lucide-react";
import {
  APIIntegrationConfig as APIConfig,
  defaultAPIIntegrationConfig,
  WebhookEvent,
} from "./APIIntegrationTypes";

interface APIIntegrationConfigProps {
  config: APIConfig;
  onChange: (config: APIConfig) => void;
}

const webhookEvents: { value: WebhookEvent; label: string }[] = [
  { value: 'simulation.completed', label: 'Simulation Completed' },
  { value: 'simulation.failed', label: 'Simulation Failed' },
  { value: 'proposal.created', label: 'Proposal Created' },
  { value: 'proposal.approved', label: 'Proposal Approved' },
  { value: 'proposal.signed', label: 'Proposal Signed' },
  { value: 'project.created', label: 'Project Created' },
  { value: 'project.updated', label: 'Project Updated' },
  { value: 'meter.data.received', label: 'Meter Data Received' },
  { value: 'report.generated', label: 'Report Generated' },
];

export function APIIntegrationConfigPanel({ config, onChange }: APIIntegrationConfigProps) {
  const [activeTab, setActiveTab] = useState("scada");

  const updateScada = (updates: Partial<typeof config.scada>) => {
    onChange({ ...config, scada: { ...config.scada, ...updates } });
  };

  const updateCRM = (updates: Partial<typeof config.crm>) => {
    onChange({ ...config, crm: { ...config.crm, ...updates } });
  };

  const updateReporting = (updates: Partial<typeof config.reportScheduling>) => {
    onChange({ ...config, reportScheduling: { ...config.reportScheduling, ...updates } });
  };

  const updateWebhooks = (updates: Partial<typeof config.webhooks>) => {
    onChange({ ...config, webhooks: { ...config.webhooks, ...updates } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          API Integrations
        </CardTitle>
        <CardDescription>
          Connect external systems, automate workflows, and enable notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="scada" className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              <span className="hidden sm:inline">SCADA</span>
            </TabsTrigger>
            <TabsTrigger value="crm" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span className="hidden sm:inline">CRM</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-1">
              <Bell className="h-3 w-3" />
              <span className="hidden sm:inline">Webhooks</span>
            </TabsTrigger>
          </TabsList>

          {/* SCADA Integration */}
          <TabsContent value="scada" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">External SCADA Systems</Label>
                <p className="text-sm text-muted-foreground">
                  Connect to third-party SCADA APIs for real-time meter data
                </p>
              </div>
              <Switch 
                checked={config.scada.enabled} 
                onCheckedChange={(checked) => updateScada({ enabled: checked })}
              />
            </div>

            {config.scada.enabled && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="realtime"
                      checked={config.scada.realtimeStreaming}
                      onCheckedChange={(checked) => updateScada({ realtimeStreaming: !!checked })}
                    />
                    <Label htmlFor="realtime" className="text-sm">Real-time streaming</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="autoUpdate"
                      checked={config.scada.autoProfileUpdate}
                      onCheckedChange={(checked) => updateScada({ autoProfileUpdate: !!checked })}
                    />
                    <Label htmlFor="autoUpdate" className="text-sm">Auto-update profiles</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">SCADA Connections</Label>
                  {config.scada.connections.length === 0 ? (
                    <div className="text-center py-6 border border-dashed rounded-lg">
                      <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No SCADA connections configured</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {config.scada.connections.map((conn) => (
                        <div key={conn.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            {conn.isActive ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{conn.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{conn.vendor}</p>
                            </div>
                          </div>
                          <Badge variant={conn.isActive ? "default" : "secondary"}>
                            {conn.isActive ? "Connected" : "Inactive"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="h-3 w-3 mr-1" /> Add SCADA Connection
                  </Button>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Supported vendors:</strong> Schneider Electric, Siemens, ABB, Honeywell, and generic REST/Modbus APIs
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* CRM Integration */}
          <TabsContent value="crm" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">CRM Integration</Label>
                <p className="text-sm text-muted-foreground">
                  Sync opportunities, contacts, and proposals with your CRM
                </p>
              </div>
              <Switch 
                checked={config.crm.enabled} 
                onCheckedChange={(checked) => updateCRM({ enabled: checked })}
              />
            </div>

            {config.crm.enabled && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>CRM Provider</Label>
                  <Select 
                    value={config.crm.connection?.provider || ""}
                    onValueChange={(value) => updateCRM({ 
                      connection: { 
                        provider: value as any, 
                        isConnected: false, 
                        lastSync: null,
                        syncDirection: 'bidirectional'
                      } 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select CRM provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salesforce">Salesforce</SelectItem>
                      <SelectItem value="hubspot">HubSpot</SelectItem>
                      <SelectItem value="zoho">Zoho CRM</SelectItem>
                      <SelectItem value="pipedrive">Pipedrive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config.crm.connection && (
                  <>
                    <div className="flex items-center gap-2">
                      {config.crm.connection.isConnected ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                        </Badge>
                      ) : (
                        <Button size="sm">
                          Connect to {config.crm.connection.provider}
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="oppSync"
                          checked={config.crm.opportunitySync}
                          onCheckedChange={(checked) => updateCRM({ opportunitySync: !!checked })}
                        />
                        <Label htmlFor="oppSync" className="text-sm">Sync opportunities</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="contactSync"
                          checked={config.crm.contactSync}
                          onCheckedChange={(checked) => updateCRM({ contactSync: !!checked })}
                        />
                        <Label htmlFor="contactSync" className="text-sm">Sync contacts</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="companySync"
                          checked={config.crm.companySync}
                          onCheckedChange={(checked) => updateCRM({ companySync: !!checked })}
                        />
                        <Label htmlFor="companySync" className="text-sm">Sync companies</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="autoProposal"
                          checked={config.crm.autoProposalCreation}
                          onCheckedChange={(checked) => updateCRM({ autoProposalCreation: !!checked })}
                        />
                        <Label htmlFor="autoProposal" className="text-sm">Auto-create proposals</Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Sync Interval</Label>
                      <Select 
                        value={config.crm.syncInterval.toString()}
                        onValueChange={(value) => updateCRM({ syncInterval: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">Every 15 minutes</SelectItem>
                          <SelectItem value="30">Every 30 minutes</SelectItem>
                          <SelectItem value="60">Every hour</SelectItem>
                          <SelectItem value="240">Every 4 hours</SelectItem>
                          <SelectItem value="1440">Daily</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* Report Scheduling */}
          <TabsContent value="reports" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Automated Report Scheduling</Label>
                <p className="text-sm text-muted-foreground">
                  Schedule and email reports automatically
                </p>
              </div>
              <Switch 
                checked={config.reportScheduling.enabled} 
                onCheckedChange={(checked) => updateReporting({ enabled: checked })}
              />
            </div>

            {config.reportScheduling.enabled && (
              <div className="space-y-4 pt-4 border-t">
                {!config.reportScheduling.smtpConfigured && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Email delivery requires SMTP configuration. Configure in Settings → Email.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Scheduled Reports</Label>
                    <Badge variant="secondary">{config.reportScheduling.schedules.length} active</Badge>
                  </div>
                  
                  {config.reportScheduling.schedules.length === 0 ? (
                    <div className="text-center py-6 border border-dashed rounded-lg">
                      <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No scheduled reports</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {config.reportScheduling.schedules.map((schedule) => (
                        <div key={schedule.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{schedule.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {schedule.frequency} at {schedule.time} • {schedule.recipients.length} recipients
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={schedule.isActive ? "default" : "secondary"}>
                              {schedule.isActive ? "Active" : "Paused"}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="h-3 w-3 mr-1" /> Create Schedule
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Default Recipients</Label>
                  <Input 
                    placeholder="Enter email addresses separated by commas"
                    value={config.reportScheduling.defaultRecipients.join(', ')}
                    onChange={(e) => updateReporting({ 
                      defaultRecipients: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Webhook Notifications */}
          <TabsContent value="webhooks" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Webhook Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Send event notifications to external systems
                </p>
              </div>
              <Switch 
                checked={config.webhooks.enabled} 
                onCheckedChange={(checked) => updateWebhooks({ enabled: checked })}
              />
            </div>

            {config.webhooks.enabled && (
              <div className="space-y-4 pt-4 border-t">
                {/* Quick integrations */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className={`cursor-pointer transition-colors ${config.webhooks.slack.enabled ? 'border-primary' : ''}`}>
                    <CardContent className="p-3 text-center">
                      <Slack className="h-6 w-6 mx-auto mb-1" />
                      <p className="text-xs font-medium">Slack</p>
                      <Badge variant={config.webhooks.slack.enabled ? "default" : "secondary"} className="mt-1 text-xs">
                        {config.webhooks.slack.enabled ? "Connected" : "Connect"}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card className={`cursor-pointer transition-colors ${config.webhooks.teams.enabled ? 'border-primary' : ''}`}>
                    <CardContent className="p-3 text-center">
                      <MessageSquare className="h-6 w-6 mx-auto mb-1" />
                      <p className="text-xs font-medium">Teams</p>
                      <Badge variant={config.webhooks.teams.enabled ? "default" : "secondary"} className="mt-1 text-xs">
                        {config.webhooks.teams.enabled ? "Connected" : "Connect"}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card className={`cursor-pointer transition-colors ${config.webhooks.discord.enabled ? 'border-primary' : ''}`}>
                    <CardContent className="p-3 text-center">
                      <MessageSquare className="h-6 w-6 mx-auto mb-1" />
                      <p className="text-xs font-medium">Discord</p>
                      <Badge variant={config.webhooks.discord.enabled ? "default" : "secondary"} className="mt-1 text-xs">
                        {config.webhooks.discord.enabled ? "Connected" : "Connect"}
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                {/* Custom webhooks */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Custom Webhook Endpoints</Label>
                    <Badge variant="secondary">{config.webhooks.endpoints.length} configured</Badge>
                  </div>
                  
                  {config.webhooks.endpoints.length === 0 ? (
                    <div className="text-center py-6 border border-dashed rounded-lg">
                      <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No custom webhooks configured</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {config.webhooks.endpoints.map((endpoint) => (
                        <div key={endpoint.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{endpoint.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {endpoint.url}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={endpoint.isActive ? "default" : "secondary"}>
                              {endpoint.events.length} events
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="h-3 w-3 mr-1" /> Add Webhook Endpoint
                  </Button>
                </div>

                {/* Event types */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Available Events</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {webhookEvents.map((event) => (
                      <div key={event.value} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {event.label}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Retry Policy</Label>
                  <Select 
                    value={config.webhooks.globalRetryPolicy}
                    onValueChange={(value) => updateWebhooks({ globalRetryPolicy: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No retries</SelectItem>
                      <SelectItem value="linear">Linear backoff</SelectItem>
                      <SelectItem value="exponential">Exponential backoff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export { defaultAPIIntegrationConfig };
