export type KolayIkUnit = {
  id: string;
  name: string;
  managerId?: string | null;
  parentId?: string | null;
};

export type KolayIkPerson = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  workEmail?: string;
  phone?: string | null;
  title?: string | null;
  unitId?: string | null;
  status: "active" | "inactive" | "suspended" | string;
  hireDate?: string | null;
};

export type KolayIkLeave = {
  id: string;
  personId: string;
  leaveType: string;
  startDate: string; // ISO date or YYYY-MM-DD
  endDate: string; // ISO date or YYYY-MM-DD
  days?: number | null;
  status: "approved" | "pending" | "rejected" | "cancelled" | string;
  description?: string | null;
};

export class KolayIkClient {
  private readonly apiToken: string;
  private readonly baseUrl: string;

  constructor(options: { apiToken: string; baseUrl?: string }) {
    this.apiToken = options.apiToken.trim();
    const rawUrl = options.baseUrl ?? "https://api.kolayik.com/v2";

    const parsed = new URL(rawUrl);
    if (
      !parsed.hostname.endsWith("kolayik.com") &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    ) {
      throw new Error("Invalid Kolay İK API base URL: must point to kolayik.com");
    }

    this.baseUrl = rawUrl.replace(/\/$/, "");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
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
        let errorMsg = `Kolay İK API error (${response.status} ${response.statusText})`;
        try {
          const errBody = await response.json();
          if (errBody?.message || errBody?.error) {
            errorMsg = `Kolay İK: ${errBody.message || errBody.error}`;
          }
        } catch {
          // ignore non-json error
        }
        throw new Error(errorMsg);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Kolay İK API request timed out after 15 seconds");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    // Official Kolay IK endpoint for pinging / testing unit list
    await this.request<{ data?: unknown; items?: unknown }>("/unit/list?limit=1");
    return { success: true, message: "Successfully connected to Kolay İK API" };
  }

  async listDepartments(): Promise<KolayIkUnit[]> {
    const res = await this.request<{ data?: KolayIkUnit[]; items?: KolayIkUnit[] }>(
      "/unit/list"
    );
    return res.data || res.items || [];
  }

  async listEmployees(): Promise<KolayIkPerson[]> {
    const res = await this.request<{ data?: KolayIkPerson[]; items?: KolayIkPerson[] }>(
      "/person/list"
    );
    return res.data || res.items || [];
  }

  async listLeaves(): Promise<KolayIkLeave[]> {
    const res = await this.request<{ data?: KolayIkLeave[]; items?: KolayIkLeave[] }>(
      "/leave/list"
    );
    return res.data || res.items || [];
  }
}
