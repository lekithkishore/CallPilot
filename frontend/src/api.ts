const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export interface CallRecord {
  id: string;
  prospect_name: string;
  company_name: string | null;
  started_at: string;
  ended_at: string | null;
  current_stage: number;
  status: "in_progress" | "completed";
  outcome: string | null;
  next_step: string | null;
  summary: string | null;
}

export interface StageResult {
  id: string;
  call_id: string;
  stage_number: number;
  result_code: string | null;
  prospect_words: string | null;
  notes: Record<string, unknown>;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data as T;
}

export async function startCall(
  prospect_name: string,
  company_name: string
): Promise<CallRecord> {
  const result = await request<{ call: CallRecord }>("/api/calls", {
    method: "POST",
    body: JSON.stringify({ prospect_name, company_name }),
  });

  return result.call;
}

export async function saveStage(
  callId: string,
  stageNumber: number,
  result_code: string | null,
  prospect_words: string,
  notes: Record<string, unknown> = {}
): Promise<StageResult> {
  const result = await request<{ stage: StageResult }>(
    `/api/calls/${callId}/stages/${stageNumber}`,
    {
      method: "PUT",
      body: JSON.stringify({
        result_code,
        prospect_words,
        notes,
      }),
    }
  );

  return result.stage;
}

export async function closeCall(
  callId: string,
  outcome: string,
  next_step = "",
  summary = ""
): Promise<CallRecord> {
  const result = await request<{ call: CallRecord }>(
    `/api/calls/${callId}/close`,
    {
      method: "POST",
      body: JSON.stringify({
        outcome,
        next_step,
        summary,
      }),
    }
  );

  return result.call;
}

export async function getCalls(): Promise<CallRecord[]> {
  const result = await request<{ calls: CallRecord[] }>("/api/calls");
  return result.calls;
}

export async function getCallDetails(
  callId: string
): Promise<{ call: CallRecord; stages: StageResult[] }> {
  return request(`/api/calls/${callId}`);
}

export async function getCoachAdvice(input: {
  stage_name: string;
  purpose: string;
  result: string;
  prospect_words: string;
}): Promise<string> {
  const result = await request<{ advice: string }>("/api/coach", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.advice;
}
