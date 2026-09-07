export type ClickUpUser = {
  id: number;
  username: string;
  email: string;
  color?: string;
  profilePicture?: string;
};

export type ClickUpWorkspace = {
  id: string;
  name: string;
  members: Array<{
    user: ClickUpUser;
    role?: number;
  }>;
};

export type ClickUpSpace = {
  id: string;
  name: string;
  private: boolean;
};

export type ClickUpList = {
  id: string;
  name: string;
  orderindex?: number;
  content?: string;
  status?: string;
  priority?: string;
  task_count?: number;
  due_date?: string;
  start_date?: string;
};

export type ClickUpTask = {
  id: string;
  name: string;
  text_content?: string;
  description?: string;
  status: {
    status: string;
    type: string;
    orderindex?: number;
    color?: string;
  };
  orderindex?: string;
  date_created?: string;
  date_updated?: string;
  date_closed?: string | null;
  date_done?: string | null;
  due_date?: string | null; // epoch milliseconds as string
  start_date?: string | null;
  time_estimate?: number | null; // milliseconds
  time_spent?: number | null;
  assignees?: ClickUpUser[];
  priority?: {
    id?: string;
    priority?: string;
  } | null;
  url?: string;
  list?: {
    id: string;
    name: string;
  };
  project?: {
    id: string;
    name: string;
  };
  folder?: {
    id: string;
    name: string;
  };
  space?: {
    id: string;
    name: string;
  };
};

export class ClickUpClient {
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor(options: { apiToken: string; baseUrl?: string }) {
    this.apiToken = options.apiToken.trim();
    const rawUrl = options.baseUrl ?? "https://api.clickup.com/api/v2";

    // SSRF safe validation: only allow api.clickup.com or mock test servers
    const parsed = new URL(rawUrl);
    if (
      !parsed.hostname.endsWith("clickup.com") &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    ) {
      throw new Error("Invalid ClickUp API base URL: must point to clickup.com");
    }

    this.baseUrl = rawUrl.replace(/\/$/, "");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      Authorization: this.apiToken,
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
        let errorMsg = `ClickUp API error (${response.status} ${response.statusText})`;
        try {
          const errBody = await response.json();
          if (errBody?.err || errBody?.error) {
            errorMsg = `ClickUp: ${errBody.err || errBody.error}`;
          }
        } catch {
          // ignore non-json error body
        }
        throw new Error(errorMsg);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("ClickUp API request timed out after 15 seconds");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async testConnection(): Promise<{ success: boolean; user: ClickUpUser }> {
    const data = await this.request<{ user: ClickUpUser }>("/user");
    return { success: true, user: data.user };
  }

  async getWorkspaces(): Promise<ClickUpWorkspace[]> {
    const data = await this.request<{ teams: ClickUpWorkspace[] }>("/team");
    return data.teams || [];
  }

  async getSpaces(teamId: string): Promise<ClickUpSpace[]> {
    const data = await this.request<{ spaces: ClickUpSpace[] }>(
      `/team/${encodeURIComponent(teamId)}/space`
    );
    return data.spaces || [];
  }

  async getLists(spaceId: string): Promise<ClickUpList[]> {
    const data = await this.request<{ lists: ClickUpList[] }>(
      `/space/${encodeURIComponent(spaceId)}/list`
    );
    return data.lists || [];
  }

  async getTasks(
    listId: string,
    page = 0,
    includeClosed = true
  ): Promise<{ tasks: ClickUpTask[]; lastPage: boolean }> {
    const params = new URLSearchParams({
      page: page.toString(),
      include_closed: includeClosed.toString(),
      subtasks: "true",
    });

    const data = await this.request<{ tasks: ClickUpTask[]; last_page?: boolean }>(
      `/list/${encodeURIComponent(listId)}/task?${params.toString()}`
    );

    return {
      tasks: data.tasks || [],
      lastPage: Boolean(data.last_page || data.tasks.length === 0),
    };
  }

  async getTask(taskId: string): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${encodeURIComponent(taskId)}`);
  }

  async createTask(
    listId: string,
    payload: {
      name: string;
      description?: string;
      assignees?: number[];
      status?: string;
      dueDate?: number; // epoch ms
      timeEstimate?: number; // ms
    }
  ): Promise<ClickUpTask> {
    const body: Record<string, unknown> = {
      name: payload.name,
      description: payload.description,
    };

    if (payload.assignees && payload.assignees.length > 0) {
      body.assignees = payload.assignees;
    }
    if (payload.status) {
      body.status = payload.status;
    }
    if (payload.dueDate !== undefined) {
      body.due_date = payload.dueDate;
    }
    if (payload.timeEstimate !== undefined) {
      body.time_estimate = payload.timeEstimate;
    }

    return this.request<ClickUpTask>(
      `/list/${encodeURIComponent(listId)}/task`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  }

  async updateTask(
    taskId: string,
    payload: {
      name?: string;
      description?: string;
      status?: string;
      dueDate?: number; // epoch ms
      timeEstimate?: number; // ms
    }
  ): Promise<ClickUpTask> {
    const body: Record<string, unknown> = {};

    if (payload.name !== undefined) body.name = payload.name;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.status !== undefined) body.status = payload.status;
    if (payload.dueDate !== undefined) body.due_date = payload.dueDate;
    if (payload.timeEstimate !== undefined) body.time_estimate = payload.timeEstimate;

    return this.request<ClickUpTask>(
      `/task/${encodeURIComponent(taskId)}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      }
    );
  }
}
