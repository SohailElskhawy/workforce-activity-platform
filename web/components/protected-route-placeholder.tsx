import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ProtectedRoutePlaceholder({ title }: { title: string }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            This protected workspace will be implemented in a later phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Access to this route is enforced on the server.
        </CardContent>
      </Card>
    </main>
  );
}
