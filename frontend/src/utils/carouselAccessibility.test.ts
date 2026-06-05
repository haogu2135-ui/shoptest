import { syncHiddenCarouselSlideFocus } from './carouselAccessibility';

describe('carousel accessibility helpers', () => {
  it('removes hidden slick slide controls from the tab order and restores visible ones', () => {
    document.body.innerHTML = `
      <div id="carousel">
        <div class="slick-slide" aria-hidden="true">
          <button id="hidden-button">Hidden</button>
          <div id="hidden-card" tabindex="0">Hidden card</div>
        </div>
        <div class="slick-slide" aria-hidden="false">
          <button id="visible-button">Visible</button>
          <div id="visible-card" tabindex="0">Visible card</div>
        </div>
      </div>
    `;

    const root = document.getElementById('carousel');
    syncHiddenCarouselSlideFocus(root);

    expect(document.getElementById('hidden-button')).toHaveAttribute('tabindex', '-1');
    expect(document.getElementById('hidden-card')).toHaveAttribute('tabindex', '-1');
    expect(document.getElementById('visible-button')).not.toHaveAttribute('tabindex');
    expect(document.getElementById('visible-card')).toHaveAttribute('tabindex', '0');

    document.querySelector('.slick-slide')?.setAttribute('aria-hidden', 'false');
    syncHiddenCarouselSlideFocus(root);

    expect(document.getElementById('hidden-button')).not.toHaveAttribute('tabindex');
    expect(document.getElementById('hidden-card')).toHaveAttribute('tabindex', '0');
  });
});
