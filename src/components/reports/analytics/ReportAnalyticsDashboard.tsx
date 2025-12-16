import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  BarChart3, 
  FileText, 
  Download, 
  Eye, 
  Sparkles,
  Clock,
  TrendingUp
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface AnalyticsEvent {
  id: string;
  event_type: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

interface EventCounts {
  views: number;
  exports_pdf: number;
  exports_excel: number;
  exports_sheets: number;
  chart_views: number;
  infographic_generates: number;
}

export function ReportAnalyticsDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [counts, setCounts] = useState<EventCounts>({
    views: 0,
    exports_pdf: 0,
    exports_excel: 0,
    exports_sheets: 0,
    chart_views: 0,
    infographic_generates: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      
      // Fetch recent events
      const { data: recentEvents, error: eventsError } = await supabase
        .from('report_analytics')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (eventsError) {
        console.error('Error fetching analytics:', eventsError);
      } else {
        // Cast metadata to expected type
        const typedEvents = (recentEvents || []).map(e => ({
          ...e,
          metadata: (e.metadata as Record<string, any>) || {},
        }));
        setEvents(typedEvents);
        
        // Calculate counts
        const newCounts: EventCounts = {
          views: 0,
          exports_pdf: 0,
          exports_excel: 0,
          exports_sheets: 0,
          chart_views: 0,
          infographic_generates: 0,
        };

        (recentEvents || []).forEach((event) => {
          switch (event.event_type) {
            case 'view':
            case 'builder_open':
              newCounts.views++;
              break;
            case 'export_pdf':
              newCounts.exports_pdf++;
              break;
            case 'export_excel':
              newCounts.exports_excel++;
              break;
            case 'export_sheets':
              newCounts.exports_sheets++;
              break;
            case 'chart_view':
              newCounts.chart_views++;
              break;
            case 'infographic_generate':
              newCounts.infographic_generates++;
              break;
          }
        });

        setCounts(newCounts);
      }

      setLoading(false);
    };

    fetchAnalytics();
  }, [user]);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'view':
      case 'builder_open':
        return <Eye className="h-4 w-4" />;
      case 'export_pdf':
      case 'export_excel':
      case 'export_sheets':
        return <Download className="h-4 w-4" />;
      case 'chart_view':
        return <BarChart3 className="h-4 w-4" />;
      case 'infographic_generate':
        return <Sparkles className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'view':
        return 'Report View';
      case 'builder_open':
        return 'Builder Opened';
      case 'export_pdf':
        return 'PDF Export';
      case 'export_excel':
        return 'Excel Export';
      case 'export_sheets':
        return 'Sheets Export';
      case 'chart_view':
        return 'Chart View';
      case 'infographic_generate':
        return 'Infographic Generated';
      case 'template_apply':
        return 'Template Applied';
      default:
        return eventType;
    }
  };

  const totalExports = counts.exports_pdf + counts.exports_excel + counts.exports_sheets;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Clock className="h-4 w-4 animate-spin mr-2" />
            Loading analytics...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{counts.views}</p>
            <p className="text-xs text-muted-foreground">Report Views</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Download className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{totalExports}</p>
            <p className="text-xs text-muted-foreground">Total Exports</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{counts.chart_views}</p>
            <p className="text-xs text-muted-foreground">Chart Views</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Sparkles className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{counts.infographic_generates}</p>
            <p className="text-xs text-muted-foreground">AI Generated</p>
          </CardContent>
        </Card>
      </div>

      {/* Export Format Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Export Formats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-sm">PDF: {counts.exports_pdf}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-sm">Excel: {counts.exports_excel}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-sm">Sheets: {counts.exports_sheets}</span>
            </div>
          </div>
          {totalExports > 0 && (
            <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-muted">
              {counts.exports_pdf > 0 && (
                <div 
                  className="bg-red-500" 
                  style={{ width: `${(counts.exports_pdf / totalExports) * 100}%` }}
                />
              )}
              {counts.exports_excel > 0 && (
                <div 
                  className="bg-green-500" 
                  style={{ width: `${(counts.exports_excel / totalExports) * 100}%` }}
                />
              )}
              {counts.exports_sheets > 0 && (
                <div 
                  className="bg-blue-500" 
                  style={{ width: `${(counts.exports_sheets / totalExports) * 100}%` }}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Recent Activity
          </CardTitle>
          <CardDescription>Last 50 events</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No activity recorded yet
              </p>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div 
                    key={event.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    {getEventIcon(event.event_type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{getEventLabel(event.event_type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {event.event_type.split('_')[0]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
