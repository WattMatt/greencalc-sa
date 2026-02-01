import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Plus, Flag, Lightbulb, ArrowRight } from 'lucide-react';

interface GettingStartedGuideProps {
  onCreateTask: () => void;
  onCreateMilestone: () => void;
  children: ReactNode;
  isTaskFormOpen: boolean;
  isMilestoneFormOpen: boolean;
}

export function GettingStartedGuide({ 
  onCreateTask, 
  onCreateMilestone, 
  children 
}: GettingStartedGuideProps) {
  return (
    <div className="space-y-6">
      <Card className="border-dashed">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Create Your Project Schedule</CardTitle>
          <CardDescription className="max-w-md mx-auto">
            Plan your solar installation timeline with tasks, milestones, and dependencies.
            Track progress and identify critical path items.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={onCreateTask} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create First Task
            </Button>
            <span className="text-muted-foreground">or</span>
            <Button variant="outline" onClick={onCreateMilestone}>
              <Flag className="h-4 w-4 mr-2" />
              Add a Milestone
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tips section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Break Down Your Work</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Create tasks for each phase: site survey, permits, equipment delivery, installation, commissioning.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Flag className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Mark Key Dates</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Add milestones for important events like equipment arrival, grid connection, or handover.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent">
                <ArrowRight className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Link Dependencies</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect tasks that depend on each other to visualize the critical path.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      {children}
    </div>
  );
}
