import { greedyPolicy, randomPolicy, systemOnePolicy, type Policy } from "./policies.ts";
import { oraclePolicy } from "./oracle.ts";
import { llmPolicy } from "./llm.ts";
import { teacherPolicy, type TeacherDecision } from "./teacher.ts";

export interface PolicyEnv {
  decisionBaseUrl: string;
  teacherBaseUrl?: string;
  teacherModel?: string;
  /** Shared by every teacher policy made with this env: identical prompts are asked once. */
  teacherCache?: Map<string, TeacherDecision>;
}

/**
 * Policies by name: "random", "greedy", "oracle" (greedy-rollout search;
 * "oracle-60t" sets a 60-step horizon), "teacher", "teacher-think", and
 * "-peekNt" variants that also show a simulated future per option (the chat
 * model from TEACHER_BASE_URL / TEACHER_MODEL), "llm:<model>", "llm-think:<model>",
 * or any decision model name served on the /v1/systemone endpoint.
 */
export function makePolicy(name: string, seed: number, env: PolicyEnv): Policy {
  if (name === "random") return randomPolicy(seed);
  if (name === "greedy") return greedyPolicy();
  const oracle = /^oracle(?:-(\d+)t)?$/.exec(name);
  if (oracle) return oraclePolicy({ steps: oracle[1] ? Number(oracle[1]) : 30 });
  if (name.startsWith("llm:")) return llmPolicy({ baseUrl: env.decisionBaseUrl, model: name.slice("llm:".length) });
  if (name.startsWith("llm-think:")) {
    return llmPolicy({ baseUrl: env.decisionBaseUrl, model: name.slice("llm-think:".length), think: true, numPredict: 1024, timeoutMs: 120_000 });
  }
  const teacher = /^teacher(-think)?(?:-peek(\d+)t)?$/.exec(name);
  if (teacher) {
    if (!env.teacherBaseUrl || !env.teacherModel) {
      throw new Error("Set TEACHER_BASE_URL and TEACHER_MODEL (see .env.example) to use the teacher.");
    }
    return teacherPolicy({
      baseUrl: env.teacherBaseUrl,
      model: env.teacherModel,
      think: !!teacher[1],
      peekSteps: teacher[2] ? Number(teacher[2]) : undefined,
      cache: env.teacherCache,
    });
  }
  return systemOnePolicy({ baseUrl: env.decisionBaseUrl, model: name });
}

/** Reads a local .env if present, without overriding variables already set. */
export function loadDotEnv(): void {
  try {
    (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.(".env");
  } catch {
    // no .env
  }
}

export function policyEnvFromProcess(): PolicyEnv {
  return {
    decisionBaseUrl: process.env.VITE_DECISION_BASE_URL ?? "http://localhost:11434",
    teacherBaseUrl: process.env.TEACHER_BASE_URL,
    teacherModel: process.env.TEACHER_MODEL,
  };
}
