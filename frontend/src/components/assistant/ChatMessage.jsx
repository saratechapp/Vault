import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, ChevronDown, Copy, Check } from 'lucide-react';
import { Table, DynamicIcon, Avatar } from '../ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { QuickActionCard } from './QuickActionCard.jsx';

const TONE_CLASS = { success: 'text-success', danger: 'text-danger', warning: 'text-warning' };
const TONE_BADGE_CLASS = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-brand-500/15 text-brand-500',
  neutral: 'bg-tint/[0.08] text-subtle',
};

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function responseToPlainText(response) {
  const lines = [];
  if (response.heading) lines.push(response.headingValue ? `${response.heading}: ${response.headingValue}` : response.heading);
  if (response.text) lines.push(response.text);
  (response.rows || []).forEach((r) => lines.push(`• ${r.label} ${r.value}`));
  (response.table?.rows || []).forEach((r) => lines.push(`• ${response.table.columns.map((c) => r[c.key]).join(' · ')}`));
  if (response.note) lines.push(response.note);
  return lines.join('\n');
}

function CopyButton({ response }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy response"
      onClick={() => {
        navigator.clipboard?.writeText(responseToPlainText(response));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md p-1 text-subtle opacity-0 transition hover:bg-tint/[0.06] hover:text-fg group-hover:opacity-100"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function AssistantBubble({ response }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasBody = Boolean(response.text || response.rows?.length || response.table || response.note);
  const badgeTone = TONE_BADGE_CLASS[response.tone] || TONE_BADGE_CLASS.info;

  return (
    <div className="group min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-line bg-surface-2 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {response.heading && (
            <p className="font-display text-sm font-semibold text-fg">
              {response.heading}
              {response.headingValue && <span className="ml-2 text-base font-bold">{response.headingValue}</span>}
            </p>
          )}
          {response.text && <p className="mt-1 whitespace-pre-line text-sm leading-snug text-muted">{response.text}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <CopyButton response={response} />
          {hasBody && (
            <button type="button" onClick={() => setCollapsed((c) => !c)} className="rounded-md p-1 text-subtle transition hover:bg-tint/[0.06] hover:text-fg" title={collapsed ? 'Expand' : 'Collapse'}>
              <ChevronDown size={13} className={`transition ${collapsed ? '-rotate-90' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {response.rows?.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {response.rows.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-muted">{r.label}</span>
                  <span className={`shrink-0 font-semibold tabular-nums ${TONE_CLASS[r.tone] || 'text-fg'}`}>{r.value}</span>
                </li>
              ))}
            </ul>
          )}

          {response.table && (
            <div className="mt-2.5 -mx-1 rounded-lg border border-line">
              <Table columns={response.table.columns} rows={response.table.rows} rowKey={(r) => r.id} minWidth="0" dense />
            </div>
          )}

          {response.note && (
            <p className={`mt-2.5 inline-flex items-center rounded-lg px-2 py-1 text-xs ${badgeTone}`}>{response.note}</p>
          )}

          {response.quickActions?.length > 0 && (
            <div className="mt-3 space-y-2">
              {response.quickActions.map((a, i) => <QuickActionCard key={i} label={a.label} to={a.to} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ChatMessage({ message, onFollowUp }) {
  const { user } = useAuth();

  if (message.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-end justify-end gap-2"
      >
        <div className="flex flex-col items-end">
          <div className="max-w-[min(320px,80%)] rounded-2xl rounded-tr-sm bg-brand-500 px-4 py-2 text-sm text-white shadow-sm">
            {message.text}
          </div>
          {message.timestamp && <span className="mt-1 mr-1 text-[10px] text-subtle">{formatTime(message.timestamp)}</span>}
        </div>
        <Avatar src={user?.avatar} name={user?.name} className="h-7 w-7 shrink-0 rounded-full text-[10px]" />
      </motion.div>
    );
  }

  const Icon = resolveIcon(message.response);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TONE_BADGE_CLASS[message.response.tone] || TONE_BADGE_CLASS.info}`}>
          <Icon size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <AssistantBubble response={message.response} />
          {message.timestamp && <span className="ml-1 mt-1 inline-block text-[10px] text-subtle">{formatTime(message.timestamp)}</span>}
        </div>
      </div>
      {message.response.followUps?.length > 0 && (
        <div className="ml-9 mt-2 flex flex-wrap gap-1.5">
          {message.response.followUps.map((f, i) => (
            <motion.button
              key={i}
              type="button"
              whileHover={{ y: -1 }}
              onClick={() => onFollowUp(f)}
              className="chip transition hover:border-line-strong hover:bg-tint/[0.08]"
            >
              {f.label}
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// response.icon (a lucide-react icon name) is optional — defaults to the Bot
// glyph so a response with no explicit icon still renders something sensible.
function resolveIcon(response) {
  if (!response.icon) return Bot;
  return (props) => <DynamicIcon name={response.icon} {...props} />;
}

export default ChatMessage;
