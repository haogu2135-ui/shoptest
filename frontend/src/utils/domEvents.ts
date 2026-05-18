export const dispatchDomEvent = (eventName: string, detail?: unknown) => {
  if (typeof window === 'undefined') return false;

  try {
    const event = detail === undefined
      ? new Event(eventName)
      : new CustomEvent(eventName, { detail });
    return window.dispatchEvent(event);
  } catch {
    try {
      if (detail !== undefined) {
        const event = document.createEvent('CustomEvent');
        event.initCustomEvent(eventName, true, true, detail);
        return window.dispatchEvent(event);
      }
      const event = document.createEvent('Event');
      event.initEvent(eventName, true, true);
      return window.dispatchEvent(event);
    } catch {
      return false;
    }
  }
};
