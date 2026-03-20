import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AGENDA_EVENT_DATE_ISO } from '../data/agenda';

const NOTIFICATION_POLL_INTERVAL_MS = 15_000;
const STARTING_SOON_OFFSET_MS = 5 * 60 * 1000;
const NOTIFICATION_RETENTION_AFTER_END_MS = 15 * 60 * 1000;

export type AgendaNotificationKind = 'starting-soon' | 'starting-now';

export interface AgendaNotificationSession {
  id: string;
  title: string;
  summary: string;
  venue: string;
  startTime: string;
  endTime: string;
  accent: string;
  hasLinkedPoi: boolean;
}

export interface AgendaNotificationItem {
  id: string;
  sessionId: string;
  kind: AgendaNotificationKind;
  title: string;
  summary: string;
  venue: string;
  startTime: string;
  endTime: string;
  accent: string;
  hasLinkedPoi: boolean;
  createdAt: number;
}

type UseAgendaNotificationsOptions = {
  sessions: AgendaNotificationSession[];
  enabled: boolean;
  onTriggerSound?: (notification: AgendaNotificationItem) => void;
};

type SessionWindow = {
  startAt: Date;
  endAt: Date;
};

const [eventYear, eventMonth, eventDay] = AGENDA_EVENT_DATE_ISO.split('-').map((value) => Number.parseInt(value, 10));

const parseAgendaTimeToDate = (timeLabel: string) => {
  const [hours, minutes] = timeLabel.split(':').map((value) => Number.parseInt(value, 10));
  return new Date(eventYear, eventMonth - 1, eventDay, hours, minutes, 0, 0);
};

const getSessionWindow = (session: Pick<AgendaNotificationSession, 'startTime' | 'endTime'>): SessionWindow => {
  const startAt = parseAgendaTimeToDate(session.startTime);
  const endAt = parseAgendaTimeToDate(session.endTime);
  return endAt.getTime() >= startAt.getTime()
    ? { startAt, endAt }
    : { startAt, endAt: new Date(endAt.getTime() + 24 * 60 * 60 * 1000) };
};

const sortNotifications = (notifications: AgendaNotificationItem[]) =>
  [...notifications].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'starting-now' ? -1 : 1;
    }

    return left.startTime.localeCompare(right.startTime, 'pt-BR');
  });

const areNotificationListsEqual = (
  current: readonly AgendaNotificationItem[],
  next: readonly AgendaNotificationItem[],
) => {
  if (current.length !== next.length) return false;

  return current.every((item, index) => {
    const candidate = next[index];
    return (
      item.id === candidate.id &&
      item.sessionId === candidate.sessionId &&
      item.kind === candidate.kind &&
      item.createdAt === candidate.createdAt &&
      item.hasLinkedPoi === candidate.hasLinkedPoi
    );
  });
};

const buildNotification = (
  session: AgendaNotificationSession,
  kind: AgendaNotificationKind,
  createdAt: number,
): AgendaNotificationItem => ({
  id: `${session.id}:${kind}`,
  sessionId: session.id,
  kind,
  title: session.title,
  summary: session.summary,
  venue: session.venue,
  startTime: session.startTime,
  endTime: session.endTime,
  accent: session.accent,
  hasLinkedPoi: session.hasLinkedPoi,
  createdAt,
});

export const useAgendaNotifications = ({
  sessions,
  enabled,
  onTriggerSound,
}: UseAgendaNotificationsOptions) => {
  const [notifications, setNotifications] = useState<AgendaNotificationItem[]>([]);
  const triggeredIdsRef = useRef(new Set<string>());
  const dismissedIdsRef = useRef(new Set<string>());
  const onTriggerSoundRef = useRef(onTriggerSound);

  useEffect(() => {
    onTriggerSoundRef.current = onTriggerSound;
  }, [onTriggerSound]);

  const sessionWindows = useMemo(
    () =>
      sessions.map((session) => ({
        session,
        ...getSessionWindow(session),
      })),
    [sessions],
  );
  const enabledRef = useRef(enabled);
  const sessionWindowsRef = useRef(sessionWindows);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    sessionWindowsRef.current = sessionWindows;
  }, [sessionWindows]);

  const dismissNotification = useCallback((notificationId: string) => {
    dismissedIdsRef.current.add(notificationId);
    setNotifications((current) => current.filter((item) => item.id !== notificationId));
  }, []);

  const evaluateNotifications = useCallback(() => {
    const enabledState = enabledRef.current;
    const activeSessionWindows = sessionWindowsRef.current;

    if (!enabledState) {
      setNotifications((current) => (current.length === 0 ? current : []));
      return;
    }

    const now = Date.now();
    const freshNotifications: AgendaNotificationItem[] = [];

    activeSessionWindows.forEach(({ session, startAt, endAt }) => {
      const startMs = startAt.getTime();
      const endMs = endAt.getTime();
      const soonNotificationId = `${session.id}:starting-soon`;
      const nowNotificationId = `${session.id}:starting-now`;

      const isInSoonWindow = now >= startMs - STARTING_SOON_OFFSET_MS && now < startMs;
      const isInNowWindow = now >= startMs && now <= endMs;

      if (
        isInSoonWindow &&
        !triggeredIdsRef.current.has(soonNotificationId) &&
        !dismissedIdsRef.current.has(soonNotificationId)
      ) {
        triggeredIdsRef.current.add(soonNotificationId);
        freshNotifications.push(buildNotification(session, 'starting-soon', now));
      }

      if (
        isInNowWindow &&
        !triggeredIdsRef.current.has(nowNotificationId) &&
        !dismissedIdsRef.current.has(nowNotificationId)
      ) {
        triggeredIdsRef.current.add(nowNotificationId);
        freshNotifications.push(buildNotification(session, 'starting-now', now));
      }
    });

    setNotifications((current) => {
      const activeItems = current.filter((item) => {
        const sessionMatch = activeSessionWindows.find(({ session }) => session.id === item.sessionId);
        if (!sessionMatch) return false;
        return now <= sessionMatch.endAt.getTime() + NOTIFICATION_RETENTION_AFTER_END_MS;
      });

      const sortedActiveItems = sortNotifications(activeItems);

      if (freshNotifications.length === 0) {
        return areNotificationListsEqual(current, sortedActiveItems) ? current : sortedActiveItems;
      }

      const nextItems = new Map(sortedActiveItems.map((item) => [item.id, item]));
      freshNotifications.forEach((item) => nextItems.set(item.id, item));
      const sortedNextItems = sortNotifications(Array.from(nextItems.values()));
      return areNotificationListsEqual(current, sortedNextItems) ? current : sortedNextItems;
    });

    freshNotifications.forEach((item) => onTriggerSoundRef.current?.(item));
  }, []);

  useEffect(() => {
    evaluateNotifications();
    const intervalId = window.setInterval(evaluateNotifications, NOTIFICATION_POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [evaluateNotifications]);

  useEffect(() => {
    evaluateNotifications();
  }, [enabled, sessionWindows, evaluateNotifications]);

  return {
    notifications,
    dismissNotification,
  };
};
