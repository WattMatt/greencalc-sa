import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LucideIcon, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ModeCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  idealFor: string[];
  features: string[];
  status: "available" | "coming-soon";
  route: string;
  variant?: "default" | "primary";
}

export function ModeCard({
  title,
  description,
  icon: Icon,
  idealFor,
  features,
  status,
  route,
  variant = "default",
}: ModeCardProps) {
  const navigate = useNavigate();

  return (
    <Card 
      className={`relative overflow-hidden transition-all hover:shadow-lg ${
        variant === "primary" ? "border-primary/50 bg-primary/5" : ""
      } ${status === "coming-soon" ? "opacity-75" : "cursor-pointer"}`}
      onClick={() => status === "available" && navigate(route)}
    >
      {status === "coming-soon" && (
        <div className="absolute top-3 right-3">
          <Badge variant="secondary">Coming Soon</Badge>
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${variant === "primary" ? "bg-primary/10" : "bg-muted"}`}>
            <Icon className={`h-6 w-6 ${variant === "primary" ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
        </div>
        <CardDescription className="mt-2">{description}</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">IDEAL FOR</p>
          <div className="flex flex-wrap gap-1">
            {idealFor.map((item) => (
              <Badge key={item} variant="outline" className="text-xs">
                {item}
              </Badge>
            ))}
          </div>
        </div>
        
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">FEATURES</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {features.slice(0, 3).map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        
        <Button 
          variant={status === "available" ? "default" : "secondary"}
          className="w-full"
          disabled={status === "coming-soon"}
        >
          {status === "available" ? (
            <>
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </>
          ) : (
            "Coming Soon"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
