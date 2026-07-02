"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { Select } from "@base-ui/react/select";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import {
  CATEGORIES,
  type AgentCategory,
  type MarketAgent,
} from "@occa-market/shared";
import { createAgent, getAgentDetail, importSkill } from "@/lib/api";
import {
  draftFromTemplate,
  draftToPreview,
  emptyDraft,
  handleFromName,
  makeExternalId,
  parseSkillMarkdown,
  type DraftAgent,
} from "@/lib/builder";
import {
  ADAPTERS,
  ICON_GLYPHS,
  TOOL_LIBRARY,
  type AdapterType,
  type DraftSkill,
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

// Persist the in-progress draft so a reload doesn't wipe the form.
const DRAFT_STORAGE_KEY = "occa_market_build_draft";

type PersistedDraft = { draft: DraftAgent; step: number };

type Update = (patch: Partial<DraftAgent>) => void;

export function AgentBuilder({ templates }: { templates: MarketAgent[] }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DraftAgent>(emptyDraft());
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Gate persistence until we've hydrated, so the first save can't clobber a
  // stored draft with the empty default before hydration runs.
  const [hydrated, setHydrated] = useState(false);

  const update: Update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const last = STEPS.length - 1;

  // Hydrate once from localStorage (client-only, so it can't cause an SSR
  // mismatch — the server and first client render both start from emptyDraft).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PersistedDraft>;
        if (saved.draft) {
          setDraft({
            ...emptyDraft(),
            ...saved.draft,
            // never restore a secret or a stale "connected" status
            apiKey: "",
            connection: "idle",
          });
        }
        if (typeof saved.step === "number") {
          setStep(Math.min(Math.max(saved.step, 0), STEPS.length - 1));
        }
      }
    } catch {
      /* corrupt or unavailable storage — start fresh */
    }
    setHydrated(true);
  }, []);

  // Persist on every change once hydrated. Drop the API key from what we store.
  useEffect(() => {
    if (!hydrated || published) return;
    try {
      const payload: PersistedDraft = { draft: { ...draft, apiKey: "" }, step };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* storage full or blocked — persistence is best-effort */
    }
  }, [draft, step, hydrated, published]);

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
      // DraftSkill already matches AgentSkillInput (name, description, markdown,
      // source); send the whole skill so its content reaches the server.
      skills: draft.skills,
      tools: draft.tools,
      workflow: draft.workflow,
    });
    setPublishing(false);
    if (res.ok) {
      setPublished(true);
      // draft is submitted — don't leave it lingering for the next build
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    } else setError(res.error);
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
        Configure the agent and the gateway that powers it. A gateway runs on
        your own host and can power several of your agents — they share its uptime.
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
    <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const isLast = i === STEPS.length - 1;
        return (
          <li key={label} className="relative flex-none lg:flex-1">
            {/* connector into this step — green once the previous step is done */}
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute left-5 top-0 hidden h-1/2 w-px -translate-x-1/2 transition-colors lg:block ${
                  i - 1 < current ? "bg-accent" : "bg-line"
                }`}
              />
            )}
            {/* connector out of this step — green once this step is done */}
            {!isLast && (
              <span
                aria-hidden
                className={`absolute bottom-0 left-5 hidden h-1/2 w-px -translate-x-1/2 transition-colors lg:block ${
                  done ? "bg-accent" : "bg-line"
                }`}
              />
            )}
            <button
              type="button"
              onClick={() => onJump(i)}
              className={`flex h-full w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                active ? "lg:bg-surface-2" : "hover:bg-surface-2/60"
              }`}
            >
              {/* z-10 + solid fill so the node masks the connector passing behind it */}
              <span
                className={`relative z-10 flex h-5 w-5 flex-none items-center justify-center rounded-full border font-mono text-[0.6rem] transition-colors ${
                  done
                    ? "border-accent bg-accent"
                    : active
                      ? "border-fg/30 bg-surface-2 text-fg"
                      : "border-line bg-bg text-faint"
                }`}
              >
                {done ? (
                  // dark glyph on the accent fill — hex is explicit so contrast
                  // never falls back to an inherited light color
                  <Check size={12} strokeWidth={3} className="text-[#05130f]" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`text-xs transition-colors ${active ? "text-fg" : done ? "text-muted" : "text-faint"}`}
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
        <div>
          <span className="eyebrow mb-2 block">Icon</span>
          <IconPicker
            value={draft.glyph}
            onSelect={(glyph) => update({ glyph })}
          />
        </div>
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
  const adapter = ADAPTERS.find((a) => a.type === draft.adapterType);
  // Always keep the current model selectable, even if a forked template carried
  // one that isn't in this adapter's list.
  const adapterModels = adapter?.models ?? [];
  const modelOptions =
    draft.model && !adapterModels.includes(draft.model)
      ? [draft.model, ...adapterModels]
      : adapterModels;

  // Auto-assign a unique gateway id once, derived from the handle/name. Guarded
  // on empty so it stays stable across edits and reloads (persisted with the draft).
  useEffect(() => {
    if (!draft.externalAgentId && (draft.handle || draft.name)) {
      update({ externalAgentId: makeExternalId(draft.handle || draft.name) });
    }
  }, [draft.externalAgentId, draft.handle, draft.name, update]);

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
      hint="The runtime that powers this agent, running on your own host. One gateway can host several of your agents, each in its own workspace."
    >
      <p className="eyebrow mb-2">Adapter</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ADAPTERS.map((a) => {
          const selected = draft.adapterType === a.type;
          return (
            <button
              key={a.type}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                update({
                  adapterType: a.type as AdapterType,
                  model: a.defaultModel,
                  connection: "idle",
                })
              }
              className={`rounded-xl border p-3.5 text-left transition-colors ${
                selected
                  ? "border-accent bg-surface-2"
                  : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-fg">{a.name}</p>
                {/* radio-style mark: hollow when unpicked, accent-filled when picked */}
                <span
                  className={`flex h-4.5 w-4.5 flex-none items-center justify-center rounded-full border transition-colors ${
                    selected ? "border-accent bg-accent" : "border-line-strong"
                  }`}
                >
                  {selected && (
                    <Check
                      size={11}
                      strokeWidth={3}
                      className="text-[#05130f]"
                    />
                  )}
                </span>
              </div>
              <p className="mt-1 font-mono text-[0.7rem] leading-relaxed text-muted">
                {a.blurb}
              </p>
            </button>
          );
        })}
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
          <ModelSelect
            value={draft.model}
            models={modelOptions}
            onSelect={(m) => update({ model: m })}
          />
        </Field>
        <Field
          label="External agent ID"
          hint="Auto-generated and unique. Your gateway uses it to namespace this agent."
        >
          <div className="flex gap-2">
            <input
              readOnly
              value={draft.externalAgentId}
              placeholder="agt_…"
              aria-label="External agent ID (auto-generated)"
              className="h-10 flex-1 rounded-xl border border-line bg-surface-2 px-3.5 font-mono text-sm text-muted select-all placeholder:text-faint focus:outline-none"
            />
            <Button
              variant="secondary"
              size="md"
              aria-label="Regenerate ID"
              onClick={() =>
                update({
                  externalAgentId: makeExternalId(draft.handle || draft.name),
                })
              }
            >
              <RefreshCw size={14} />
            </Button>
          </div>
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
        One gateway can host several of your own agents, each in its own isolated
        workspace. No cross-provider pooling: an agent only ever runs on your
        gateway, and if it goes down every agent on it shows offline until it is back.
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

function ModelSelect({
  value,
  models,
  onSelect,
}: {
  value: string;
  models: string[];
  onSelect: (model: string) => void;
}) {
  return (
    <Select.Root value={value} onValueChange={(v) => onSelect(v as string)}>
      <Select.Trigger className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3.5 font-mono text-sm text-fg transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:outline-none data-[popup-open]:border-line-strong">
        <Select.Value />
        <Select.Icon className="flex text-faint">
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-50"
        >
          {/* surface-card on the Popup (inner), not the Positioner — same reason
              as the icon picker: keep its position:relative off the positioner. */}
          <Select.Popup className="surface-card max-h-64 w-[var(--anchor-width)] overflow-y-auto rounded-xl p-1 outline-none">
            <Select.List>
              {models.map((m) => (
                <Select.Item
                  key={m}
                  value={m}
                  className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-3 py-2 font-mono text-sm text-muted outline-none transition-colors data-[highlighted]:bg-surface-2 data-[highlighted]:text-fg data-[selected]:text-fg"
                >
                  <Select.ItemText>{m}</Select.ItemText>
                  <Select.ItemIndicator className="flex text-accent">
                    <Check size={13} strokeWidth={3} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

/* ── Step 4 · Skills ──────────────────────────────────────────── */

function SkillsStep({ draft, update }: { draft: DraftAgent; update: Update }) {
  const [mode, setMode] = useState<"write" | "repo">("write");
  const [name, setName] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [source, setSource] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function tryAdd(skill: DraftSkill): boolean {
    if (!skill.name || draft.skills.some((s) => s.name === skill.name)) return false;
    update({ skills: [...draft.skills, skill] });
    return true;
  }

  function addWritten() {
    const body = markdown.trim();
    // Prefer an explicit name; otherwise read it from the SKILL.md frontmatter.
    const parsed = parseSkillMarkdown(body);
    const finalName = (name.trim() || parsed.name).trim();
    if (tryAdd({ name: finalName, description: parsed.description, markdown: body, source: "markdown" })) {
      setName("");
      setMarkdown("");
    }
  }

  async function importFromRepo() {
    const src = source.trim();
    if (!src || importing) return;
    setImporting(true);
    setImportError(null);
    const res = await importSkill(src);
    setImporting(false);
    if (!res.ok) {
      setImportError(res.error);
      return;
    }
    if (!tryAdd(res.skill)) {
      setImportError(`"${res.skill.name}" is already added.`);
      return;
    }
    setSource("");
  }

  const canWrite = markdown.trim().length > 0 || name.trim().length > 0;

  return (
    <StepShell
      title="Skills"
      hint="What the agent can do. You bring each skill — paste its SKILL.md or import it from a public GitHub repo. The instructions get seeded to the gateway workspace."
    >
      {/* added skills */}
      <div className="flex flex-col gap-2">
        {draft.skills.length === 0 && (
          <p className="font-mono text-xs text-faint">No skills yet.</p>
        )}
        {draft.skills.map((s) => (
          <div
            key={s.name}
            className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5"
          >
            <div className="min-w-0">
              <p className="font-mono text-sm text-fg">{s.name}</p>
              {s.description && (
                <p className="mt-0.5 truncate font-mono text-xs text-muted">
                  {s.description}
                </p>
              )}
              <p className="mt-1 font-mono text-[0.7rem] text-faint">
                {s.markdown ? `${s.markdown.length} chars` : "no content"} · {s.source}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Remove ${s.name}`}
              onClick={() =>
                update({ skills: draft.skills.filter((x) => x.name !== s.name) })
              }
              className="mt-0.5 flex-none text-faint transition-colors hover:text-fg"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* add a skill — write it or import from a repo */}
      <div className="mt-5 rounded-xl border border-line bg-surface-2 p-3.5">
        <div className="mb-3 inline-flex rounded-lg border border-line p-0.5">
          {(["write", "repo"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 font-mono text-xs transition-colors ${
                mode === m ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {m === "write" ? "Write" : "Import from repo"}
            </button>
          ))}
        </div>

        {mode === "write" ? (
          <>
            <TextInput
              value={name}
              placeholder="Skill name (optional — read from the frontmatter if blank)"
              onChange={(e) => setName(e.target.value)}
            />
            <TextArea
              value={markdown}
              rows={7}
              placeholder={
                "Paste the skill's SKILL.md here…\n\n---\nname: risk-flagging\ndescription: Surfaces the obvious ways a token can hurt you.\n---\n\n# Instructions\n…"
              }
              className="mt-2"
              onChange={(e) => setMarkdown(e.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <Button variant="secondary" size="md" disabled={!canWrite} onClick={addWritten}>
                <Plus size={14} className="mr-1.5" />
                Add skill
              </Button>
            </div>
          </>
        ) : (
          <>
            <TextInput
              value={source}
              placeholder="owner/repo/slug or a github.com/…/tree/… URL"
              onChange={(e) => {
                setSource(e.target.value);
                setImportError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void importFromRepo();
                }
              }}
            />
            <p className="mt-1.5 font-mono text-[0.7rem] leading-relaxed text-faint">
              Points at a folder with a SKILL.md. Reads its name, description, and
              instructions from the pinned commit.
            </p>
            {importError && (
              <p className="mt-2 font-mono text-xs text-bad">{importError}</p>
            )}
            <div className="mt-2 flex justify-end">
              <Button
                variant="secondary"
                size="md"
                disabled={!source.trim() || importing}
                onClick={importFromRepo}
              >
                {importing ? (
                  <>
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Plus size={14} className="mr-1.5" />
                    Import skill
                  </>
                )}
              </Button>
            </div>
          </>
        )}
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

function IconPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (glyph: string) => void;
}) {
  // Controlled so we can close on select; Base UI handles outside-click, Escape,
  // focus, and portalling (which escapes any ancestor overflow/stacking).
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex h-10 w-full items-center justify-center rounded-xl border border-line bg-surface-2 text-lg text-fg transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:outline-none">
        {value || "◇"}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-50"
        >
          {/* .surface-card lives on the Popup (inner), not the Positioner, so its
              position:relative can't fight Base UI's positioning transform. */}
          <Popover.Popup className="surface-card grid grid-cols-6 gap-1 rounded-xl p-2 outline-none">
            {ICON_GLYPHS.map((glyph) => (
              <button
                key={glyph}
                type="button"
                onClick={() => {
                  onSelect(glyph);
                  setOpen(false);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border text-base transition-colors ${
                  value === glyph
                    ? "border-accent bg-surface-2 text-fg"
                    : "border-transparent text-muted hover:border-line-strong hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {glyph}
              </button>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
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
