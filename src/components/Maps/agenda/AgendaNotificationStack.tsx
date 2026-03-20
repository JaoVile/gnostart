import type { CSSProperties } from 'react';
import type { AgendaNotificationItem } from './useAgendaNotifications';

type AgendaNotificationStackProps = {
  notifications: AgendaNotificationItem[];
  onDismiss: (notificationId: string) => void;
  onNavigate: (notification: AgendaNotificationItem) => void;
};

export const AgendaNotificationStack = ({
  notifications,
  onDismiss,
  onNavigate,
}: AgendaNotificationStackProps) => {
  if (notifications.length === 0) return null;

  return (
    <div className='agenda-notification-stack' aria-live='polite' aria-label='Alertas do cronograma'>
      {notifications.map((notification) => {
        const badgeLabel = notification.kind === 'starting-now' ? 'Comecou agora' : 'Comeca em 5 min';

        return (
          <aside
            key={notification.id}
            className={`agenda-notification-card ${notification.kind}`}
            style={{ '--agenda-alert-accent': notification.accent } as CSSProperties}
          >
            <button
              type='button'
              className='agenda-notification-close'
              onClick={() => onDismiss(notification.id)}
              aria-label='Fechar alerta'
            >
              x
            </button>

            <div className='agenda-notification-badge'>{badgeLabel}</div>
            <div className='agenda-notification-title'>{notification.title}</div>
            <div className='agenda-notification-meta'>{`${notification.startTime} - ${notification.endTime} | ${notification.venue}`}</div>
            <div className='agenda-notification-copy'>{notification.summary}</div>

            <div className='agenda-notification-actions'>
              <button
                type='button'
                className='btn btn-primary agenda-notification-cta'
                disabled={!notification.hasLinkedPoi}
                onClick={() => onNavigate(notification)}
              >
                {notification.hasLinkedPoi ? 'Ir pra la' : 'Sem local'}
              </button>
            </div>
          </aside>
        );
      })}
    </div>
  );
};
