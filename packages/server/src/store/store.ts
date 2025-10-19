import { create } from 'zustand';
import { createJSONStorage, devtools, persist, subscribeWithSelector } from 'zustand/middleware';

type State = {
  playerInformation: any;
};

export const useStore = create<State>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      playerInformation: {},
      setPlayerInformation: (info: any) => set({ playerInformation: info }),
    })),
  ),
);
