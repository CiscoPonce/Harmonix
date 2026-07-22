'use client';

import { safeSpotifyUrl, type SpotifyExportJobDto } from '@/lib/spotifyContracts';
import { Button } from '@/components/ui/Button';

export interface SpotifyMatchReportProps {
  job: SpotifyExportJobDto;
  onFinish?: () => void;
}

function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'matched':
      return 'Matched';
    case 'cached':
      return 'Matched (cached)';
    case 'unmatched':
      return 'Unmatched';
    case 'export_failed':
      return 'Export failed';
    default:
      return outcome;
  }
}

function reasonLabel(reason: string | null): string | null {
  if (!reason) return null;
  switch (reason) {
    case 'duration_conflict':
      return 'Duration didn’t match Spotify’s version closely enough';
    case 'ambiguous_tie':
      return 'Several Spotify matches looked equally likely';
    case 'weak_candidate':
      return 'No confident Spotify match found';
    case 'edition_conflict':
      return 'Edition/version conflict (live, remix, etc.)';
    case 'missing_title':
      return 'Missing song title';
    case 'missing_artist':
      return 'Missing artist';
    case 'unavailable':
      return 'Unavailable in your Spotify market';
    default:
      return reason.replace(/_/g, ' ');
  }
}

function rowTitle(row: {
  source_identity: string;
  title?: string | null;
  artist?: string | null;
}): string {
  if (row.title && row.artist) return `${row.title} — ${row.artist}`;
  if (row.title) return row.title;
  return row.source_identity.replace(/^harmonix:/, '');
}

export function SpotifyMatchReport({ job, onFinish }: SpotifyMatchReportProps) {
  const rows = job.report?.rows ?? [];
  const destination = safeSpotifyUrl(job.destination_url);
  const total = job.total_count;
  const matched = job.matched_count;
  const unmatched = job.unmatched_count;
  const exported = job.exported_count;

  let summary =
    job.safe_reason === 'zero_matches'
      ? 'No tracks were confidently matched. Review the unmatched tracks and try again later.'
      : `Matched ${matched} of ${total}`;

  if (job.stage === 'partial' || job.partial_state === 'partially_added') {
    summary = `Exported ${exported} of ${matched} matched tracks`;
  } else if (job.partial_state === 'no_create' && job.stage === 'failed') {
    summary = 'The export couldn’t be completed. No new playlist was created. Try again.';
  } else if (job.partial_state === 'created_empty') {
    summary = 'A Spotify playlist was created but no tracks were added yet.';
  }

  return (
    <section
      className="w-full max-w-[800px] space-y-4 rounded-xl border border-[#D7E0DA] bg-white p-5 dark:border-[#2A3530] dark:bg-[#171E1B]"
      aria-label="Spotify export match report"
    >
      <header className="space-y-1">
        <h2 className="text-base font-bold text-[#121612] dark:text-[#F2F5F3]">Export report</h2>
        <p className="text-sm text-[#4A554E] dark:text-[#A8B5AE]">{summary}</p>
        <p className="text-sm text-[#4A554E] dark:text-[#A8B5AE]">
          Unmatched {unmatched}
          {job.failed_count > 0 ? ` · Failed ${job.failed_count}` : ''}
        </p>
      </header>

      <ul className="max-h-72 space-y-2 overflow-y-auto" role="list">
        {rows.map((row) => (
          <li
            key={row.source_identity}
            className="flex items-start justify-between gap-3 rounded-lg border border-[#E6EBE8] px-3 py-2 text-sm dark:border-[#24302B]"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-[#121612] dark:text-[#F2F5F3]">
                {rowTitle(row)}
              </p>
              {reasonLabel(row.reason) ? (
                <p className="text-xs text-[#6B756F] dark:text-[#8A9690]">
                  {reasonLabel(row.reason)}
                </p>
              ) : null}
            </div>
            <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-[#0B6B3A] dark:text-[#3DCF7A]">
              {outcomeLabel(row.outcome)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {destination ? (
          <a href={destination} target="_blank" rel="noopener noreferrer">
            <Button variant="primary" type="button">
              Open in Spotify
            </Button>
          </a>
        ) : null}
        {onFinish ? (
          <Button variant="secondary" type="button" onClick={onFinish}>
            Finish export
          </Button>
        ) : null}
      </div>
    </section>
  );
}
