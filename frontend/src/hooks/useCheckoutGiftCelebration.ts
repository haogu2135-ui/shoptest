import { useEffect, type Dispatch, type SetStateAction } from 'react';

type UseCheckoutGiftCelebrationParams = {
  giftCelebrated: boolean;
  giftUnlocked: boolean;
  setGiftCelebrated: Dispatch<SetStateAction<boolean>>;
  setGiftCelebrationOpen: Dispatch<SetStateAction<boolean>>;
};

/** One-shot gift unlock celebration modal trigger for commercial checkout conversion. */
export const useCheckoutGiftCelebration = ({
  giftCelebrated,
  giftUnlocked,
  setGiftCelebrated,
  setGiftCelebrationOpen,
}: UseCheckoutGiftCelebrationParams) => {
  useEffect(() => {
    if (!giftUnlocked || giftCelebrated) return;
    setGiftCelebrationOpen(true);
    setGiftCelebrated(true);
  }, [giftCelebrated, giftUnlocked, setGiftCelebrated, setGiftCelebrationOpen]);
};
