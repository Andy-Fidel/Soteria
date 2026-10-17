import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  formatSummaryAsMarkdown,
  summarizeTranscript,
  summaryFromJson,
  summaryToJson,
  type SermonSummary,
} from "@/lib/summarize"
import type {
  SermonSession,
  SessionDetection,
  SessionTranscriptSegment,
  SessionNote,
} from "@/types/session"
import { SummaryTab } from "./session-detail/(tabs)/summary-tab"
import { TranscriptTab } from "./session-detail/(tabs)/transcript-tab"
import { DetectionsTab } from "./session-detail/(tabs)/detections-tab"
import { StatsTab } from "./session-detail/(tabs)/stats-tab"
import { SessionMetadata } from "./session-detail/(components)/session-metadata"
import { SessionExportMenu } from "./session-detail/(components)/session-export-menu"
import { useTranscriptEditor } from "./session-detail/(hooks)/use-transcript-editor"
import type { DetailTab } from "./session-detail/(lib)/types"
import { SessionHeader } from "./session-detail/(components)/session-header"

interface SessionDetailProps {
  sessionId: number
  sessionTitle: string
  initialTab?: DetailTab
  onBack: () => void
}

export function SessionDetail(props: SessionDetailProps) {
  return <SessionDetailContent key={props.sessionId} {...props} />
}

function SessionDetailContent({
  sessionId,
  sessionTitle,
  initialTab,
  onBack,
}: SessionDetailProps) {
  const [tab, setTab] = useState<DetailTab>(initialTab ?? "summary")
  const [session, setSession] = useState<SermonSession | null>(null)
  // Bumped after a lazy audio merge so the <audio> element remounts and
  // reloads the freshly-written audio.mp3 (the path string is unchanged).
  const [audioNonce, setAudioNonce] = useState(0)
  const [detections, setDetections] = useState<SessionDetection[]>([])
  const [transcript, setTranscript] = useState<SessionTranscriptSegment[]>([])
  const [notes, setNotes] = useState<SessionNote[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<SermonSummary | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summaryCopied, setSummaryCopied] = useState(false)
  const [showAllDetections, setShowAllDetections] = useState(false)
  const editor = useTranscriptEditor(transcript, setTranscript)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      invoke<SermonSession>("get_session", { id: sessionId }),
      invoke<SessionDetection[]>("get_session_detections", { sessionId }),
      invoke<SessionTranscriptSegment[]>("get_session_transcript", {
        sessionId,
      }),
      invoke<SessionNote[]>("get_session_notes", { sessionId }),
    ])
      .then(([sess, dets, trans, n]) => {
        if (cancelled) return
        setSession(sess)
        setDetections(dets)
        setTranscript(trans)
        setNotes(n)
        setSummary(summaryFromJson(sess.summary))
        setLoading(false)

        // Lazily merge any leftover audio segments (e.g. the app reloaded or
        // crashed before End Session). Skip live sessions — their current
        // segment is still being written. Refresh audioPath after merging.
        if (sess.status !== "live") {
          void import("@/lib/finalize-recording")
            .then(({ ensureSessionAudioMerged }) =>
              ensureSessionAudioMerged(sessionId).then((path) => {
                if (cancelled) return
                setSession((s) => (s ? { ...s, audioPath: path } : s))
                setAudioNonce((n) => n + 1)
              })
            )
            .catch((error) =>
              console.warn("[session] audio merge failed:", error)
            )
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const handleEndSession = async () => {
    try {
      await invoke("end_session", { id: sessionId })
      setSession((s) => (s ? { ...s, status: "completed" as const } : null))
      const { generateAndPersistSummary } = await import("@/lib/summarize")
      const result = await generateAndPersistSummary(sessionId)
      if (result) setSummary(result)
    } catch (e) {
      console.error("Failed to end session:", e)
    }
  }

  const handleSummarize = async () => {
    setSummaryError(null)
    setSummarizing(true)
    setTab("summary")
    try {
      const text = transcript.map((s) => s.text).join(" ")
      if (!text.trim()) {
        throw new Error("No transcript to summarize.")
      }
      const presentedVerses = detections
        .filter((d) => d.wasPresented)
        .map((d) => d.verseRef)
      const result = await summarizeTranscript(text, presentedVerses)
      setSummary(result)
      await invoke("update_session_summary", {
        id: sessionId,
        summary: summaryToJson(result),
      }).catch((e) => console.warn("[summary] persist failed:", e))
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err)
      setSummaryError(msg || "Summarization failed.")
      console.error("[summarize]", err)
    } finally {
      setSummarizing(false)
    }
  }

  const handleCopySummary = () => {
    if (summary) {
      const text = formatSummaryAsMarkdown(summary)
      navigator.clipboard.writeText(text)
      setSummaryCopied(true)
      setTimeout(() => setSummaryCopied(false), 2000)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <SessionHeader
        sessionTitle={sessionTitle}
        status={session?.status}
        tab={tab}
        onBack={onBack}
        onEndSession={handleEndSession}
        onTabChange={setTab}
        exportMenu={
          <SessionExportMenu
            sessionTitle={sessionTitle}
            sessionId={sessionId}
            detections={detections}
            notes={notes}
            transcript={transcript}
            summarizing={summarizing}
            onSummarize={handleSummarize}
          />
        }
        metadata={
          <SessionMetadata
            session={session}
            sessionId={sessionId}
            setSession={setSession}
          />
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        )}
        {!loading && tab === "summary" && (
          <SummaryTab
            summary={summary}
            summarizing={summarizing}
            summaryError={summaryError}
            summaryCopied={summaryCopied}
            transcript={transcript}
            session={session}
            handleSummarize={handleSummarize}
            handleCopySummary={handleCopySummary}
          />
        )}
        {!loading && tab === "transcript" && (
          <TranscriptTab
            session={session}
            sessionId={sessionId}
            audioNonce={audioNonce}
            transcript={transcript}
            editor={editor}
          />
        )}
        {!loading && tab === "detections" && (
          <DetectionsTab
            detections={detections}
            showAllDetections={showAllDetections}
            onToggle={() => setShowAllDetections((v) => !v)}
          />
        )}
        {!loading && tab === "stats" && (
          <StatsTab detections={detections} transcript={transcript} />
        )}
      </div>
    </div>
  )
}
