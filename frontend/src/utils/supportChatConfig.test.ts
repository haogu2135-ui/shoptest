import { parseSupportSocketPayload } from './supportChatConfig';

describe('supportChatConfig', () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.REACT_APP_SUPPORT_WEBSOCKET_MAX_MESSAGE_CHARS;
  });

  it('rejects non-object websocket payloads', () => {
    expect(parseSupportSocketPayload('"hello"')).toEqual({ type: 'ERROR' });
    expect(parseSupportSocketPayload('[{\"type\":\"MESSAGE\"}]')).toEqual({ type: 'ERROR' });
    expect(parseSupportSocketPayload('not json')).toEqual({ type: 'ERROR' });
  });

  it('rejects malformed websocket payload shapes before components read nested fields', () => {
    expect(parseSupportSocketPayload('{\"type\":\"MESSAGE\"}')).toEqual({ type: 'ERROR' });
    expect(parseSupportSocketPayload('{\"type\":\"MESSAGE\",\"session\":{\"id\":1,\"status\":\"OPEN\"},\"message\":{}}')).toEqual({ type: 'ERROR' });
    expect(parseSupportSocketPayload('{\"type\":\"SESSION_UPDATED\"}')).toEqual({ type: 'ERROR' });
    expect(parseSupportSocketPayload('{\"type\":\"ERROR\",\"message\":\" rejected \"}')).toEqual({ type: 'ERROR', message: 'rejected' });
  });

  it('accepts validated websocket payloads used by support components', () => {
    const messagePayload = {
      type: 'MESSAGE',
      session: { id: 42, status: 'OPEN', unreadByUser: 1 },
      message: { id: 100, sessionId: 42, senderRole: 'ADMIN', content: 'Hello' },
    };
    const updatePayload = {
      type: 'SESSION_CLOSED',
      session: { id: 42, status: 'CLOSED' },
    };

    expect(parseSupportSocketPayload(JSON.stringify(messagePayload))).toEqual(messagePayload);
    expect(parseSupportSocketPayload(JSON.stringify(updatePayload))).toEqual(updatePayload);
  });

  it('caps and strictly parses message length config', () => {
    jest.resetModules();
    process.env.REACT_APP_SUPPORT_WEBSOCKET_MAX_MESSAGE_CHARS = '12000';
    expect(require('./supportChatConfig').supportChatConfig.maxMessageChars).toBe(5000);

    jest.resetModules();
    process.env.REACT_APP_SUPPORT_WEBSOCKET_MAX_MESSAGE_CHARS = '12abc';
    expect(require('./supportChatConfig').supportChatConfig.maxMessageChars).toBe(1000);
  });
});
