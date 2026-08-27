import type { AppConfig } from '../../config/configuration';
import { PostmarkNotificationChannel } from './notification';

const baseConfig = {
  postmark: { apiToken: 'test-token', fromEmail: 'noreply@elimubora.co' }
} as unknown as AppConfig;

// Health-recording is best-effort and side-channel to what these tests assert
// (the actual email send behavior), so a simple resolved-promise stub is enough.
const dbMock = { query: jest.fn().mockResolvedValue({ rows: [] }) } as unknown as import('../database/database.service').DatabaseService;

describe('PostmarkNotificationChannel', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('renders and sends a real invitation email with the accept link and role', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
    global.fetch = fetchMock as unknown as typeof fetch;

    const channel = new PostmarkNotificationChannel(baseConfig, dbMock);
    await channel.deliver({
      to: { email: 'teacher@school.ke' },
      template: 'invitation',
      data: { acceptUrl: 'https://elimubora.co/invitations/accept?token=abc123', role: 'teacher' }
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.postmarkapp.com/email');
    expect(options.headers['X-Postmark-Server-Token']).toBe('test-token');
    const body = JSON.parse(options.body);
    expect(body.From).toBe('noreply@elimubora.co');
    expect(body.To).toBe('teacher@school.ke');
    expect(body.Subject).toContain('invited');
    expect(body.TextBody).toContain('https://elimubora.co/invitations/accept?token=abc123');
    expect(body.TextBody).toContain('teacher');
    expect(body.HtmlBody).toContain('https://elimubora.co/invitations/accept?token=abc123');
  });

  it('renders and sends a real password-reset email with the reset link', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
    global.fetch = fetchMock as unknown as typeof fetch;

    const channel = new PostmarkNotificationChannel(baseConfig, dbMock);
    await channel.deliver({
      to: { email: 'parent@example.ke' },
      template: 'password-reset',
      data: { resetUrl: 'https://elimubora.co/password/reset?token=xyz789' }
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.Subject).toContain('Reset');
    expect(body.TextBody).toContain('https://elimubora.co/password/reset?token=xyz789');
  });

  it('throws when Postmark rejects the send, rather than silently believing delivery succeeded', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 422, text: async () => 'Invalid recipient' });
    global.fetch = fetchMock as unknown as typeof fetch;

    const channel = new PostmarkNotificationChannel(baseConfig, dbMock);
    await expect(
      channel.deliver({ to: { email: 'bad@invalid' }, template: 'password-reset', data: { resetUrl: 'x' } })
    ).rejects.toThrow('Postmark delivery failed');
  });

  it('skips delivery gracefully for a phone-only recipient rather than crashing', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const channel = new PostmarkNotificationChannel(baseConfig, dbMock);
    await channel.deliver({ to: { phone: '+254700000000' }, template: 'invitation', data: {} });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
