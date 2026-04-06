import { useEffect, useState } from 'react';
import { notificationsAPI } from '../api/client';
import './NotificationPage.css';

export default function NotificationPage({ showToast }) {
  const [notificationType, setNotificationType] = useState('push'); // 'push' or 'email'
  const [email, setEmail] = useState('');
  const [subscribedEmail, setSubscribedEmail] = useState(() => localStorage.getItem('polyscopeSubscribedEmail') || '');
  const [loading, setLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState('serviceWorker' in navigator);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [pushEndpoint, setPushEndpoint] = useState(() => localStorage.getItem('polyscopePushEndpoint') || '');

  useEffect(() => {
    if (!pushSupported) return;

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (subscription?.endpoint) {
          setPushEndpoint(subscription.endpoint);
          localStorage.setItem('polyscopePushEndpoint', subscription.endpoint);
          setSubscriptionStatus((current) => current || 'push-active');
        }
      })
      .catch(() => {
        // Keep setup silent for users if browser APIs are blocked.
      });
  }, [pushSupported]);

  const handleEmailSubscribe = async (e) => {
    e.preventDefault();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showToast('Please enter a valid email', 'error');
      return;
    }

    setLoading(true);
    try {
      await notificationsAPI.subscribeEmail(email, [], {
        frequency: 'monthly',
        minConfidence: 70
      });
      showToast('Check your email to verify subscription', 'success');
      setSubscribedEmail(email);
      localStorage.setItem('polyscopeSubscribedEmail', email);
      setEmail('');
      setSubscriptionStatus('email-pending');
    } catch (err) {
      void err;
      showToast('Unable to subscribe. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePushSubscribe = async () => {
    setLoading(true);
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('Notification permission denied', 'error');
        setLoading(false);
        return;
      }

      // Get VAPID public key from server
      const { publicKey } = await notificationsAPI.getVapidPublicKey();
      if (!publicKey) {
        showToast('Push key is unavailable. Please try again later.', 'error');
        setLoading(false);
        return;
      }

      // Register service worker
      const existingRegistration = await navigator.serviceWorker.getRegistration('/');
      const registration = existingRegistration || await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      // Subscribe to push
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }

      // Send subscription to server
      await notificationsAPI.subscribePush(subscription, [], {
        minConfidence: 70
      });

      showToast('Push notifications enabled!', 'success');
      setPushEndpoint(subscription.endpoint || '');
      if (subscription.endpoint) localStorage.setItem('polyscopePushEndpoint', subscription.endpoint);
      setSubscriptionStatus('push-active');
    } catch (err) {
      if (err?.message?.toLowerCase()?.includes('not secure')) {
        showToast('Push notifications require HTTPS', 'error');
      } else {
        showToast('Unable to enable push notifications. Check browser permission and try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePushUnsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const browserSubscription = registration ? await registration.pushManager.getSubscription() : null;
      const endpoint = browserSubscription?.endpoint || pushEndpoint;

      if (!endpoint) {
        showToast('No active push subscription found.', 'error');
        setLoading(false);
        return;
      }

      await notificationsAPI.unsubscribePush(endpoint);
      if (browserSubscription) await browserSubscription.unsubscribe();

      setPushEndpoint('');
      localStorage.removeItem('polyscopePushEndpoint');
      setSubscriptionStatus('push-unsubscribed');
      showToast('Push notifications disabled.', 'success');
    } catch {
      showToast('Unable to disable push notifications right now.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailUnsubscribe = async () => {
    if (!subscribedEmail) {
      showToast('No subscribed email found.', 'error');
      return;
    }

    setLoading(true);
    try {
      await notificationsAPI.unsubscribeEmail({ email: subscribedEmail });
      setSubscribedEmail('');
      localStorage.removeItem('polyscopeSubscribedEmail');
      setSubscriptionStatus('email-unsubscribed');
      showToast('Email notifications disabled.', 'success');
    } catch {
      showToast('Unable to unsubscribe email right now.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notification-page">
      <div className="notification-header">
        <h2>Alert Preferences</h2>
        <p className="notification-subtitle">Choose how you'd like to receive prediction alerts</p>
      </div>

      <div className="notification-options">
        <div className="notification-type-selector">
          <button
            className={`type-btn ${notificationType === 'push' ? 'active' : ''}`}
            onClick={() => setNotificationType('push')}
          >
            <span className="type-icon">🔔</span>
            <span className="type-name">Push Notifications</span>
          </button>
          <button
            className={`type-btn ${notificationType === 'email' ? 'active' : ''}`}
            onClick={() => setNotificationType('email')}
          >
            <span className="type-icon">📧</span>
            <span className="type-name">Email Alerts</span>
          </button>
        </div>

        {notificationType === 'push' && (
          <PushNotificationSetup
            supported={pushSupported}
            loading={loading}
            status={subscriptionStatus}
            onSubscribe={handlePushSubscribe}
            onUnsubscribe={handlePushUnsubscribe}
            hasActiveEndpoint={!!pushEndpoint}
          />
        )}

        {notificationType === 'email' && (
          <EmailSubscriptionSetup
            email={email}
            subscribedEmail={subscribedEmail}
            setEmail={setEmail}
            loading={loading}
            status={subscriptionStatus}
            onSubmit={handleEmailSubscribe}
            onUnsubscribe={handleEmailUnsubscribe}
          />
        )}
      </div>

      <div className="notification-info">
        <h3>What you'll receive:</h3>
        <ul>
          <li>High-confidence predictions from our AI model</li>
          <li>Market analysis and reasoning</li>
          <li>Email alerts verified by opt-in confirmation</li>
          <li>Opt-out anytime with one click</li>
        </ul>
      </div>
    </div>
  );
}

function PushNotificationSetup({ supported, loading, status, onSubscribe, onUnsubscribe, hasActiveEndpoint }) {
  if (!supported) {
    return (
      <div className="notification-setup">
        <div className="notification-unavailable">
          <h3>🔔 Push Notifications Unavailable</h3>
          <p>Your browser doesn't support push notifications. Use Email Alerts instead.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-setup">
      <div className="setup-card">
        <div className="setup-steps">
          <div className="step">
            <span className="step-number">1</span>
            <p>We'll request permission to send notifications</p>
          </div>
          <div className="step">
            <span className="step-number">2</span>
            <p>Receive real-time alerts on high-confidence predictions</p>
          </div>
          <div className="step">
            <span className="step-number">3</span>
            <p>Manage preferences anytime</p>
          </div>
        </div>

        {status === 'push-active' && (
          <div className="status-message success">
            ✓ Push notifications enabled
          </div>
        )}

        <button
          className="subscribe-btn primary"
          onClick={onSubscribe}
          disabled={loading || status === 'push-active'}
        >
          {loading ? 'Setting up...' : status === 'push-active' ? 'Enabled' : 'Enable Push Notifications'}
        </button>

        {(status === 'push-active' || hasActiveEndpoint) && (
          <button
            className="subscribe-btn secondary"
            onClick={onUnsubscribe}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Disable Push Notifications'}
          </button>
        )}

        <p className="setup-note">
          💡 Tip: Browser notifications appear even when Polyscope is closed
        </p>
      </div>
    </div>
  );
}

function EmailSubscriptionSetup({ email, subscribedEmail, setEmail, loading, status, onSubmit, onUnsubscribe }) {
  return (
    <div className="notification-setup">
      <div className="setup-card">
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || status === 'email-pending'}
              required
            />
          </div>

          {status === 'email-pending' && (
            <div className="status-message info">
              ✓ Verification sent to {subscribedEmail}. Check your inbox!
            </div>
          )}

          <div className="setup-steps">
            <div className="step">
              <span className="step-number">1</span>
              <p>Enter your email address</p>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <p>We'll send a verification link</p>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <p>Monthly digest of high-confidence predictions</p>
            </div>
          </div>

          <button
            type="submit"
            className="subscribe-btn primary"
            disabled={loading || status === 'email-pending'}
          >
            {loading ? 'Subscribing...' : status === 'email-pending' ? 'Pending Verification' : 'Subscribe to Email Alerts'}
          </button>

          {subscribedEmail && (
            <button
              type="button"
              className="subscribe-btn secondary"
              onClick={onUnsubscribe}
              disabled={loading}
            >
              {loading ? 'Updating...' : `Unsubscribe ${subscribedEmail}`}
            </button>
          )}
        </form>

        <p className="setup-note">
          💡 Note: Emails are sent monthly with high-confidence predictions
        </p>
      </div>
    </div>
  );
}

// Helper function to convert VAPID public key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
