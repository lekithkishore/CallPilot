import { useEffect, useState } from "react";
import {
  startCall as createCall,
  saveStage,
  closeCall as finishCall,
  getCalls,
  getCoachAdvice,
  type CallRecord as ApiCallRecord,
} from "./api";
import {
  Phone,
  PhoneOff,
  Clock,
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  History,
  LayoutDashboard,
  MessageSquare,
  Building2,
  UserRound,
  ChevronRight,
  CalendarCheck,
  Target,
  Menu,
  X,
} from "lucide-react";

const stages = [
  { name: "Opening", purpose: "Reach the right person and introduce yourself clearly. Record if you reached a switchboard, a busy person, or the wrong contact.", examples: ["Hello.", "Yes, speaking.", "You are speaking to the wrong person."], outcomes: ["Right person reached", "Wrong contact", "Unavailable"] },
  { name: "Purpose", purpose: "Explain briefly why you are calling, then listen for questions about the reason for the call.", examples: ["So what is that regarding? What do I need to help you with in this?", "Where would it have come from?", "What is your company providing?"], outcomes: ["Purpose explained", "Asked for details", "Not relevant"] },
  { name: "Permission", purpose: "Check whether the prospect is willing and able to speak now. If not, capture a specific callback time when offered.", examples: ["Ah, yes. Go ahead.", "Maybe can you call after 30 minutes, because I was in a call actually.", "Can you call me tomorrow?"], outcomes: ["Permission granted", "Callback requested", "Declined"] },
  { name: "Their business", purpose: "Ask about the prospect's company or role before pitching. Let them correct assumptions or point you to the responsible person.", examples: ["I'll let you know the concerned person. You can call that person directly.", "What exactly do you need to know?", "I am not on the line manager side."], outcomes: ["Shared context", "Referred to someone else", "Limited discussion"] },
  { name: "Their need", purpose: "Capture the prospect's own words about goals, challenges, priorities, or lack of need. Do not replace their words with your interpretation.", examples: ["We would have a clearer idea of our products and where to push them.", "I'll be able to give you a few minutes, where I'll explain to you what R&D we have done in our company.", "The biggest challenge is manpower requirement. Skilled manpower."], outcomes: ["Need or goal captured", "Exploring options", "No need stated"] },
  { name: "Objection", purpose: "Hear the reason for hesitation without arguing. Clarify whether the concern is relevance, timing, contact, or a request for information.", examples: ["I am sorry. I am not interested in this at the moment.", "It would be better if you can send me on WhatsApp.", "No ma'am, you are speaking to the wrong person."], outcomes: ["Concern clarified", "Send information requested", "Not interested"] },
  { name: "Next step", purpose: "Agree on one concrete next action, including who will do it and when or through which channel.", examples: ["You send it on WhatsApp to me. Let me have a look at it and come back to you.", "If you can call me anytime after around 3 PM, I'll be able to give you a few minutes.", "Tuesday is a good day. After 2 PM."], outcomes: ["Meeting or next step agreed", "Follow-up agreed", "No next step"] },
  { name: "Close", purpose: "Record the actual outcome, next step, stage reached, and the prospect's own words from the needs discussion when possible.", examples: ["Thank you.", "Send me the details, let's have a look.", "I'm not interested in this at the moment."], outcomes: ["Next step agreed", "Follow-up needed", "Ended without next step"] },
];

type StageRecord = {
  result: string;
  words: string;
};

type CallRecord = {
  id: string;
  prospect: string;
  company: string;
  date: string;
  stage: number;
  outcome: string;
  notes: Record<number, StageRecord>;
};

const outcomeOptions = [
  "Meeting booked",
  "Follow-up scheduled",
  "Information requested",
  "Not interested",
  "Wrong contact",
  "Call ended early",
];

function App() {
  const [page, setPage] = useState<"call" | "history">("call");
  const [stageIndex, setStageIndex] = useState(0);
  const [prospect, setProspect] = useState("");
  const [company, setCompany] = useState("");
  const [started, setStarted] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState("");
  const [words, setWords] = useState("");
  const [notes, setNotes] = useState<Record<number, StageRecord>>({});
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [showClose, setShowClose] = useState(false);
  const [outcome, setOutcome] = useState("Follow-up scheduled");
  const [nextStep, setNextStep] = useState("");
  const [isSavingClose, setIsSavingClose] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState("");
  const [isLoadingCoach, setIsLoadingCoach] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const stage = stages[stageIndex];

  function fromApiCall(call: ApiCallRecord): CallRecord {
    return {
      id: call.id,
      prospect: call.prospect_name,
      company: call.company_name ?? "",
      date: new Date(call.ended_at || call.started_at).toLocaleString(),
      stage: call.current_stage || 1,
      outcome: call.outcome || (call.status === "in_progress" ? "In progress" : "No outcome"),
      notes: {},
    };
  }

  async function requestCoachAdvice() {
    setIsLoadingCoach(true);
    setCoachAdvice("");
    try {
      const advice = await getCoachAdvice({
        stage_name: stage.name,
        purpose: stage.purpose,
        result: selectedResult,
        prospect_words: words.trim(),
      });
      setCoachAdvice(advice);
    } catch (error) {
      setCoachAdvice(error instanceof Error ? error.message : "AI guidance is unavailable right now.");
    } finally {
      setIsLoadingCoach(false);
    }
  }

  async function refreshCalls() {
    try {
      const savedCalls = await getCalls();
      setCalls(savedCalls.map(fromApiCall));
    } catch (error) {
      console.error("Failed to load call history:", error);
    }
  }

  useEffect(() => {
    void refreshCalls();
  }, []);

async function startCall() {
  if (!prospect.trim()) {
    alert("Please enter the prospect's name.");
    return;
  }

  try {
    const call = await createCall(prospect.trim(), company.trim());

    // Keep the database ID for saving stages and closing this call.
    setActiveCallId(call.id);

    setStarted(true);
    setStageIndex(0);
    setNotes({});
    setSelectedResult("");
    setWords("");
    setNextStep("");
    setCoachAdvice("");

  } catch (error) {
    console.error("Failed to start call:", error);

    alert(
      error instanceof Error
        ? error.message
        : "Could not start the call. Please try again."
    );
  }
}
async function saveCurrentStage(): Promise<boolean> {
  if (!activeCallId) {
    alert("No active call found.");
    return false;
  }

  const stageNumber = stageIndex + 1;

  const currentStage: StageRecord = {
    result: selectedResult,
    words: words.trim(),
  };

  try {
    // Save the stage to Supabase before proceeding.
    await saveStage(
      activeCallId,
      stageNumber,
      selectedResult || null,
      words.trim(),
      currentStage
    );

    // Update local state after the database save succeeds.
    setNotes((previous) => ({
      ...previous,
      [stageIndex]: currentStage,
    }));

    console.log(`Stage ${stageNumber} saved successfully.`);

    return true;
  } catch (error) {
    console.error("Failed to save stage:", error);

    alert(
      "Failed to save this stage. Your current stage is unchanged. Please try again."
    );

    return false;
  }
}

async function goToStage(index: number) {
  // Ignore invalid stage numbers.
  if (index < 0 || index >= stages.length) {
    return;
  }

  // Nothing to do if we're already on this stage.
  if (index === stageIndex) {
    return;
  }

  // Save the current stage before leaving it.
  const saved = await saveCurrentStage();

  // Never navigate away if saving fails.
  if (!saved) {
    return;
  }

  // Load the target stage's previously saved values.
  const existing = notes[index];

  setStageIndex(index);
  setSelectedResult(existing?.result ?? "");
  setWords(existing?.words ?? "");
}

async function nextStage() {
  // Save before moving to the next stage.
  const saved = await saveCurrentStage();

  if (!saved) {
    return;
  }

  if (stageIndex < stages.length - 1) {
    const nextIndex = stageIndex + 1;
    const existing = notes[nextIndex];

    setStageIndex(nextIndex);
    setSelectedResult(existing?.result ?? "");
    setWords(existing?.words ?? "");
  } else {
    // All eight stages have been reached.
    setShowClose(true);
  }
}

  async function closeCall() {
    if (!activeCallId || isSavingClose) return;
    setIsSavingClose(true);
    try {
      const saved = await saveCurrentStage();
      if (!saved) return;

      const finalNotes = {
        ...notes,
        [stageIndex]: { result: selectedResult, words: words.trim() },
      };
      const summary = Object.entries(finalNotes)
        .filter(([, item]) => item.words || item.result)
        .map(([index, item]) => `Stage ${Number(index) + 1}: ${item.result || "No result selected"}${item.words ? ` — Prospect: ${item.words}` : ""}`)
        .join("\\n");

      await finishCall(activeCallId, outcome, nextStep, summary);
      await refreshCalls();
      setStarted(false);
      setActiveCallId(null);
      setShowClose(false);
      setPage("history");
      setStageIndex(0);
      setNotes({});
      setSelectedResult("");
      setWords("");
      setProspect("");
      setCompany("");
      setNextStep("");
    } catch (error) {
      console.error("Failed to close call:", error);
      alert(error instanceof Error ? error.message : "Could not save the call. Please try again.");
    } finally {
      setIsSavingClose(false);
    }
  }

    function startNewCall() {
    setPage("call");
    setStarted(false);
    setStageIndex(0);
    setSelectedResult("");
    setWords("");
    setNotes({});
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-800">
      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8">
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Phone size={21} />
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              CallPilot
            </h1>
            <p className="text-xs text-slate-500">
              Your guide to better conversations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Workspace ready
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            BK
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside
          className={`${sidebarOpen ? "block" : "hidden"} fixed inset-y-[68px] left-0 z-20 w-64 border-r border-slate-200 bg-white p-5 lg:sticky lg:top-[68px] lg:block lg:h-[calc(100vh-68px)] lg:w-60 lg:shrink-0`}
        >
          <p className="mb-4 px-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Workspace
          </p>

          <button
            onClick={() => {
              setPage("call");
              setSidebarOpen(false);
            }}
            className={`mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
              page === "call"
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <LayoutDashboard size={19} />
            Live call
            {page === "call" && (
              <ChevronRight className="ml-auto" size={17} />
            )}
          </button>

          <button
            onClick={() => {
              setPage("history");
              setSidebarOpen(false);
              void refreshCalls();
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
              page === "history"
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <History size={19} />
            Call history
            {page === "history" && (
              <ChevronRight className="ml-auto" size={17} />
            )}
          </button>

          <div className="mt-10 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
              <Target size={19} />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              Stay on track
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Follow each stage, capture important words, and finish every call
              with a clear outcome.
            </p>
          </div>

          <div className="absolute bottom-5 left-5 right-5 hidden border-t border-slate-100 pt-4 lg:block">
            <p className="text-xs text-slate-400">CallPilot · Prototype</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {page === "call" ? (
            <>
              <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                    Sales workspace
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                    Live call assistant
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    A clear next step for every conversation.
                  </p>
                </div>

                {started && (
                  <button
                    onClick={() => setShowClose(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-100"
                  >
                    <PhoneOff size={17} />
                    End call
                  </button>
                )}
              </div>

              {!started ? (
                <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-10">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <Phone size={26} />
                  </div>

                  <h3 className="text-xl font-bold text-slate-900">
                    Start a new call
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Add the prospect's details before starting your guided
                    conversation.
                  </p>

                  <form
                    className="mt-7 space-y-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      startCall();
                    }}
                  >
                    <div>
                      <label
                        htmlFor="prospect"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Prospect name *
                      </label>
                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 focus-within:border-indigo-400">
                        <UserRound size={18} className="text-slate-400" />
                        <input
                          id="prospect"
                          value={prospect}
                          onChange={(event) => setProspect(event.target.value)}
                          placeholder="e.g. Alex Morgan"
                          className="w-full py-3 text-sm outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="company"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Company
                      </label>
                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 focus-within:border-indigo-400">
                        <Building2 size={18} className="text-slate-400" />
                        <input
                          id="company"
                          value={company}
                          onChange={(event) => setCompany(event.target.value)}
                          placeholder="e.g. Acme Solutions"
                          className="w-full py-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    >
                      <Phone size={17} />
                      Start guided call
                      <ArrowRight size={17} />
                    </button>
                  </form>

                  <div className="mt-6 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                    <CheckCircle2
                      size={18}
                      className="mt-0.5 shrink-0 text-emerald-600"
                    />
                    <p className="text-xs leading-5 text-slate-500">
                      Eight structured stages. Quick-tap outcomes. Space for the
                      prospect's actual words.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-medium text-slate-400">
                          CURRENT PROSPECT
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                          {prospect}
                        </h3>
                        <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                          <Building2 size={15} />
                          {company || "Company not specified"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                        Call in progress
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          Call roadmap
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Stage {stageIndex + 1} of {stages.length}
                        </p>
                      </div>
                      <span className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                        {Math.round(
                          ((stageIndex + 1) / stages.length) * 100
                        )}
                        % through stages
                      </span>
                    </div>

                    <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all"
                        style={{
                          width: `${((stageIndex + 1) / stages.length) * 100}%`,
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
                      {stages.map((item, index) => {
                        const completed = Boolean(notes[index]?.result);
                        const active = index === stageIndex;

                        return (
                          <button
                            key={item.name}
                            onClick={() => goToStage(index)}
                            className={`rounded-xl border p-2 text-center transition ${
                              active
                                ? "border-indigo-300 bg-indigo-50"
                                : completed
                                  ? "border-emerald-200 bg-emerald-50"
                                  : "border-slate-100 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="mb-2 flex justify-center">
                              {completed ? (
                                <CheckCircle2
                                  size={19}
                                  className="text-emerald-600"
                                />
                              ) : active ? (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                                  {index + 1}
                                </div>
                              ) : (
                                <Circle
                                  size={19}
                                  className="text-slate-300"
                                />
                              )}
                            </div>
                            <p
                              className={`text-[10px] font-medium sm:text-xs ${
                                active
                                  ? "text-indigo-700"
                                  : "text-slate-500"
                              }`}
                            >
                              {item.name}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
                      <div className="mb-5 flex items-center justify-between">
                        <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                          STAGE {stageIndex + 1}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Clock size={14} />
                          Caller-guided
                        </span>
                      </div>

                      <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                        {stage.name}
                      </h3>

                      <div className="mt-4 rounded-xl bg-indigo-50/70 p-4">
                        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                          What this stage is for
                        </p>
                        <p className="text-sm leading-6 text-slate-700">
                          {stage.purpose}
                        </p>
                      </div>

                      <div className="mt-7">
                        <div className="mb-3 flex items-center gap-2">
                          <MessageSquare
                            size={17}
                            className="text-indigo-600"
                          />
                          <h4 className="text-sm font-semibold text-slate-900">
                            What the prospect might say
                          </h4>
                        </div>

                        <div className="space-y-2">
                          {stage.examples.map((example) => (
                            <div
                              key={example}
                              className="rounded-xl border border-slate-100 px-4 py-3 text-sm text-slate-600"
                            >
                              “{example}”
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-7">
                        <h4 className="mb-3 text-sm font-semibold text-slate-900">
                          What happened?
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {stage.outcomes.map((item) => (
                            <button
                              key={item}
                              onClick={() => setSelectedResult(item)}
                              className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition ${
                                selectedResult === item
                                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"
                              }`}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-7">
                        <label
                          htmlFor="prospect-words"
                          className="mb-2 block text-sm font-semibold text-slate-900"
                        >
                          Prospect's actual words
                        </label>
                        <textarea
                          id="prospect-words"
                          value={words}
                          onChange={(event) => setWords(event.target.value)}
                          placeholder="Capture the important words you hear..."
                          rows={4}
                          className="w-full resize-y rounded-xl border border-slate-200 p-4 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                        <p className="mt-2 text-xs text-slate-400">
                          Keep it brief. Capture what matters, not every word.
                        </p>
                      </div>

                      <div className="mt-7 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
                        <button
                          disabled={stageIndex === 0}
                          onClick={() => goToStage(stageIndex - 1)}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowLeft size={16} />
                          Previous
                        </button>

                        <button
                          onClick={nextStage}
                          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                        >
                          {stageIndex === 7 ? "Finish call" : "Save & continue"}
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </section>

                    <aside className="space-y-5">
                      <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">
                              AI call coach
                            </h3>
                            <p className="text-xs text-slate-500">
                              Contextual guidance
                            </p>
                          </div>
                        </div>

                        <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
                          {coachAdvice || (selectedResult
                            ? `You selected "${selectedResult}". Ask for AI guidance to get a response tailored to this stage and the prospect's words.`
                            : `You're at ${stage.name.toLowerCase()}. Ask for AI guidance for a concise, stage-aware suggestion.`)}
                        </p>
                        <button
                          type="button"
                          onClick={requestCoachAdvice}
                          disabled={isLoadingCoach}
                          className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                        >
                          {isLoadingCoach ? "Generating guidance..." : "Get AI call guidance"}
                        </button>

                        <div className="mt-4 rounded-xl border border-violet-100 bg-white p-3">
                          <p className="text-xs font-semibold text-violet-700">
                            Suggested approach
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {stageIndex === 5
                              ? "Acknowledge the concern. Ask a clarifying question before responding."
                              : stageIndex === 6
                                ? "Confirm the next action, who owns it, and when it will happen."
                                : "Listen first. Ask one clear question. Avoid overwhelming the prospect."}
                          </p>
                        </div>

                        <p className="mt-3 text-[10px] text-slate-400">
                          Powered by Gemini through the backend · API key stays server-side
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                          <CalendarCheck
                            size={19}
                            className="text-indigo-600"
                          />
                          <h3 className="font-semibold text-slate-900">
                            Call checklist
                          </h3>
                        </div>

                        <div className="space-y-3">
                          {[
                            "Understand the prospect",
                            "Record key responses",
                            "Agree on next steps",
                          ].map((item, index) => (
                            <div
                              key={item}
                              className="flex items-center gap-3 text-sm text-slate-600"
                            >
                              <Circle
                                size={17}
                                className="shrink-0 text-slate-300"
                              />
                              {item}
                              <span className="ml-auto text-xs text-slate-400">
                                {index + 1}/3
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </aside>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                    Activity
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                    Call history
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Review calls saved to your workspace.
                  </p>
                </div>

                <button
                  onClick={startNewCall}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <Phone size={17} />
                  Start new call
                </button>
              </div>

              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm text-slate-500">Calls completed</p>
                  <p className="mt-3 text-3xl font-bold text-slate-900">
                    {calls.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm text-slate-500">Meetings booked</p>
                  <p className="mt-3 text-3xl font-bold text-emerald-600">
                    {calls.filter((call) => call.outcome === "Meeting booked").length}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm text-slate-500">Follow-ups</p>
                  <p className="mt-3 text-3xl font-bold text-indigo-600">
                    {calls.filter((call) =>
                      ["Follow-up scheduled", "Information requested"].includes(
                        call.outcome
                      )
                    ).length}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="font-semibold text-slate-900">
                    Recent calls
                  </h3>
                </div>

                {calls.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <History size={25} />
                    </div>
                    <h3 className="mt-4 font-semibold text-slate-800">
                      No calls yet
                    </h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                      Your completed calls will appear here. Start a guided
                      call to create your first record.
                    </p>
                    <button
                      onClick={startNewCall}
                      className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Start your first call
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr>
                          <th className="px-5 py-4 font-medium">Prospect</th>
                          <th className="px-5 py-4 font-medium">Last stage</th>
                          <th className="px-5 py-4 font-medium">Outcome</th>
                          <th className="px-5 py-4 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {calls.map((call) => (
                          <tr key={call.id} className="hover:bg-slate-50">
                            <td className="px-5 py-4">
                              <p className="font-semibold text-slate-800">
                                {call.prospect}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {call.company || "No company specified"}
                              </p>
                            </td>
                            <td className="px-5 py-4 text-slate-600">
                              {call.stage}/8 · {stages[call.stage - 1].name}
                            </td>
                            <td className="px-5 py-4">
                              <span className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700">
                                {call.outcome}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                              {call.date}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {showClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                Finish this call
              </h3>
              <button
                onClick={() => setShowClose(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close dialog"
              >
                <X size={19} />
              </button>
            </div>

            <p className="mb-5 text-sm leading-6 text-slate-500">
              Record the outcome so the next action is clear.
            </p>

            <label
              htmlFor="outcome"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Call outcome
            </label>
            <select
              id="outcome"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400"
            >
              {outcomeOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>

            <label htmlFor="next-step" className="mt-5 mb-2 block text-sm font-semibold text-slate-700">
              Next step (optional)
            </label>
            <textarea
              id="next-step"
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value)}
              placeholder="e.g. Send the report by email and call Tuesday after 2 PM"
              rows={3}
              className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400"
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowClose(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Keep calling
              </button>
              <button
                onClick={closeCall}
                disabled={isSavingClose}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSavingClose ? "Saving..." : "Save & finish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;