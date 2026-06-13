import React from 'react';
import { message } from 'antd';
import {
  extractAccessibleMessageText,
  runWithoutAccessibleMessageAnnouncement,
  subscribeAccessibleMessages,
  type AccessibleMessageAnnouncement,
} from './accessibleMessage';

jest.mock('antd', () => {
  const mockMessage: {
    open: jest.Mock;
    success?: jest.Mock;
    error?: jest.Mock;
    warning?: jest.Mock;
    info?: jest.Mock;
  } = {
    open: jest.fn(),
  };
  mockMessage.success = jest.fn((content: unknown) => mockMessage.open({ type: 'success', content }));
  mockMessage.error = jest.fn((content: unknown) => mockMessage.open({ type: 'error', content }));
  mockMessage.warning = jest.fn((content: unknown) => mockMessage.open({ type: 'warning', content }));
  mockMessage.info = jest.fn((content: unknown) => mockMessage.open({ type: 'info', content }));
  return { message: mockMessage };
});

describe('accessible AntD message announcer', () => {
  it('extracts readable text from supported AntD message content shapes', () => {
    expect(extractAccessibleMessageText(' Saved   changes ')).toBe('Saved changes');
    expect(extractAccessibleMessageText({ content: ['Login', <strong key="required">required</strong>] })).toBe('Login required');
    expect(extractAccessibleMessageText(<span>Retry <em>payment</em></span>)).toBe('Retry payment');
  });

  it('announces static message helpers once even when they delegate through message.open', () => {
    const announcements: AccessibleMessageAnnouncement[] = [];
    const unsubscribe = subscribeAccessibleMessages((announcement) => announcements.push(announcement));

    message.success('Saved changes');

    expect(announcements).toEqual([
      expect.objectContaining({ text: 'Saved changes', type: 'success' }),
    ]);
    unsubscribe();
  });

  it('announces message.open config content', () => {
    const announcements: AccessibleMessageAnnouncement[] = [];
    const unsubscribe = subscribeAccessibleMessages((announcement) => announcements.push(announcement));

    message.open({ type: 'error', content: <span>Login required</span> });

    expect(announcements).toEqual([
      expect.objectContaining({ text: 'Login required', type: 'error' }),
    ]);
    unsubscribe();
  });

  it('allows local live regions to suppress the global announcement', () => {
    const announcements: AccessibleMessageAnnouncement[] = [];
    const unsubscribe = subscribeAccessibleMessages((announcement) => announcements.push(announcement));

    runWithoutAccessibleMessageAnnouncement(() => message.warning('Checkout already announced this'));

    expect(announcements).toEqual([]);
    unsubscribe();
  });
});
