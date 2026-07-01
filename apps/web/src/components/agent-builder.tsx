"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, X } from "lucide-react";
import {
  CATEGORIES,
  type AgentCategory,
  type MarketAgent,
} from "@occa-market/shared";
import { createAgent, getAgentDetail } from "@/lib/api";
import {
  draftFromTemplate,
  draftToPreview,
  emptyDraft,
  handleFromName,
  type DraftAgent,
} from "@/lib/builder";
import {
  ADAPTERS,
  SKILL_LIBRARY,
  TOOL_LIBRARY,
  type AdapterType,
} from "@/lib/builder-options";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STEPS = [
  "Start",
  "Identity",
  "Gateway",
  "Skills",
  "Tools",
  "Workflow",
  "Review",
];

type Update = (patch: Partial<DraftAgent>) => void;

export function AgentBuilder({ templates }: { templates: MarketAgent[] }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DraftAgent>(emptyDraft());
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update: Update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const last = STEPS.length - 1;

  const canPublish =
    draft.name.trim().length > 0 &&
    draft.tagline.trim().length > 0 &&
    draft.connection === "ok";

  async function publish() {
    if (!canPublish || publishing) return;
    setPublishing(true);
    setError(null);
    const res = await createAgent({
      name: draft.name,
      handle: draft.handle,
      glyph: draft.glyph,
      category: draft.category,
      tagline: draft.tagline,
      persona: draft.persona,
      pricePerMsg: draft.pricePerMsg,
      skills: draft.skills.map((s) => s.name),
      tools: draft.tools,
      workflow: draft.workflow,
    });
    setPublishing(false);
    if (res.ok) setPublished(true);
    else setError(res.error);
  }

  if (published) {
    return (
      <Published
        draft={draft}
        onReset={() => {
          setDraft(emptyDraft());
          setStep(0);
          setPublished(false);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
      <p className="eyebrow mb-2">Provider</p>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">
        Build your agent
      </h1>
      <p className="mt-2 max-w-xl font-mono text-xs leading-relaxed text-muted">
        Configure the agent and the gateway that powers it. The two are bound
        together, they go live and offline as one.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr]">
        <Stepper current={step} onJump={setStep} />

        <div>
          <div className="min-h-[360px]">
            {step === 0 && (
              <StartStep
                draft={draft}
                setDraft={setDraft}
                templates={templates}
                onPicked={() => setStep(1)}
              />
            )}
            {step === 1 && <IdentityStep draft={draft} update={update} />}
            {step === 2 && <GatewayStep draft={draft} update={update} />}
            {step === 3 && <SkillsStep draft={draft} update={update} />}
            {step === 4 && <ToolsStep draft={draft} update={update} />}
            {step === 5 && <WorkflowStep draft={draft} update={update} />}
            {step === 6 && (
              <ReviewStep
                draft={draft}
                canPublish={canPublish}
                publishing={publishing}
                error={error}
                onPublish={publish}
              />
            )}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
            <Button
              variant="secondary"
              size="md"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft size={14} className="mr-1.5" />
              Back
            </Button>

            {step < last ? (
              <Button size="md" onClick={() => setStep((s) => s + 1)}>
                Next
                <ArrowRight size={14} className="ml-1.5" />
              </Button>
            ) : (
              <Button
                size="md"
                variant="light"
                disabled={!canPublish || publishing}
                onClick={publish}
              >
                {publishing ? "Publishing…" : "Publish agent"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stepper ──────────────────────────────────────────────────── */

function Stepper({
  current,
  onJump,
}: {
  current: number;
  onJump: (i: number) => void;
}) {
  return (
    <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex-none lg:flex-1">
            <button
              type="button"
              onClick={() => onJump(i)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                active ? "bg-surface-2" : "hover:bg-surface-2/60"
              }`}
            >
              <span
                className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border font-mono text-[0.6rem] ${
                  active
                    ? "border-fg/30 bg-surface-2 text-fg"
                    : done
                      ? "border-line-strong text-accent"
                      : "border-line text-faint"
                }`}
              >
                {done ? <Check size={11} /> : i + 1}
              </span>
              <span
                className={`text-xs ${active ? "text-fg" : done ? "text-muted" : "text-faint"}`}
              >
                {label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Step 1 · Start ───────────────────────────────────────────── */

function StartStep({
  draft,
  setDraft,
  templates,
  onPicked,
}: {
  draft: DraftAgent;
  setDraft: (d: DraftAgent) => void;
  templates: MarketAgent[];
  onPicked: () => void;
}) {
  async function fork(agent: MarketAgent) {
    // Pull the agent's full detail so the fork prefills persona/skills/workflow.
    const record = await getAgentDetail(agent.id);
    setDraft(
      record ? draftFromTemplate(record.agent, record.detail) : emptyDraft(),
    );
    onPicked();
  }

  return (
    <StepShell
      title="Start from a template or scratch"
      hint="Forking a seed agent prefills the persona, skills, and workflow. You still bring your own gateway."
    >
      <button
        type="button"
        onClick={() => {
          setDraft(emptyDraft());
          onPicked();
        }}
        className={`mb-3 w-full rounded-xl border bg-surface-2 px-4 py-3 text-left transition-colors hover:border-line-strong ${
          draft.template === null ? "border-fg/25" : "border-line"
        }`}
      >
        <p className="text-sm font-semibold text-fg">Start from scratch</p>
        <p className="mt-0.5 font-mono text-xs text-muted">
          A blank agent. You set everything.
        </p>
      </button>

      <p className="eyebrow mb-2 mt-5">Or fork a template</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {templates.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => fork(a)}
            className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-left transition-colors hover:border-line-strong"
          >
            <span className="spotlight flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-line text-base text-fg">
              {a.glyph}
            </span>
            <span>
              <span className="block text-sm font-semibold text-fg">
                {a.name}
              </span>
              <span className="mt-0.5 block font-mono text-[0.7rem] leading-relaxed text-muted">
                {a.tagline}
              </span>
            </span>
          </button>
        ))}
      </div>
    </StepShell>
  );
}

/* ── Step 2 · Identity ────────────────────────────────────────── */

function IdentityStep({ draft, update }: { draft: DraftAgent; update: Update }) {
  return (
    <StepShell
      title="Identity"
      hint="This is the public face. Describe the work it produces, not the model behind it."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_5rem]">
        <Field label="Name">
          <TextInput
            value={draft.name}
            placeholder="Degen Scout"
            onChange={(e) =>
              update({
                name: e.target.value,
                handle: handleFromName(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Glyph">
          <TextInput
            value={draft.glyph}
            maxLength={2}
            className="text-center"
            onChange={(e) => update({ glyph: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Handle">
          <TextInput
            value={draft.handle}
            placeholder="degen_scout"
            onChange={(e) => update({ handle: e.target.value })}
          />
        </Field>
        <Field label="Price (USDC / msg)">
          <TextInput
            type="number"
            step="0.01"
            min="0"
            value={draft.pricePerMsg}
            onChange={(e) =>
              update({ pricePerMsg: Number(e.target.value) || 0 })
            }
          />
        </Field>
      </div>

      <div className="mt-4">
        <p className="eyebrow mb-2">Category</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Pill
              key={c}
              active={draft.category === c}
              onClick={() => update({ category: c as AgentCategory })}
            >
              {c}
            </Pill>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <Field
          label="Tagline"
          hint="One line on what it does for the user."
        >
          <TextInput
            value={draft.tagline}
            placeholder="Surfaces fresh token launches and flags the risks."
            onChange={(e) => update({ tagline: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Persona / description">
          <TextArea
            value={draft.persona}
            rows={4}
            placeholder="How the agent behaves, what it's good at, the voice it uses…"
            onChange={(e) => update({ persona: e.target.value })}
          />
        </Field>
      </div>
    </StepShell>
  );
}

/* ── Step 3 · Gateway ─────────────────────────────────────────── */

function GatewayStep({ draft, update }: { draft: DraftAgent; update: Update }) {
  function test() {
    if (!draft.gatewayUrl.trim()) {
      update({ connection: "fail" });
      return;
    }
    update({ connection: "testing" });
    setTimeout(() => update({ connection: "ok" }), 800);
  }

  return (
    <StepShell
      title="Gateway & adapter"
      hint="The runtime that powers this agent. It runs on your own host and is bound to this one agent only."
    >
      <p className="eyebrow mb-2">Adapter</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ADAPTERS.map((a) => (
          <button
            key={a.type}
            type="button"
            onClick={() =>
              update({
                adapterType: a.type as AdapterType,
                model: a.defaultModel,
                connection: "idle",
              })
            }
            className={`rounded-xl border bg-surface-2 px-3.5 py-3 text-left transition-colors hover:border-line-strong ${
              draft.adapterType === a.type ? "border-fg/25" : "border-line"
            }`}
          >
            <p className="text-sm font-semibold text-fg">{a.name}</p>
            <p className="mt-0.5 font-mono text-[0.7rem] leading-relaxed text-muted">
              {a.blurb}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Gateway URL">
          <TextInput
            value={draft.gatewayUrl}
            placeholder="https://my-gateway.example.com"
            onChange={(e) =>
              update({ gatewayUrl: e.target.value, connection: "idle" })
            }
          />
        </Field>
        <Field label="API key">
          <TextInput
            type="password"
            value={draft.apiKey}
            placeholder="••••••••"
            onChange={(e) => update({ apiKey: e.target.value })}
          />
        </Field>
        <Field label="Model">
          <TextInput
            value={draft.model}
            onChange={(e) => update({ model: e.target.value })}
          />
        </Field>
        <Field label="External agent ID">
          <TextInput
            value={draft.externalAgentId}
            placeholder="agt_…"
            onChange={(e) => update({ externalAgentId: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          disabled={draft.connection === "testing"}
          onClick={test}
        >
          Test connection
        </Button>
        <ConnectionBadge status={draft.connection} />
      </div>

      <p className="mt-5 rounded-xl border border-line bg-surface-2 px-3.5 py-3 font-mono text-[0.7rem] leading-relaxed text-faint">
        Bound 1:1. This gateway powers only this agent. There is no pooling, and
        if the gateway goes down the agent shows offline until it is back.
      </p>
    </StepShell>
  );
}

function ConnectionBadge({ status }: { status: DraftAgent["connection"] }) {
  if (status === "testing")
    return (
      <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
        <Loader2 size={13} className="animate-spin" />
        Testing…
      </span>
    );
  if (status === "ok")
    return (
      <span className="flex items-center gap-1.5 font-mono text-xs text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Connected
      </span>
    );
  if (status === "fail")
    return (
      <span className="font-mono text-xs text-bad">Couldn&apos;t reach gateway</span>
    );
  return <span className="font-mono text-xs text-faint">Not tested</span>;
}

/* ── Step 4 · Skills ──────────────────────────────────────────── */

function SkillsStep({ draft, update }: { draft: DraftAgent; update: Update }) {
  const [name, setName] = useState("");

  function add(skillName: string) {
    const n = skillName.trim();
    if (!n || draft.skills.some((s) => s.name === n)) return;
    update({ skills: [...draft.skills, { name: n, description: "" }] });
    setName("");
  }

  return (
    <StepShell
      title="Skills"
      hint="What the agent can do. Skills are seeded to the gateway as workspace files."
    >
      <div className="flex flex-wrap gap-2">
        {draft.skills.length === 0 && (
          <p className="font-mono text-xs text-faint">No skills yet.</p>
        )}
        {draft.skills.map((s) => (
          <span
            key={s.name}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-muted"
          >
            {s.name}
            <button
              type="button"
              onClick={() =>
                update({ skills: draft.skills.filter((x) => x.name !== s.name) })
              }
              className="text-faint transition-colors hover:text-fg"
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        <TextInput
          value={name}
          placeholder="Add a custom skill…"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(name);
            }
          }}
        />
        <Button variant="secondary" size="md" onClick={() => add(name)}>
          <Plus size={14} />
        </Button>
      </div>

      <p className="eyebrow mb-2 mt-5">From the library</p>
      <div className="flex flex-wrap gap-2">
        {SKILL_LIBRARY.filter(
          (lib) => !draft.skills.some((s) => s.name === lib.name),
        ).map((lib) => (
          <button
            key={lib.name}
            type="button"
            onClick={() => add(lib.name)}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            <Plus size={11} className="text-faint" />
            {lib.name}
          </button>
        ))}
      </div>
    </StepShell>
  );
}

/* ── Step 5 · Tools ───────────────────────────────────────────── */

function ToolsStep({ draft, update }: { draft: DraftAgent; update: Update }) {
  function toggle(tool: string) {
    update({
      tools: draft.tools.includes(tool)
        ? draft.tools.filter((t) => t !== tool)
        : [...draft.tools, tool],
    });
  }

  return (
    <StepShell
      title="Tools"
      hint="Integrations the agent can call to do its work."
    >
      <div className="flex flex-wrap gap-2">
        {TOOL_LIBRARY.map((tool) => {
          const on = draft.tools.includes(tool);
          return (
            <button
              key={tool}
              type="button"
              onClick={() => toggle(tool)}
              className={`rounded-xl border px-3 py-1.5 font-mono text-xs transition-colors ${
                on
                  ? "border-fg/25 bg-surface-2 text-fg"
                  : "border-line text-muted hover:border-line-strong hover:text-fg"
              }`}
            >
              {tool}
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}

/* ── Step 6 · Workflow ────────────────────────────────────────── */

function WorkflowStep({ draft, update }: { draft: DraftAgent; update: Update }) {
  const [step, setStep] = useState("");

  function add() {
    const s = step.trim();
    if (!s) return;
    update({ workflow: [...draft.workflow, s] });
    setStep("");
  }

  return (
    <StepShell
      title="Workflow"
      hint="The ordered steps the agent runs on each request."
    >
      <ol className="flex flex-col">
        {draft.workflow.length === 0 && (
          <p className="font-mono text-xs text-faint">No steps yet.</p>
        )}
        {draft.workflow.map((s, i) => {
          const lastStep = i === draft.workflow.length - 1;
          return (
            <li key={i} className="flex gap-3">
              <div className="flex flex-none flex-col items-center">
                <span className="mt-1.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-line-strong bg-surface-2 font-mono text-[0.6rem] text-faint">
                  {i + 1}
                </span>
                {!lastStep && <span className="my-1 w-px flex-1 bg-line" />}
              </div>
              <div className="flex flex-1 items-start justify-between gap-2 pb-4 pt-1.5">
                <p className="font-mono text-sm leading-relaxed text-muted">
                  {s}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      workflow: draft.workflow.filter((_, j) => j !== i),
                    })
                  }
                  className="mt-0.5 flex-none text-faint transition-colors hover:text-fg"
                >
                  <X size={12} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex gap-2">
        <TextInput
          value={step}
          placeholder="Add a step…"
          onChange={(e) => setStep(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" size="md" onClick={add}>
          <Plus size={14} />
        </Button>
      </div>
    </StepShell>
  );
}

/* ── Step 7 · Review ──────────────────────────────────────────── */

function ReviewStep({
  draft,
  canPublish,
  publishing,
  error,
  onPublish,
}: {
  draft: DraftAgent;
  canPublish: boolean;
  publishing: boolean;
  error: string | null;
  onPublish: () => void;
}) {
  const preview = draftToPreview(draft);
  const adapter = ADAPTERS.find((a) => a.type === draft.adapterType);

  return (
    <StepShell
      title="Review & publish"
      hint="Here's how it lands in the catalog. Publishing needs a name, a tagline, and a connected gateway."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <PreviewCard preview={preview} />

        <div className="flex flex-col gap-3 font-mono text-xs">
          <SummaryRow label="Runtime" value={`${adapter?.name ?? draft.adapterType}`} />
          <SummaryRow
            label="Gateway"
            value={draft.connection === "ok" ? "Connected" : "Not connected"}
            bad={draft.connection !== "ok"}
          />
          <SummaryRow label="Skills" value={`${draft.skills.length}`} />
          <SummaryRow label="Tools" value={`${draft.tools.length}`} />
          <SummaryRow label="Workflow" value={`${draft.workflow.length} steps`} />
          <SummaryRow
            label="Price"
            value={`$${draft.pricePerMsg.toFixed(2)} / msg`}
          />
        </div>
      </div>

      {!canPublish && (
        <p className="mt-5 font-mono text-xs text-warn">
          Add a name and tagline, and connect the gateway, before publishing.
        </p>
      )}

      {error && <p className="mt-5 font-mono text-xs text-bad">{error}</p>}

      <div className="mt-5">
        <Button
          variant="light"
          size="md"
          disabled={!canPublish || publishing}
          onClick={onPublish}
        >
          {publishing ? "Publishing…" : "Publish agent"}
        </Button>
      </div>
    </StepShell>
  );
}

function SummaryRow({
  label,
  value,
  bad,
}: {
  label: string;
  value: string;
  bad?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
      <span className="text-faint">{label}</span>
      <span className={bad ? "text-warn" : "text-fg"}>{value}</span>
    </div>
  );
}

function PreviewCard({ preview }: { preview: ReturnType<typeof draftToPreview> }) {
  const online = preview.status === "online";
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between">
        <div className="spotlight flex h-11 w-11 items-center justify-center rounded-xl border border-line text-lg text-fg">
          {preview.glyph}
        </div>
        <span className="flex items-center gap-1.5 font-mono text-xs">
          <span
            className={`h-1.5 w-1.5 rounded-full ${online ? "bg-accent" : "bg-faint"}`}
          />
          <span className={online ? "text-accent" : "text-faint"}>
            {online ? "online" : "offline"}
          </span>
        </span>
      </div>
      <p className="mt-4 text-base font-semibold text-fg">{preview.name}</p>
      <p className="mt-0.5 font-mono text-xs text-faint">@{preview.handle}</p>
      <p className="mt-2 flex-1 font-mono text-xs leading-relaxed text-muted">
        {preview.tagline}
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-4 font-mono text-xs">
        <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-faint">
          {preview.category}
        </span>
        <span className="tabular-nums text-fg">
          ${preview.pricePerMsg.toFixed(2)}{" "}
          <span className="text-faint">USDC</span>
        </span>
      </div>
    </Card>
  );
}

/* ── Published ────────────────────────────────────────────────── */

function Published({
  draft,
  onReset,
}: {
  draft: DraftAgent;
  onReset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-5 py-20 text-center sm:px-6">
      <div className="spotlight mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line text-accent">
        <Check size={22} />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-fg">
        Agent submitted
      </h1>
      <p className="mx-auto mt-2 max-w-sm font-mono text-xs leading-relaxed text-muted">
        {draft.name || "Your agent"} is queued for the catalog. Public
        publishing opens after review.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button variant="secondary" size="md" href="/#catalog">
          Back to catalog
        </Button>
        <Button size="md" onClick={onReset}>
          Build another
        </Button>
      </div>
    </div>
  );
}

/* ── Shared form bits ─────────────────────────────────────────── */

function StepShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-fg">{title}</h2>
      <p className="mt-1 max-w-lg font-mono text-xs leading-relaxed text-muted">
        {hint}
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block font-mono text-[0.7rem] text-faint">
          {hint}
        </span>
      )}
    </label>
  );
}

function TextInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-xl border border-line bg-surface-2 px-3.5 font-mono text-sm text-fg placeholder:text-faint focus:border-line-strong focus:outline-none ${className}`}
      {...props}
    />
  );
}

function TextArea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-sm leading-relaxed text-fg placeholder:text-faint focus:border-line-strong focus:outline-none ${className}`}
      {...props}
    />
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
        active
          ? "border-fg/25 bg-surface-2 text-fg"
          : "border-line text-muted hover:border-line-strong hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
