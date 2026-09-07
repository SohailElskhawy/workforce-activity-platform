export type ClockifyUser = {
  id: string;
  name: string;
  email: string;
  status?: string;
  activeWorkspace?: string;
};

export type ClockifyWorkspace = {
  id: string;
  name: string;
};

export type ClockifyProject = {
  id: string;
  name: string;
  clientId?: string;
  color?: string;
};

export type ClockifyTask = {
  id: string;
  name: string;
  projectId?: string;
  status?: string;
};

export type ClockifyTimeInterval = {
  start: string; // ISO string
  end: string | null; // ISO string
  duration?: string | null; // PT1H30M
};

export type ClockifyTimeEntry = {
  id: string;
  description: string | null;
  userId: string;
  projectId: string | null;
  taskId: string | null;
  timeInterval: ClockifyTimeInterval;
};

export class ClockifyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; baseUrl?: string }) {
    this.apiKey = options.apiKey.trim();
    const rawUrl = options.baseUrl ?? "https://api.clockify.me/api/v1";

    const parsed = new URL(rawUrl);
    if (
      !parsed.hostname.endsWith("clockify.me") &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    ) {
      throw new Error("Invalid Clockify API base URL: must point to clockify.me");
    }

    this.baseUrl = rawUrl.replace(/\/$/, "");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      "X-Api-Key": this.apiKey,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMsg = `Clockify API error (${response.status} ${response.statusText})`;
        try {
          const errBody = await response.json();
          if (errBody?.message) {
            errorMsg = `Clockify: ${errBody.message}`;
          }
        } catch {
          // ignore non-json error
        }
        throw new Error(errorMsg);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Clockify API request timed out after 15 seconds");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async testConnection(): Promise<{ success: boolean; user: ClockifyUser }> {
    const user = await this.request<ClockifyUser>("/user");
    return { success: true, user };
  }

  async getWorkspaces(): Promise<ClockifyWorkspace[]> {
    return this.request<ClockifyWorkspace[]>("/workspaces");
  }

  async getUsers(workspaceId: string): Promise<ClockifyUser[]> {
    return this.request<ClockifyUser[]>(
      `/workspaces/${encodeURIComponent(workspaceId)}/users`
    );
  }

  async getProjects(
    workspaceId: string,
    page = 1,
    pageSize = 50
  ): Promise<ClockifyProject[]> {
    return this.request<ClockifyProject[]>(
      `/workspaces/${encodeURIComponent(workspaceId)}/projects?page=${page}&page-size=${pageSize}`
    );
  }

  async getTasks(
    workspaceId: string,
    projectId: string
  ): Promise<ClockifyTask[]> {
    return this.request<ClockifyTask[]>(
      `/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/tasks`
    );
  }

  async getTimeEntries(
    workspaceId: string,
    options: {
      start: string;
      end: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<ClockifyTimeEntry[]> {
    const params = new URLSearchParams({
      start: options.start,
      end: options.end,
      page: (options.page ?? 1).toString(),
      "page-size": (options.pageSize ?? 50).toString(),
    });

    return this.request<ClockifyTimeEntry[]>(
      `/workspaces/${encodeURIComponent(workspaceId)}/time-entries?${params.toString()}`
    );
  }

  async getUserTimeEntries(
    workspaceId: string,
    userId: string,
    options: {
      start: string;
      end: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<ClockifyTimeEntry[]> {
    const params = new URLSearchParams({
      start: options.start,
      end: options.end,
      page: (options.page ?? 1).toString(),
      "page-size": (options.pageSize ?? 50).toString(),
    });

    return this.request<ClockifyTimeEntry[]>(
      `/workspaces/${encodeURIComponent(workspaceId)}/user/${encodeURIComponent(userId)}/time-entries?${params.toString()}`
    );
  }
}
