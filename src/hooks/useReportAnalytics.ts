import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type EventType = 
  | 'view' 
  | 'export_pdf' 
  | 'export_excel' 
  | 'export_sheets' 
  | 'chart_view' 
  | 'infographic_generate'
  | 'builder_open'
  | 'template_apply';

interface TrackEventOptions {
  reportConfigId?: string;
  metadata?: Record<string, any>;
}

export function useReportAnalytics() {
  const { user } = useAuth();

  const trackEvent = async (eventType: EventType, options?: TrackEventOptions) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('report_analytics')
        .insert({
          user_id: user.id,
          event_type: eventType,
          report_config_id: options?.reportConfigId || null,
          metadata: options?.metadata || {},
        });

      if (error) {
        console.error('Failed to track analytics event:', error);
      }
    } catch (err) {
      console.error('Analytics tracking error:', err);
    }
  };

  return { trackEvent };
}
