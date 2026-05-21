"use client";

/**
 * Status Page - HTML view of application status
 *
 * Shows:
 * - Current git deployment (SHA, commit message, date)
 * - Application uptime
 * - Server information
 *
 * JSON API available at /status.json
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Clock, GitBranch, Server, Timer, Loader2, RefreshCw, Terminal } from "lucide-react";

interface StatusData {
  status: string;
  deployment: {
    sha: string;
    shortSha: string;
    message: string;
    commitDate: string;
    commitDateFormatted: string;
  };
  build: {
    time: string;
    timeFormatted: string;
  };
  uptime: {
    started: string;
    startedFormatted: string;
    uptime: string;
    uptimeSeconds: number;
  };
  server: {
    time: string;
    timeFormatted: string;
    timezone: string;
  };
  environment: string;
  dataDir: {
    raw: string | null;
    resolved: string;
    exists: boolean;
    writable: boolean;
    years: string[];
    stats: {
      yearCount: number;
      upcomingEvents: number;
      latestEventsUpdatedAt: string | null;
      lastSync: string | null;
    };
  };
}

interface SyncLogLine {
  stream: string;
  text: string;
  timestamp: number;
}

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLogLine[]>([]);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    duration: string;
  } | null>(null);
  const syncConsoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/status.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch status");
        return res.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch("/api/status/admin", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { isAdmin: false }))
      .then((data) => setIsAdmin(Boolean(data.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    if (syncConsoleRef.current) {
      syncConsoleRef.current.scrollTop = syncConsoleRef.current.scrollHeight;
    }
  }, [syncLogs]);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/status.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to refresh status");
    setData(await response.json());
  }, []);

  const runSync = useCallback(async () => {
    if (syncRunning) return;

    setSyncRunning(true);
    setSyncLogs([]);
    setSyncResult(null);

    try {
      const response = await fetch("/api/status/sync", { method: "POST" });

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const payload = await response.json();
          if (payload?.error) message = payload.error;
        } catch {}
        throw new Error(message);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.stream === "done") {
              setSyncResult({
                success: Boolean(event.success),
                duration: event.duration || "0s",
              });
              if (event.success) {
                refreshStatus().catch(() => {});
              }
            } else {
              setSyncLogs((prev) => [
                ...prev,
                {
                  stream: event.stream || "stdout",
                  text: event.text || "",
                  timestamp: Date.now(),
                },
              ]);
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      setSyncLogs((prev) => [
        ...prev,
        {
          stream: "error",
          text: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        },
      ]);
      setSyncResult({ success: false, duration: "0s" });
    } finally {
      setSyncRunning(false);
    }
  }, [refreshStatus, syncRunning]);

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Status</CardTitle>
            <CardDescription>{error || "Unable to load application status"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isHealthy = data.status === "ok";

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      {/* Header */}
      <div className="space-y-2 mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-bold">System Status</h1>
          <Badge variant={isHealthy ? "default" : "destructive"} className="text-sm">
            {isHealthy ? "Operational" : "Error"}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Real-time application status and deployment information
        </p>
      </div>

      <div className="space-y-6">
        {/* Deployment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Current Deployment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Commit SHA</p>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {data.deployment.shortSha}
                </code>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Environment</p>
                <Badge variant="outline">{data.environment}</Badge>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-1">Commit Message</p>
              <p className="text-sm font-mono">{data.deployment.message}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Commit Date</p>
                <p className="text-sm">{data.deployment.commitDateFormatted || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Build Time</p>
                <p className="text-sm">{data.build?.timeFormatted || "N/A"}</p>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={`https://github.com/commonshub/commonshub.brussels/commit/${data.deployment.sha}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View commit on GitHub →
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Uptime Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Application Uptime
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Started At</p>
                <p className="text-sm">{data.uptime.startedFormatted}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Running For</p>
                <p className="text-lg font-semibold">{data.uptime.uptime}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Server Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Server Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Time</p>
                <p className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {data.server.timeFormatted}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Timezone</p>
                <p className="text-sm">{data.server.timezone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Data Directory
            </CardTitle>
            <CardDescription>
              Effective runtime data path and current data health signals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Resolved DATA_DIR</p>
                <code className="text-sm bg-muted px-2 py-1 rounded break-all">
                  {data.dataDir.resolved}
                </code>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Raw Environment Value</p>
                <code className="text-sm bg-muted px-2 py-1 rounded break-all">
                  {data.dataDir.raw || "(not set)"}
                </code>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Exists</p>
                <Badge variant={data.dataDir.exists ? "default" : "destructive"}>
                  {data.dataDir.exists ? "Yes" : "No"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Writable</p>
                <Badge variant={data.dataDir.writable ? "default" : "secondary"}>
                  {data.dataDir.writable ? "Yes" : "No"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Year Folders</p>
                <p className="text-sm">{data.dataDir.stats.yearCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Upcoming Events</p>
                <p className="text-sm">{data.dataDir.stats.upcomingEvents}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Last Event Data Update</p>
                <p className="text-sm">
                  {data.dataDir.stats.latestEventsUpdatedAt
                    ? new Date(data.dataDir.stats.latestEventsUpdatedAt).toLocaleString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Last Sync</p>
                <p className="text-sm">
                  {data.dataDir.stats.lastSync
                    ? new Date(data.dataDir.stats.lastSync).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Available Years</p>
              <p className="text-sm font-mono">
                {data.dataDir.years.length > 0 ? data.dataDir.years.join(", ") : "None"}
              </p>
            </div>

            {isAdmin && (
              <>
                <Separator />

                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Admin Data Sync</p>
                      <p className="text-xs text-muted-foreground">
                        Runs <code>chb sync</code> with this page&apos;s DATA_DIR and streams the output below.
                      </p>
                    </div>
                    <Button onClick={runSync} disabled={syncRunning}>
                      {syncRunning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      {syncRunning ? "Syncing…" : "Run chb sync"}
                    </Button>
                  </div>

                  {(syncLogs.length > 0 || syncResult || syncRunning) && (
                    <div className="rounded-lg border bg-black text-green-100 shadow-inner">
                      <div className="flex items-center gap-2 border-b border-green-900/60 px-3 py-2 text-xs text-green-300">
                        <Terminal className="h-4 w-4" />
                        <span>chb sync terminal</span>
                      </div>
                      <div
                        ref={syncConsoleRef}
                        className="max-h-80 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
                      >
                        {syncLogs.map((line, index) => (
                          <div
                            key={`${line.timestamp}-${index}`}
                            className={
                              line.stream === "stderr" || line.stream === "error"
                                ? "text-red-300"
                                : line.stream === "system"
                                  ? "text-blue-300"
                                  : "text-green-100"
                            }
                          >
                            <span className="select-none opacity-60">[{line.stream}] </span>
                            {line.text}
                          </div>
                        ))}
                        {syncRunning && (
                          <div className="text-green-300">
                            <span className="animate-pulse">▌</span>
                          </div>
                        )}
                        {syncResult && (
                          <div className={syncResult.success ? "text-green-300" : "text-red-300"}>
                            [{syncResult.success ? "done" : "failed"}] finished in {syncResult.duration}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* JSON API Link */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1">JSON API</p>
                <p className="text-xs text-muted-foreground">
                  Programmatic access to status information
                </p>
              </div>
              <a
                href="/status.json"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View JSON →
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
