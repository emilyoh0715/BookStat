import type { ReadingStatus } from '../types';

const LABELS: Record<ReadingStatus, string> = {
  reading: '읽는 중',
  'want-to-read': '읽고 싶음',
  finished: '다 읽음',
  paused: '잠시 멈춤',
};

export default function StatusBadge({ status }: { status: ReadingStatus }) {
  return <span className={`status-badge status-${status}`}>{LABELS[status]}</span>;
}
