import { parseSupportSocketPayload } from './supportChatConfig';

describe('supportChatConfig', () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.REACT_APP_SUPPORT_WEBSOCKET_MAX_MESSAGE_CHARS;
  });

  it('rejects non-object websocket payloads', () => {
    expect(parseSupportSocketPayload('"hello"')).toEqual({ type: 'ERROR', message: 'Invalid support message' });
    expect(parseSupportSocketPayload('[{\"type\":\"MESSAGE\"}]')).toEqual({ type: 'ERROR', message: 'Invalid support message' });
    expect(parseSupportSocketPayload('not json')).toEqual({ type: 'ERROR', message: 'Invalid support message' });
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
