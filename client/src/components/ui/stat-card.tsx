import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  iconBgColor: string;
  valueColor?: string;
  className?: string;
}

export function StatCard({ 
  title, 
  value, 
  icon, 
  iconBgColor, 
  valueColor = "text-foreground",
  className 
}: StatCardProps) {
  return (
    <Card className={cn("stat-card", className)}>
      <CardContent className="flex items-center p-6">
        <div className="flex items-center w-full">
            <div className="flex-shrink-0">
              <div className={cn("stat-card-icon", iconBgColor)}>
                <i className={cn(icon, "text-sm")} />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">
                {title}
              </p>
              <p className={cn("text-2xl font-bold", valueColor)}>
                {value}
              </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
