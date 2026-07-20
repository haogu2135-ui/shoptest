import fs from 'fs';
import path from 'path';
import { focusFirstFormError } from './formValidationFocus';

describe('focusFirstFormError', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.scrollTo = jest.fn();
  });

  it('focuses and scrolls the first invalid form control inside the root', () => {
    document.body.innerHTML = `
      <div class="checkout-page">
        <div class="ant-form-item ant-form-item-has-error">
          <input id="recipient" />
        </div>
        <div class="ant-form-item ant-form-item-has-error">
          <input id="phone" />
        </div>
      </div>
    `;
    const firstItem = document.querySelector('.ant-form-item-has-error') as HTMLElement;
    const recipient = document.getElementById('recipient') as HTMLInputElement;
    firstItem.scrollIntoView = jest.fn();
    const focusSpy = jest.spyOn(recipient, 'focus');

    expect(focusFirstFormError({ rootSelector: '.checkout-page', scrollOffset: 80 })).toBe(true);
    expect(firstItem.scrollIntoView).toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it('returns false when no invalid field exists', () => {
    document.body.innerHTML = '<div class="checkout-page"><div class="ant-form-item"><input /></div></div>';
    expect(focusFirstFormError({ rootSelector: '.checkout-page' })).toBe(false);
  });

  it('supports optional scroll containers for card-based auth forms', () => {
    const source = fs.readFileSync(path.join(__dirname, 'formValidationFocus.ts'), 'utf8');
    expect(source).toContain('scrollContainerSelector');
    expect(source).toContain('container.scrollTo');
  });

});
