import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Database, 
  Users, 
  Calendar, 
  Bell, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Clock,
  AlertTriangle,
  Activity
} from "lucide-react";
import { APIIntegrationConfig } from "./APIIntegrationTypes";

interface APIIntegrationStatusProps {
  config: APIIntegrationConfig;
}

export function APIIntegrationStatus({ config }: APIIntegrationStatusProps) {
  const integrations = [
    {
      id: 'scada',
      name: 'SCADA Systems',
      icon: Database,
      enabled: config.scada.enabled,
      status: config.scada.connections.some(c => c.isActive) ? 'connected' : config.scada.enabled ? 'pending' : 'disabled',
      details: config.scada.enabled 
        ? `${config.scada.connections.filter(c => c.isActive).length}/${config.scada.connections.length} connections active`
        : 'Not configured',
      lastSync: config.scada.connections.find(c => c.lastSync)?.lastSync,
    },
    {
      id: 'crm',
      name: 'CRM Integration',
      icon: Users,
      enabled: config.crm.enabled,
      status: config.crm.connection?.isConnected ? 'connected' : config.crm.enabled ? 'pending' : 'disabled',
      details: config.crm.connection 
        ? `${config.crm.connection.provider} ${config.crm.connection.isConnected ? 'connected' : 'pending'}`
        : 'Not configured',
      lastSync: config.crm.connection?.lastSync,
    },
    {
      id: 'reports',
      name: 'Report Scheduling',
      icon: Calendar,
      enabled: config.reportScheduling.enabled,
      status: config.reportScheduling.schedules.some(s => s.isActive) ? 'connected' : config.reportScheduling.enabled ? 'pending' : 'disabled',
      details: config.reportScheduling.enabled 
        ? `${config.reportScheduling.schedules.filter(s => s.isActive).length} active schedules`
        : 'Not configured',
      lastSync: config.reportScheduling.schedules.find(s => s.lastRun)?.lastRun,
    },
    {
      id: 'webhooks',
      name: 'Webhook Notifications',
      icon: Bell,
      enabled: config.webhooks.enabled,
      status: config.webhooks.endpoints.some(e => e.isActive) || config.webhooks.slack.enabled || config.webhooks.teams.enabled || config.webhooks.discord.enabled 
        ? 'connected' 
        : config.webhooks.enabled ? 'pending' : 'disabled',
      details: config.webhooks.enabled 
        ? `${config.webhooks.endpoints.filter(e => e.isActive).length} endpoints, ${[config.webhooks.slack.enabled, config.webhooks.teams.enabled, config.webhooks.discord.enabled].filter(Boolean).length} chat integrations`
        : 'Not configured',
      lastSync: config.webhooks.endpoints.find(e => e.lastTriggered)?.lastTriggered,
    },
  ];

  const connectedCount = integrations.filter(i => i.status === 'connected').length;
  const overallHealth = connectedCount / integrations.length * 100;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Connected</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">Pending</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Disabled</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Integration Status
        </CardTitle>
        <CardDescription>
          Monitor connected systems and sync status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Health */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Integration Health</span>
            <span className="font-medium">{connectedCount}/{integrations.length} connected</span>
          </div>
          <Progress value={overallHealth} className="h-2" />
        </div>

        {/* Integration List */}
        <div className="space-y-3">
          {integrations.map((integration) => (
            <div 
              key={integration.id} 
              className={`flex items-center justify-between p-3 rounded-lg border ${
                integration.status === 'connected' ? 'bg-green-500/5 border-green-500/20' :
                integration.status === 'pending' ? 'bg-amber-500/5 border-amber-500/20' :
                'bg-muted/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  integration.status === 'connected' ? 'bg-green-500/10' :
                  integration.status === 'pending' ? 'bg-amber-500/10' :
                  'bg-muted'
                }`}>
                  <integration.icon className={`h-4 w-4 ${
                    integration.status === 'connected' ? 'text-green-600' :
                    integration.status === 'pending' ? 'text-amber-600' :
                    'text-muted-foreground'
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-medium">{integration.name}</p>
                  <p className="text-xs text-muted-foreground">{integration.details}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {integration.lastSync && (
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground">Last sync</p>
                    <p className="text-xs font-medium">
                      {new Date(integration.lastSync).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {getStatusBadge(integration.status)}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <RefreshCw className="h-3 w-3 mr-1" />
            Sync All
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            View Logs
          </Button>
        </div>

        {/* Recent Activity */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">RECENT ACTIVITY</p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span>SCADA sync completed</span>
              <span className="ml-auto">2 min ago</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Webhook delivered to Slack</span>
              <span className="ml-auto">15 min ago</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Report scheduled for delivery</span>
              <span className="ml-auto">1 hour ago</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
